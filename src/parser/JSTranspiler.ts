import * as path from "path";
import * as fs from "fs/promises";
import * as crypto from "crypto";
import { SourceMapGenerator } from "source-map";
import { PHPFatalError } from "../runtime/PHPError.js";
import { PHPPropertyReference } from "../runtime/PHPVariable.js";
import { encodePhpIdentifier, encodePhpMethodName, encodePhpPropertyName, normalizePhpRegistryName } from "../runtime/Reflection.js";
import { ASTOptimizer } from "./ASTOptimizer.js";
import type { PHPEngine } from "../PHPEngine.js";
import {
  SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS,
  SYMBOL_PHP_METHOD_THEN,
  SYMBOL_PHP_METHODS,
  SYMBOL_PHP_NAME,
  SYMBOL_PHP_PROPERTIES,
  SYMBOL_PHP_STATIC_METHOD_PROTOTYPE,
} from "../runtime/Reflection.js";

import engineParser from "php-parser";

export interface TranspileOptions {
  engineSHA1?: string;
  cacheDir?: string;
  engine?: PHPEngine;
  sourceMap?: boolean;
  format?: "cjs" | "esm";
}

export interface TranspilationResult {
  code: string;
  map?: string;
}

interface PHPFunctionBinding {
  variable: string;
  scopeId: number;
  kind: "direct" | "conditional";
}

interface PHPParameterUsage {
  read: boolean;
  readCount: number;
  needsReference: boolean;
  rebindsReference: boolean;
  passThroughReference: boolean;
  requiresScopeBinding: boolean;
}

interface PHPFunctionUsage {
  requiresPhpScope: boolean;
  requiresArgumentScope: boolean;
  requiresAllParametersInScope: boolean;
  parameters: Record<string, PHPParameterUsage>;
}

interface PHPParameterBinding {
  readExpression: string;
  referenceExpression?: string;
}

interface TranspileScope {
  id: number;
  parent?: TranspileScope;
  functionBindings: Record<string, PHPFunctionBinding>;
  functionCaches: Record<string, string>;
  functionCacheKinds: Record<string, "constant" | "lazy">;
  functionCacheNames: Record<string, string>;
  functionCacheFallbacks: Record<string, string>;
  directFunctionDeclarations: Record<string, any>;
  conditionalFunctionDeclarations: Record<string, any[]>;
  functionFallbacks: Set<string>;
  classBindings: Record<string, string>;
  conditionalClassBindings: Set<string>;
  predeclaredClassBindings: Set<string>;
  classCaches: Record<string, string>;
}

interface PHPNamespaceContext {
  name: string;
  originalName: string;
  imports: Record<string, string>;
  importsOriginal: Record<string, string>;
}

const SYMBOL_TRANSPILE_NAMESPACE = Symbol("php.transpileNamespace");

export class JSTranspiler {
  private parser: any;
  private currentClassName = "";
  private currentClassNameOriginal = "";
  private currentClassVariable = "";
  private currentParentVariable = "";
  private currentClosureSuperHelpers: Record<string, { variable: string; expression: string }> | null = null;
  private currentParameterBindings: Record<string, PHPParameterBinding> = Object.create(null);
  private currentPhpScopeRequired = true;
  private variableClassNames: Record<string, string> = Object.create(null);
  private classProperties: Record<string, Set<string>> = Object.create(null);
  private classStaticMethods: Record<string, Set<string>> = Object.create(null);
  private magicClasses = new Set<string>();
  private staticMagicClasses = new Set<string>();
  private transpileScopes: TranspileScope[] = [];
  private transpileScopeId = 0;
  private currentFuncName = "";
  private currentNamespaceName = "";
  private currentNamespaceNameOriginal = "";
  private classImports: Record<string, string> = Object.create(null);
  private classImportsOriginal: Record<string, string> = Object.create(null);
  private stringLiteralBindings: Record<string, string> = Object.create(null);
  private loopLabelCounter = 0;
  private switchLabelCounter = 0;
  private anonClassCounter = 0;
  private loopStack: { label: string; type: "loop" | "switch" }[] = [];

  constructor() {
    this.parser = new ((engineParser as any).Engine || (engineParser as any))({
      parser: {
        extractDoc: false,
        extractTokens: false,
        phpVersion: "8.1",
        suppressErrors: true,
      },
      lexer: {
        all_tokens: false,
        comment: false,
      },
      ast: {
        withPositions: true,
        withSource: false,
      },
    });
  }

  public async transpile(code: string, filepath: string = "eval", options: TranspileOptions = {}): Promise<TranspilationResult> {
    this.currentNamespaceName = "";
    this.currentNamespaceNameOriginal = "";
    this.currentClassName = "";
    this.currentClassNameOriginal = "";
    this.currentClassVariable = "";
    this.currentParentVariable = "";
    this.currentClosureSuperHelpers = null;
    this.currentParameterBindings = Object.create(null);
    this.currentPhpScopeRequired = true;
    this.stringLiteralBindings = Object.create(null);
    this.variableClassNames = Object.create(null);
    this.classProperties = Object.create(null);
    this.classStaticMethods = Object.create(null);
    this.magicClasses.clear();
    this.staticMagicClasses.clear();
    this.transpileScopes = [];
    this.transpileScopeId = 0;
    for (const [classKey, cls] of Object.entries(options.engine?.classes || {})) {
      const className = normalizePhpRegistryName(String(cls?.[SYMBOL_PHP_NAME] || classKey));
      const properties = cls?.[SYMBOL_PHP_PROPERTIES];
      if (properties && typeof properties === "object") {
        this.classProperties[className] = new Set(Object.keys(properties));
      }
      if (cls?.prototype?.[SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS]) this.magicClasses.add(className);
      const methods = cls?.[SYMBOL_PHP_METHODS] || {};
      const methodEntries = Reflect.ownKeys(methods).map((key) => methods[key]);
      this.classStaticMethods[className] = new Set(
        methodEntries.filter((method: any) => method?.isStatic).map((method: any) => String(method.name || "").toLowerCase())
      );
      if (methodEntries.some((method: any) => method?.name?.toLowerCase() === "__callstatic")) {
        this.staticMagicClasses.add(className);
      }
    }

    this.classImports = Object.create(null);
    this.classImportsOriginal = Object.create(null);

    const codeHash = crypto.createHash("sha1").update(code).digest("hex");
    const engineHash = options.engineSHA1 || "default";
    const cacheFileName = `${codeHash}_${engineHash}.js`;

    if (options.cacheDir) {
      const cachedFilePath = path.join(options.cacheDir, cacheFileName);
      try {
        const cachedCode = await fs.readFile(cachedFilePath, "utf8");
        return { code: cachedCode };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      }
    }

    const codeToParse = code.includes("<?") ? code : "<?php\n" + code;
    let ast = this.parser.parseCode(codeToParse, filepath);

    let finalAst = ast;
    if (options.engine) {
      finalAst = ASTOptimizer.optimize(ast, options.engine);
    }

    const mapGen = options.sourceMap ? new SourceMapGenerator({ file: filepath }) : null;
    if (mapGen) {
      mapGen.setSourceContent(filepath, code);
    }
    const lines: string[] = [];
    const lineMap: Record<number, any> = Object.create(null);

    const bodyNodes = finalAst?.children || finalAst?.body || (Array.isArray(finalAst) ? finalAst : [finalAst]);
    this.currentClassName = "";
    this.currentNamespaceName = "";
    this.classImports = Object.create(null);
    this.classImportsOriginal = Object.create(null);
    this.annotateNamespaceContexts(bodyNodes);
    this.stringLiteralBindings = this.collectStringArgumentLiterals(bodyNodes);

    if (Object.keys(this.stringLiteralBindings).length > 0) {
      lines.push("const BasicLiteral = class BasicLiteral {");
      lines.push("  constructor(value) { this.value = value; Object.defineProperty(this, Symbol.for(\"php.reference\"), { value: true }); }");
      lines.push("  async get() { return this.value; }");
      lines.push("  async set(_value) { throw new Error(\"Literals cannot be changed\"); }");
      lines.push("  async setFrom(_other) { return this.set(undefined); }");
      lines.push("  async isset() { return this.value !== null && this.value !== undefined; }");
      lines.push("  async unset() { return this.set(undefined); }");
      lines.push("  toString() { return this.value === null || this.value === undefined ? \"\" : String(this.value); }");
      lines.push("  valueOf() { return this.value; }");
      lines.push("  [Symbol.toPrimitive](hint) { if (hint === \"number\") return Number(this.value) || 0; if (hint === \"string\") return this.value === null || this.value === undefined ? \"\" : String(this.value); return this.value; }");
      lines.push("};");
      for (const [literal, variable] of Object.entries(this.stringLiteralBindings)) {
        lines.push(`const ${variable} = new BasicLiteral(${literal});`);
      }
    }

    const format = options.format || "cjs";
    if (format === "esm") {
      lines.push("export default async function(ctx) {");
    } else {
      lines.push("module.exports = async function(ctx) {");
    }
    lines.push("  if (ctx && typeof ctx.createContext === \"function\") ctx = ctx.createContext();");
    lines.push("  const { PHPVariable, PHPLiteral, PHPFatalError, PHPError, PHPInterface, PHPPropertyReference, PHPArrayOffsetReference, PROXY_HANDLER, STATIC_PROXY_HANDLER, encodePhpIdentifier, encodePhpMethodName, encodePhpPropertyName, normalizePhpRegistryName, SYMBOL_PHP_NAME, SYMBOL_PHP_META, SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_PROPERTIES, SYMBOL_PHP_METHODS, SYMBOL_PHP_CLASS, SYMBOL_PHP_PARENT, SYMBOL_PHP_NEW, SYMBOL_PHP_INIT, SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS, SYMBOL_PHP_CLASS_INTERFACES, SYMBOL_PHP_METHOD_THEN, SYMBOL_PHP_STATIC_METHOD_PROTOTYPE } = ctx.engine?.symbols || ctx.symbols;");
    lines.push("  try {");

    const rootScope = this.createTranspileScope(bodyNodes);
    this.transpileScopes.push(rootScope);
    const classCacheMarker = lines.length;
    lines.push("");
    this.emitScopePreamble(rootScope, lines, lineMap, mapGen, filepath, 4);

    const scopeVars = this.collectVariablesInScope(bodyNodes);
    const reboundVariables = this.collectReboundVariables(bodyNodes);
    for (const vName of scopeVars) {
      if (vName === "this" || this.isSuperglobal(vName)) continue;
      const safeId = encodePhpIdentifier(vName);
      lines.push(`    ${reboundVariables.has(vName) ? "let" : "const"} $v_${safeId} = ctx.getPHPVar(${JSON.stringify(vName)});`);
    }

    this.transpileNodeList(bodyNodes, lines, lineMap, mapGen, filepath, 4, "{main}", true);
    this.insertClassCachePreamble(rootScope, lines, classCacheMarker, 4);
    this.transpileScopes.pop();

    lines.push("  } finally {");
    lines.push("    ctx.outputBuffer.flushAll(ctx);");
    lines.push("  }");
    lines.push("};");

    let mapString: string | undefined;
    let fullCode = lines.join("\n");
    if (options.sourceMap) {
      mapString = mapGen.toString();
      const base64Map = Buffer.from(mapString).toString("base64");
      fullCode += `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64Map}`;
    }

    (ast as any) = null;
    (finalAst as any) = null;

    if (options.cacheDir) {
      await fs.mkdir(options.cacheDir, { recursive: true });
      await fs.writeFile(path.join(options.cacheDir, cacheFileName), fullCode, "utf8");
    }

    return {
      code: fullCode,
      map: mapString,
    };
  }

  private collectFunctionsInNodes(nodes: any[], result: any[] = []): any[] {
    if (!Array.isArray(nodes)) return result;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      if (node.kind === "function") {
        result.push(node);
        continue;
      }
      if (node.kind === "class" || node.kind === "interface" || node.kind === "trait") {
        continue;
      }
      if (node.children) {
        this.collectFunctionsInNodes(node.children, result);
      }
      if (node.body) {
        this.collectFunctionsInNodes(Array.isArray(node.body) ? node.body : node.body.children || [node.body], result);
      }
      if (node.alternate) {
        this.collectFunctionsInNodes(Array.isArray(node.alternate) ? node.alternate : node.alternate.children || [node.alternate], result);
      }
    }
    return result;
  }

  private transpileFunctionNode(
    node: any,
    lines: string[],
    lineMap: Record<number, any>,
    mapGen: SourceMapGenerator,
    filepath: string,
    indent: number,
    binding: PHPFunctionBinding
  ): void {
    const pad = " ".repeat(indent);
    const originalFuncName = (node.name?.name || node.name || "").toString();
    const funcName = originalFuncName.toLowerCase();
    const namespace = this.getNamespaceContext(node);
    const functionKey = namespace.name ? `${namespace.name}$$${funcName}` : funcName;
    const jsFunctionName = this.encodePhpQualifiedIdentifier(functionKey);
    const reflectedFunctionName = namespace.originalName ? `${namespace.originalName}\\${originalFuncName}` : originalFuncName;
    const visibility = (node.visibility || "public").toString();
    const bodyNodes = node.body?.children || node.body;
    const parameterNodes = node.arguments || [];
    const scopeNodes = [...(Array.isArray(bodyNodes) ? bodyNodes : [bodyNodes]), ...parameterNodes.map((p: any) => p.value).filter(Boolean)];
    const functionScope = this.createTranspileScope(scopeNodes);
    this.transpileScopes.push(functionScope);
    const previousNamespaceName = this.currentNamespaceName;
    const previousNamespaceNameOriginal = this.currentNamespaceNameOriginal;
    const previousImports = this.classImports;
    const previousImportsOriginal = this.classImportsOriginal;
    this.currentNamespaceName = namespace.name;
    this.currentNamespaceNameOriginal = namespace.originalName;
    this.classImports = Object.assign(Object.create(null), namespace.imports);
    this.classImportsOriginal = Object.assign(Object.create(null), namespace.importsOriginal);
    const params = parameterNodes.map((a: any, idx: number) => {
      const pName = this.getConstName(a.name || a);
      const hasDefault = Boolean(a.value);
      const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
      return { name: pName, position: idx, byref: Boolean(a.byref || a.byRef), variadic: Boolean(a.variadic || a.isVariadic), isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
    });
    const requiredCount = params.filter((p: any) => !p.hasDefault).length;
    const isGen = this.containsYield(bodyNodes);
    const usage = this.analyzeFunctionUsage(bodyNodes, params);
    const needsScope = usage.requiresPhpScope || usage.requiresArgumentScope;
    const savedLoopStack = this.loopStack;
    const savedFuncName = this.currentFuncName;
    const savedParameterBindings = this.currentParameterBindings;
    const savedPhpScopeRequired = this.currentPhpScopeRequired;
    this.currentFuncName = reflectedFunctionName;
    this.loopStack = [];

    lines.push(`${pad}${binding.kind === "direct" ? "const " : ""}${binding.variable} = async function${isGen ? "*" : ""} ${jsFunctionName}(${this.functionParameterList(params)}) {`);
    if (needsScope) {
      lines.push(`${pad}  ctx.pushScope(arguments, 1);`);
      lines.push(`${pad}  try {`);
    }
    const bodyIndent = indent + (needsScope ? 4 : 2);
    const bodyPad = " ".repeat(bodyIndent);
    const classCacheMarker = lines.length;
    lines.push("");
    try {
      this.emitScopePreamble(functionScope, lines, lineMap, mapGen, filepath, bodyIndent);

      const scopeVars = this.collectVariablesInScope(bodyNodes);
      const parameterNames = new Set(params.map((p: any) => p.name));
      const parameterBindings = this.emitParameterBindings(params, lines, bodyIndent, usage, usage.requiresPhpScope);
      this.currentParameterBindings = parameterBindings;
      this.currentPhpScopeRequired = usage.requiresPhpScope;
      const reboundVariables = this.collectReboundVariables(bodyNodes);
      for (const vName of scopeVars) {
        if (vName === "this" || this.isSuperglobal(vName)) continue;
        if (parameterNames.has(vName)) continue;
        const safeId = encodePhpIdentifier(vName);
        const variable = usage.requiresPhpScope ? `ctx.getPHPVar(${JSON.stringify(vName)})` : "new PHPVariable()";
        lines.push(`${bodyPad}${reboundVariables.has(vName) ? "let" : "const"} $v_${safeId} = ${variable};`);
      }

      this.transpileNodeList(bodyNodes, lines, lineMap, mapGen, filepath, bodyIndent, reflectedFunctionName, true);
    } finally {
      this.loopStack = savedLoopStack;
      this.currentFuncName = savedFuncName;
      this.currentParameterBindings = savedParameterBindings;
      this.currentPhpScopeRequired = savedPhpScopeRequired;
      this.currentNamespaceName = previousNamespaceName;
      this.currentNamespaceNameOriginal = previousNamespaceNameOriginal;
      this.classImports = previousImports;
      this.classImportsOriginal = previousImportsOriginal;
      this.insertClassCachePreamble(functionScope, lines, classCacheMarker, bodyIndent);
      this.transpileScopes.pop();
    }

    if (needsScope) {
      lines.push(`${pad}  } finally {`);
      lines.push(`${pad}    ctx.popScope();`);
      lines.push(`${pad}  }`);
    }
    lines.push(`${pad}};`);

    lines.push(`${pad}${binding.variable}[SYMBOL_PHP_META] = { name: ${JSON.stringify(reflectedFunctionName)}, visibility: ${JSON.stringify(visibility)}, numberOfParameters: ${params.length}, numberOfRequiredParameters: ${requiredCount}, parameters: ${JSON.stringify(params)} };`);
    lines.push(`${pad}ctx.functions[${JSON.stringify(functionKey)}] = ${binding.variable};`);
  }

  private normalizeScopeNodes(nodes: any): any[] {
    if (!nodes) return [];
    if (Array.isArray(nodes)) return nodes;
    if (nodes.kind === "block") return nodes.children || [];
    return [nodes];
  }

  private flattenNamespaceNodes(nodes: any): any[] {
    const flattened: any[] = [];
    for (const node of this.normalizeScopeNodes(nodes)) {
      if (node?.kind === "namespace") {
        flattened.push(...this.flattenNamespaceNodes(node.children || node.body));
      } else {
        flattened.push(node);
      }
    }
    return flattened;
  }

  private copyNamespaceContext(context: PHPNamespaceContext): PHPNamespaceContext {
    return {
      name: context.name,
      originalName: context.originalName,
      imports: Object.assign(Object.create(null), context.imports),
      importsOriginal: Object.assign(Object.create(null), context.importsOriginal),
    };
  }

  private getNamespaceContext(node: any): PHPNamespaceContext {
    return node?.[SYMBOL_TRANSPILE_NAMESPACE] || {
      name: this.currentNamespaceName,
      originalName: this.currentNamespaceNameOriginal,
      imports: this.classImports,
      importsOriginal: this.classImportsOriginal,
    };
  }

  private annotateNamespaceContexts(nodes: any): void {
    const annotateNode = (node: any, context: PHPNamespaceContext): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const child of node) annotateNode(child, context);
        return;
      }
      if (node.kind === "namespace") {
        const originalName = this.getConstName(node.name || node.namespace || "").replace(/^\\+/, "");
        const nestedContext: PHPNamespaceContext = {
          name: normalizePhpRegistryName(originalName),
          originalName,
          imports: Object.create(null),
          importsOriginal: Object.create(null),
        };
        Object.defineProperty(node, SYMBOL_TRANSPILE_NAMESPACE, {
          value: nestedContext,
          configurable: true,
        });
        annotateSequence(node.children || node.body, nestedContext);
        return;
      }

      Object.defineProperty(node, SYMBOL_TRANSPILE_NAMESPACE, {
        value: this.copyNamespaceContext(context),
        configurable: true,
      });
      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "parent" || key === "comments") continue;
        annotateNode(node[key], context);
      }
    };

    const annotateSequence = (sequence: any, initialContext: PHPNamespaceContext): void => {
      const context = this.copyNamespaceContext(initialContext);
      for (const node of this.normalizeScopeNodes(sequence)) {
        if (node?.kind === "namespace") {
          annotateNode(node, context);
          continue;
        }
        if (node?.kind === "use" || node?.kind === "usegroup") {
          Object.defineProperty(node, SYMBOL_TRANSPILE_NAMESPACE, {
            value: this.copyNamespaceContext(context),
            configurable: true,
          });
          for (const item of node.items || []) {
            const name = this.getConstName(item.name || item);
            const alias = item.alias ? this.getConstName(item.alias) : name.split("\\").pop() || name;
            context.imports[alias.toLowerCase()] = normalizePhpRegistryName(name);
            context.importsOriginal[alias.toLowerCase()] = name;
          }
          continue;
        }
        annotateNode(node, context);
      }
    };

    annotateSequence(nodes, {
      name: "",
      originalName: "",
      imports: Object.create(null),
      importsOriginal: Object.create(null),
    });
  }

  private encodePhpQualifiedIdentifier(name: string): string {
    return name.split("$$").map((part) => encodePhpIdentifier(part)).join("$$");
  }

  private functionDeclarationName(node: any): { key: string; name: string } | undefined {
    if (node?.kind !== "function") return undefined;
    const shortName = this.getConstName(node.name?.name || node.name || "");
    if (!shortName) return undefined;
    const namespace = this.getNamespaceContext(node);
    const localName = shortName.toLowerCase();
    const key = namespace.name ? `${namespace.name}$$${localName}` : localName;
    const name = namespace.originalName ? `${namespace.originalName}\\${shortName}` : shortName;
    return { key, name };
  }

  private findFunctionBinding(name: string, scope = this.transpileScopes[this.transpileScopes.length - 1]): PHPFunctionBinding | undefined {
    for (let current = scope; current; current = current.parent) {
      const binding = current.functionBindings[name.toLowerCase()];
      if (binding) return binding;
    }
    return undefined;
  }

  private findClassCache(name: string, scope = this.transpileScopes[this.transpileScopes.length - 1]): string | undefined {
    for (let current = scope; current; current = current.parent) {
      const cached = current.classCaches[name.toLowerCase()];
      if (cached) return cached;
    }
    return undefined;
  }

  private collectDirectClassBindings(nodes: any, bindings: Record<string, string>, namespace = this.currentNamespaceName): void {
    for (const node of this.normalizeScopeNodes(nodes)) {
      if (node?.kind === "namespace") {
        const declaredNamespace = normalizePhpRegistryName(this.getConstName(node.name || node.namespace || ""));
        this.collectDirectClassBindings(node.children || node.body, bindings, declaredNamespace);
        continue;
      }
      if (node?.kind !== "class" && node?.kind !== "interface") continue;
      const name = this.getConstName(node.name?.name || node.name || "");
      if (!name || node.isAnonymous) continue;
      const qualifiedName = namespace ? `${namespace}$$${name.toLowerCase()}` : name.toLowerCase();
      const variable = node.kind === "interface"
        ? `__iface_${this.encodePhpQualifiedIdentifier(qualifiedName)}`
        : `__cls_${this.encodePhpQualifiedIdentifier(qualifiedName)}`;
      bindings[qualifiedName] = variable;
    }
  }

  private collectConditionalClassBindings(
    nodes: any,
    bindings: Record<string, string>,
    conditionalBindings: Set<string>,
    namespace = this.currentNamespaceName,
    nested = false
  ): void {
    for (const node of this.normalizeScopeNodes(nodes)) {
      if (node?.kind === "namespace") {
        const declaredNamespace = normalizePhpRegistryName(this.getConstName(node.name || node.namespace || ""));
        this.collectConditionalClassBindings(node.children || node.body, bindings, conditionalBindings, declaredNamespace, nested);
        continue;
      }
      if (!node || typeof node !== "object") continue;
      if (node.kind === "class" || node.kind === "interface") {
        const name = this.getConstName(node.name?.name || node.name || "");
        if (nested && name && !node.isAnonymous) {
          const qualifiedName = namespace ? `${namespace}$$${name.toLowerCase()}` : name.toLowerCase();
          bindings[qualifiedName] = node.kind === "interface"
            ? `__iface_${this.encodePhpQualifiedIdentifier(qualifiedName)}`
            : `__cls_${this.encodePhpQualifiedIdentifier(qualifiedName)}`;
          conditionalBindings.add(qualifiedName);
        }
        continue;
      }
      if (["function", "method", "trait", "closure", "arrowfunc"].includes(node.kind)) continue;
      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "parent" || key === "comments") continue;
        const child = node[key];
        if (child && typeof child === "object") {
          this.collectConditionalClassBindings(child, bindings, conditionalBindings, namespace, true);
        }
      }
    }
  }

  private isConditionalClassBinding(name: string, scope = this.transpileScopes[this.transpileScopes.length - 1]): boolean {
    for (let current = scope; current; current = current.parent) {
      if (current.conditionalClassBindings.has(name.toLowerCase())) return true;
      if (Object.hasOwn(current.classBindings, name.toLowerCase())) return false;
    }
    return false;
  }

  private findFunctionCache(name: string, scope = this.transpileScopes[this.transpileScopes.length - 1]): string | undefined {
    for (let current = scope; current; current = current.parent) {
      const cached = current.functionCaches[name.toLowerCase()];
      if (cached) return cached;
    }
    return undefined;
  }

  private findFunctionCacheKind(name: string, scope = this.transpileScopes[this.transpileScopes.length - 1]): "constant" | "lazy" | undefined {
    for (let current = scope; current; current = current.parent) {
      if (current.functionCaches[name.toLowerCase()]) return current.functionCacheKinds[name.toLowerCase()];
    }
    return undefined;
  }

  private findClassBinding(name: string, scope = this.transpileScopes[this.transpileScopes.length - 1]): string | undefined {
    for (let current = scope; current; current = current.parent) {
      const binding = current.classBindings[name.toLowerCase()];
      if (binding) return binding;
    }
    return undefined;
  }

  private getStaticFunctionCall(node: any): { key: string; name: string; fallbackName?: string } | undefined {
    if (node?.kind !== "call") return undefined;
    const what = node.what;
    if (!what || ["variable", "propertylookup", "nullsafepropertylookup", "staticlookup"].includes(what.kind)) return undefined;
    const name = this.getConstName(what);
    if (!name) return undefined;
    const namespace = this.getNamespaceContext(node);
    const isFullyQualified = name.startsWith("\\") || what.resolution === "fqn";
    const normalizedName = normalizePhpRegistryName(name);
    const isUnqualified = !isFullyQualified && !name.includes("\\");
    const key = isFullyQualified
      ? normalizedName
      : namespace.name
      ? `${namespace.name}$$${normalizedName}`
      : normalizedName;
    const fallbackName = namespace.name && isUnqualified ? normalizedName : undefined;
    if (["include", "include_once", "require", "require_once"].includes(normalizedName)) return undefined;
    const originalName = name.replace(/^\\+/, "");
    return {
      key,
      name: namespace.originalName && isUnqualified ? `${namespace.originalName}\\${originalName}` : originalName,
      fallbackName,
    };
  }

  private collectDirectFunctionCalls(nodes: any): Record<string, { name: string; fallbackName?: string; count: number }> {
    const calls: Record<string, { name: string; fallbackName?: string; count: number }> = Object.create(null);
    const visit = (value: any): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      if (["function", "method", "class", "interface", "trait", "closure", "arrowfunc"].includes(value.kind)) return;

      const call = this.getStaticFunctionCall(value);
      if (call) {
        const existing = calls[call.key];
        if (existing) existing.count++;
        else calls[call.key] = { name: call.name, fallbackName: call.fallbackName, count: 1 };
      }
      if (value.kind === "exit" || value.kind === "die") {
        if (calls.exit) calls.exit.count++;
        else calls.exit = { name: "exit", count: 1 };
      }

      const visitKeys = (keys: string[]) => {
        for (const key of keys) visit(value[key]);
      };

      switch (value.kind) {
        case "namespace":
          visit(value.children || value.body);
          return;
        case "if":
          visitKeys(["test", "condition"]);
          if (value.alternate?.kind === "if") visit(value.alternate);
          return;
        case "while":
        case "do":
          visitKeys(["test", "condition"]);
          return;
        case "for":
          visitKeys(["init", "test", "increment"]);
          return;
        case "foreach":
          visitKeys(["source", "what", "expr"]);
          return;
        case "switch":
          visit(value.test);
          for (const caseNode of value.body?.children || value.body || value.children || []) {
            visit(caseNode.test);
          }
          return;
        case "try":
          return;
        case "block":
          return;
        default:
          for (const key of Object.keys(value)) {
            if (key === "loc" || key === "parent" || key === "comments") continue;
            visit(value[key]);
          }
      }
    };
    visit(this.flattenNamespaceNodes(nodes));
    return calls;
  }

  private collectStringArgumentLiterals(nodes: any): Record<string, string> {
    const literals: Record<string, string> = Object.create(null);
    const addArguments = (args: any[]): void => {
      for (const argument of args || []) {
        let value = argument;
        while (value?.kind === "parenthesis" || value?.kind === "parentheses") {
          value = value.inner || value.expr || value.value || value.what;
        }
        if (value?.kind !== "string" || typeof value.value !== "string") continue;
        const key = JSON.stringify(value.value);
        if (!Object.hasOwn(literals, key)) {
          literals[key] = `__strlit_${encodePhpIdentifier(value.value)}`;
        }
      }
    };
    const visit = (node: any): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const child of node) visit(child);
        return;
      }
      if (node.kind === "call" || node.kind === "new") addArguments(node.arguments || []);
      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "parent" || key === "comments") continue;
        visit(node[key]);
      }
    };
    visit(nodes);
    return literals;
  }

  private scopeMayRegisterFunctions(nodes: any): boolean {
    let mayRegister = false;
    const visit = (value: any): void => {
      if (!value || typeof value !== "object" || mayRegister) return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      if (["function", "method", "class", "interface", "trait", "closure", "arrowfunc"].includes(value.kind)) return;
      if (value.kind === "include") {
        mayRegister = true;
        return;
      }
      if (value.kind === "call") {
        const name = normalizePhpRegistryName(this.getConstName(value.what));
        if (name === "eval" || name === "include" || name === "include_once" || name === "require" || name === "require_once") {
          mayRegister = true;
          return;
        }
      }
      for (const key of Object.keys(value)) {
        if (key === "loc" || key === "parent" || key === "comments") continue;
        visit(value[key]);
      }
    };
    visit(nodes);
    return mayRegister;
  }

  private collectConditionalFunctionDeclarations(nodes: any): Record<string, any[]> {
    const declarations: Record<string, any[]> = Object.create(null);
    const visit = (value: any, direct: boolean): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item, false);
        return;
      }

      const declaration = this.functionDeclarationName(value);
      if (declaration) {
        if (!direct) {
          const items = declarations[declaration.key] || [];
          items.push(value);
          declarations[declaration.key] = items;
        }
        return;
      }
      if (["method", "class", "interface", "trait", "closure", "arrowfunc"].includes(value.kind)) return;
      if (value.kind === "namespace") {
        for (const item of this.flattenNamespaceNodes(value.children || value.body)) visit(item, direct);
        return;
      }
      for (const key of Object.keys(value)) {
        if (key === "loc" || key === "parent" || key === "comments") continue;
        visit(value[key], false);
      }
    };

    for (const node of this.flattenNamespaceNodes(nodes)) {
      if (this.functionDeclarationName(node)) continue;
      visit(node, false);
    }
    return declarations;
  }

  private requiresFunctionFallback(nodes: any, functionName: string): boolean {
    type Flow = { defined: boolean; missingCall: boolean };
    const functionKey = functionName.toLowerCase();

    const analyze = (input: any, initiallyDefined: boolean): Flow => {
      const list = this.flattenNamespaceNodes(input);
      let defined = initiallyDefined || list.some((node) => this.functionDeclarationName(node)?.key === functionKey);
        let missingCall = false;

      for (const node of list) {
          if (!node) continue;
          if (this.functionDeclarationName(node)?.key === functionKey) {
            defined = true;
            continue;
          }
          if (Object.hasOwn(this.collectDirectFunctionCalls([node]), functionKey) && !defined) missingCall = true;

        if (node.kind === "if") {
          const body = analyze(node.body?.children || node.body, defined);
          const alternate = node.alternate
            ? analyze(node.alternate.kind === "if" ? [node.alternate] : (node.alternate.children || node.alternate), defined)
            : { defined, missingCall: false };
          missingCall ||= body.missingCall || alternate.missingCall;
          defined = body.defined && alternate.defined;
          continue;
        }

        if (node.kind === "while" || node.kind === "do" || node.kind === "for" || node.kind === "foreach") {
          const body = analyze(node.body?.children || node.body, defined);
          missingCall ||= body.missingCall;
          continue;
        }

        if (node.kind === "switch") {
          const cases = node.body?.children || node.body || node.children || [];
          let everyCaseDefines = cases.length > 0;
          let hasDefault = false;
          for (const caseNode of cases) {
            hasDefault ||= !caseNode.test;
            const result = analyze(caseNode.body?.children || caseNode.body || caseNode.children || [], defined);
            missingCall ||= result.missingCall;
            everyCaseDefines &&= result.defined;
          }
          defined = everyCaseDefines && hasDefault;
          continue;
        }

        if (node.kind === "try") {
          const branches = [analyze(node.body?.children || node.body, defined)];
          for (const catchNode of node.catches || []) {
            branches.push(analyze(catchNode.body?.children || catchNode.body, defined));
          }
          missingCall ||= branches.some((branch) => branch.missingCall);
          if (branches.length > 1) defined = branches.every((branch) => branch.defined);
        }
      }

      return { defined, missingCall };
    };

    return analyze(nodes, false).missingCall;
  }

  private createTranspileScope(nodes: any): TranspileScope {
    const parent = this.transpileScopes[this.transpileScopes.length - 1];
    const scope: TranspileScope = {
      id: ++this.transpileScopeId,
      parent,
      functionBindings: Object.create(null),
      functionCaches: Object.create(null),
      functionCacheKinds: Object.create(null),
      functionCacheNames: Object.create(null),
      functionCacheFallbacks: Object.create(null),
      directFunctionDeclarations: Object.create(null),
      conditionalFunctionDeclarations: Object.create(null),
      functionFallbacks: new Set(),
      classBindings: Object.create(null),
      conditionalClassBindings: new Set(),
      predeclaredClassBindings: new Set(),
      classCaches: Object.create(null),
    };

    const flatNodes = this.flattenNamespaceNodes(nodes);
    for (const node of flatNodes) {
      const declaration = this.functionDeclarationName(node);
      if (declaration && !Object.hasOwn(scope.directFunctionDeclarations, declaration.key)) {
        scope.directFunctionDeclarations[declaration.key] = node;
      }
    }
    this.collectDirectClassBindings(nodes, scope.classBindings);
    this.collectConditionalClassBindings(nodes, scope.classBindings, scope.conditionalClassBindings);
    for (const name of Object.keys(scope.classBindings)) {
      if (this.isConditionalClassBinding(name, parent)) {
        scope.conditionalClassBindings.add(name);
        scope.predeclaredClassBindings.add(name);
      }
    }
    scope.conditionalFunctionDeclarations = this.collectConditionalFunctionDeclarations(flatNodes);

    for (const [name, node] of Object.entries(scope.directFunctionDeclarations)) {
      const inherited = this.findFunctionBinding(name, parent);
      if (inherited?.kind === "conditional") {
        scope.functionBindings[name] = inherited;
      } else {
        scope.functionBindings[name] = {
          variable: `__fn_${this.encodePhpQualifiedIdentifier(name)}`,
          scopeId: scope.id,
          kind: "direct",
        };
      }
      scope.directFunctionDeclarations[name] = node;
    }

    for (const name of Object.keys(scope.conditionalFunctionDeclarations)) {
      if (Object.hasOwn(scope.functionBindings, name) || this.findFunctionBinding(name, parent)) continue;
      scope.functionBindings[name] = {
        variable: `__fn_${this.encodePhpQualifiedIdentifier(name)}`,
        scopeId: scope.id,
        kind: "conditional",
      };
      if (this.requiresFunctionFallback(flatNodes, name)) scope.functionFallbacks.add(name);
    }

    const callsMayChange = this.scopeMayRegisterFunctions(flatNodes);
    for (const [name, call] of Object.entries(this.collectDirectFunctionCalls(flatNodes))) {
      if (this.findFunctionBinding(name, scope)) continue;
      if (this.findFunctionCache(name, parent)) continue;
      if (call.fallbackName && this.findFunctionBinding(call.fallbackName, scope)) continue;
      if (call.count < 2) continue;
      scope.functionCaches[name] = `__fn_${this.encodePhpQualifiedIdentifier(name)}`;
      scope.functionCacheKinds[name] = callsMayChange ? "lazy" : "constant";
      scope.functionCacheNames[name] = call.name;
      if (call.fallbackName) scope.functionCacheFallbacks[name] = call.fallbackName;
    }

    return scope;
  }

  private functionParameterList(params: Array<{ name: string; variadic?: boolean }>): string {
    const parameters = params.map((param) => {
      const name = `$arg_${encodePhpIdentifier(param.name)}`;
      return `${param.variadic ? "..." : ""}${name}`;
    });
    return ["ctx", ...parameters].join(", ");
  }

  private functionCallTarget(name: string, originalName = name, fallbackName?: string): string {
    const candidates = [JSON.stringify(name)];
    if (fallbackName) candidates.push(JSON.stringify(fallbackName));
    candidates.push(`ctx.functionMissing(${JSON.stringify(originalName)})`);
    const binding = this.findFunctionBinding(name);
    if (binding) return binding.variable;
    const cached = this.findFunctionCache(name);
    if (cached) {
      if (this.findFunctionCacheKind(name) === "constant") return cached;
      const fallback = fallbackName ? ` ?? ctx.functions[${candidates[1]}]` : "";
      return `((${cached} ??= (ctx.functions[${candidates[0]}]${fallback})) ?? ${candidates[candidates.length - 1]})`;
    }
    const fallbackBinding = fallbackName ? this.findFunctionBinding(fallbackName) : undefined;
    return `(ctx.functions[${candidates[0]}]${fallbackName ? ` ?? ${fallbackBinding?.variable || `ctx.functions[${candidates[1]}]`}` : ""} ?? ${candidates[candidates.length - 1]})`;
  }

  private phpVariableReference(name: string): string {
    const binding = this.currentParameterBindings[name];
    if (binding) return binding.referenceExpression || `$arg_${encodePhpIdentifier(name)}`;
    return `$v_${encodePhpIdentifier(name)}`;
  }

  private phpVariableValue(name: string): string {
    return this.currentParameterBindings[name]?.readExpression || `(await $v_${encodePhpIdentifier(name)}.get())`;
  }

  private directReferenceExpression(node: any, filepath: string): string | undefined {
    while (node?.kind === "parenthesis" || node?.kind === "parentheses" || node?.kind === "byref" || node?.kind === "reference") {
      node = node.inner || node.what || node.expr || node.value;
    }

    if (node?.kind === "variable") {
      const name = this.getConstName(node.name || node);
      if (name === "this") return undefined;
      return this.isSuperglobal(name)
        ? `ctx.getPHPVar(${JSON.stringify(name)})`
        : this.phpVariableReference(name);
    }

    if (node?.kind === "propertylookup" && this.hasDirectPhpProperty(node.what, node.offset)) {
      return this.propertyAccessExpression(this.transpileExpr(node.what, filepath), node.offset, filepath);
    }

    if (node?.kind === "staticlookup") {
      const member = this.getConstName(node.offset);
      const isStaticProperty = node.offset?.kind === "variable" || node.offset?.kind === "property" || member.startsWith("$");
      if (isStaticProperty) {
        return this.propertyAccessExpression(this.transpileClassValue(node.what, filepath), node.offset, filepath, true);
      }
    }

    return undefined;
  }

  private emitParameterBindings(
    params: Array<{ name: string; byref?: boolean; variadic?: boolean; hasDefault?: boolean; defaultValue?: string }>,
    lines: string[],
    indent: number,
    usage: PHPFunctionUsage,
    needsPhpScope = usage.requiresPhpScope
  ): Record<string, PHPParameterBinding> {
    const pad = " ".repeat(indent);
    const bindings: Record<string, PHPParameterBinding> = Object.create(null);
    for (const param of params) {
      const safeName = encodePhpIdentifier(param.name);
      const argument = `$arg_${safeName}`;
      const paramUsage = usage.parameters[param.name] || {
        read: false,
        readCount: 0,
        needsReference: false,
        rebindsReference: false,
        passThroughReference: false,
        requiresScopeBinding: false,
      };
      const declaration = paramUsage.rebindsReference ? "let" : "const";
      const needsLocalReference = paramUsage.needsReference || (Boolean(param.hasDefault) && paramUsage.passThroughReference);
      const value = param.variadic
        ? argument
        : param.hasDefault
        ? `(${argument} === undefined ? ${param.defaultValue} : ${argument})`
        : argument;
      const localReference = `$v_${safeName}`;

      const bindInContext = needsPhpScope && (usage.requiresAllParametersInScope || paramUsage.requiresScopeBinding);
      if (bindInContext) {
        lines.push(`${pad}${declaration} ${localReference} = await ctx.argPHPVar(${JSON.stringify(param.name)}, ${value}, ${Boolean(param.byref)}, ${Boolean(param.variadic)});`);
        bindings[param.name] = {
          readExpression: `(await ${localReference}.get())`,
          referenceExpression: localReference,
        };
        continue;
      }

      if (param.variadic && (paramUsage.read || paramUsage.needsReference)) {
        lines.push(`${pad}${declaration} ${localReference} = await ctx.argPHPVar(${JSON.stringify(param.name)}, ${value}, ${Boolean(param.byref)}, true);`);
        bindings[param.name] = {
          readExpression: `(await ${localReference}.get())`,
          referenceExpression: localReference,
        };
        continue;
      }

      if (param.byref) {
        let referenceExpression = argument;
        if (param.hasDefault) {
          lines.push(`${pad}${paramUsage.rebindsReference ? "let" : "const"} ${localReference} = new PHPVariable();`);
          lines.push(`${pad}await ${localReference}.set(${value});`);
          referenceExpression = localReference;
        } else if (paramUsage.rebindsReference) {
          lines.push(`${pad}let ${localReference} = ${argument};`);
          referenceExpression = localReference;
        }
        bindings[param.name] = {
          readExpression: referenceExpression === argument
            ? `(await ctx.toVal(${argument}))`
            : `(await ${referenceExpression}.get())`,
          referenceExpression,
        };
        continue;
      }

      if (needsLocalReference) {
        lines.push(`${pad}${declaration} ${localReference} = new PHPVariable();`);
        lines.push(`${pad}await ${localReference}.set(${value});`);
        bindings[param.name] = {
          readExpression: `(await ${localReference}.get())`,
          referenceExpression: localReference,
        };
        continue;
      }

      if ((paramUsage.read && paramUsage.readCount > 1) || param.hasDefault) {
        lines.push(`${pad}const ${localReference} = await ctx.toVal(${value});`);
        bindings[param.name] = {
          readExpression: localReference,
          referenceExpression: paramUsage.passThroughReference ? argument : undefined,
        };
        continue;
      }

      if (paramUsage.read) {
        bindings[param.name] = {
          readExpression: `(await ctx.toVal(${argument}))`,
          referenceExpression: paramUsage.passThroughReference ? argument : undefined,
        };
        continue;
      }

      if (paramUsage.passThroughReference) {
        bindings[param.name] = {
          readExpression: `(await ctx.toVal(${argument}))`,
          referenceExpression: argument,
        };
      }
    }
    return bindings;
  }

  private emitScopePreamble(
    scope: TranspileScope,
    lines: string[],
    lineMap: Record<number, any>,
    mapGen: SourceMapGenerator | null,
    filepath: string,
    indent: number
  ): void {
    const pad = " ".repeat(indent);
    for (const name of scope.conditionalClassBindings) {
      if (!scope.predeclaredClassBindings.has(name)) {
        lines.push(`${pad}let ${scope.classBindings[name]};`);
      }
    }
    for (const [name, cachedName] of Object.entries(scope.functionCaches)) {
      if (scope.functionCacheKinds[name] === "constant") {
        const originalName = scope.functionCacheNames[name] || name;
        const fallbackName = scope.functionCacheFallbacks[name];
        lines.push(`${pad}const ${cachedName} = (ctx.functions[${JSON.stringify(name)}]${fallbackName ? ` ?? ctx.functions[${JSON.stringify(fallbackName)}]` : ""} ?? ctx.functionMissing(${JSON.stringify(originalName)}));`);
      } else {
        lines.push(`${pad}let ${cachedName};`);
      }
    }

    for (const [name, binding] of Object.entries(scope.functionBindings)) {
      if (binding.scopeId !== scope.id || binding.kind !== "conditional") continue;
      const originalName = scope.conditionalFunctionDeclarations[name]?.[0]
        ? this.functionDeclarationName(scope.conditionalFunctionDeclarations[name][0])?.name || name
        : name;
      const fallback = scope.functionFallbacks.has(name)
        ? ` = ctx.functionMissing(${JSON.stringify(originalName)})`
        : "";
      lines.push(`${pad}let ${binding.variable}${fallback};`);
    }

    for (const [name, node] of Object.entries(scope.directFunctionDeclarations)) {
      const binding = this.findFunctionBinding(name, scope);
      if (binding?.scopeId === scope.id) this.transpileFunctionNode(node, lines, lineMap, mapGen || new SourceMapGenerator(), filepath, indent, binding);
    }
  }

  private insertClassCachePreamble(scope: TranspileScope, lines: string[], marker: number, indent: number): void {
    const pad = " ".repeat(indent);
    const declarations = Object.values(scope.classCaches).map((variable) => `${pad}let ${variable};`);
    lines.splice(marker, 1, ...declarations);
  }

  private transpileNodeList(
    nodes: any[],
    lines: string[],
    lineMap: Record<number, any>,
    mapGen: SourceMapGenerator,
    filepath: string,
    indent: number,
    currentFunc: string,
    reuseCurrentScope = false
  ): void {
    if (!nodes) return;
    const nodeList = Array.isArray(nodes) ? nodes : [nodes];
    let scope: TranspileScope | undefined;
    let classCacheMarker = -1;
    if (!reuseCurrentScope) {
      scope = this.createTranspileScope(nodeList);
      this.transpileScopes.push(scope);
      classCacheMarker = lines.length;
      lines.push("");
      this.emitScopePreamble(scope, lines, lineMap, mapGen, filepath, indent);
    }

    try {
      for (const node of nodeList) {
        if (!node) continue;
        if (node.kind === "function") {
          const declaration = this.functionDeclarationName(node);
          const binding = declaration ? this.findFunctionBinding(declaration.key) : undefined;
          if (scope && binding && binding.scopeId !== scope.id) {
            this.transpileFunctionNode(node, lines, lineMap, mapGen, filepath, indent, binding);
          }
          continue;
        }
        const startLine = lines.length + 1;
        this.transpileStmt(node, lines, lineMap, mapGen, filepath, indent);
        const endLine = lines.length;

        const phpLine = node.loc?.start?.line;
        if (phpLine && mapGen) {
          for (let l = startLine; l <= endLine; l++) {
            mapGen.addMapping({
              generated: { line: l, column: 0 },
              original: { line: phpLine, column: 0 },
              source: filepath,
              name: currentFunc,
            });
          }
        }
      }
    } finally {
      if (scope) {
        this.insertClassCachePreamble(scope, lines, classCacheMarker, indent);
        this.transpileScopes.pop();
      }
    }
  }

  private transpileStmt(
    node: any,
    lines: string[],
    lineMap: Record<number, any>,
    mapGen: SourceMapGenerator,
    filepath: string,
    indent: number
  ): void {
    const pad = " ".repeat(indent);
    if (!node || typeof node !== "object") return;

    switch (node.kind) {
      case "inline": {
        lines.push(`${pad}await ctx.echo(${JSON.stringify(node.value || node.raw)});`);
        break;
      }

      case "namespace": {
        const previousNamespaceName = this.currentNamespaceName;
        const previousNamespaceNameOriginal = this.currentNamespaceNameOriginal;
        const previousImports = this.classImports;
        const previousImportsOriginal = this.classImportsOriginal;
        const namespace = this.getNamespaceContext(node);
        this.currentNamespaceName = namespace.name;
        this.currentNamespaceNameOriginal = namespace.originalName;
        this.classImports = Object.assign(Object.create(null), namespace.imports);
        this.classImportsOriginal = Object.assign(Object.create(null), namespace.importsOriginal);
        const children = node.children || node.body || [];
        try {
          this.transpileNodeList(children, lines, lineMap, mapGen, filepath, indent, "{main}", true);
        } finally {
          this.currentNamespaceName = previousNamespaceName;
          this.currentNamespaceNameOriginal = previousNamespaceNameOriginal;
          this.classImports = previousImports;
          this.classImportsOriginal = previousImportsOriginal;
        }
        break;
      }

      case "usegroup": {
        for (const item of node.items || []) {
          const importedName = this.getConstName(item.name || item);
          const alias = this.getConstName(item.alias) || importedName.split("\\").pop()!;
          this.classImports[alias.toLowerCase()] = normalizePhpRegistryName(importedName);
          this.classImportsOriginal[alias.toLowerCase()] = importedName;
        }
        break;
      }

      case "echo":
      case "print": {
        const expressions = (node.arguments || node.expressions || [node.value || node.expr]).map((e: any) =>
          this.transpileExpr(e, filepath)
        );
        lines.push(`${pad}await ctx.echo(${expressions.join(" + ")});`);
        break;
      }

      case "if": {
        const cond = this.transpileExpr(node.test, filepath);
        lines.push(`${pad}if (await ctx.isTruthy(${cond})) {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");

        if (node.alternate) {
          if (node.alternate.kind === "if") {
            lines.push(`${pad}} else`);
            this.transpileStmt(node.alternate, lines, lineMap, mapGen, filepath, indent);
          } else {
            lines.push(`${pad}} else {`);
            this.transpileNodeList(node.alternate?.children || node.alternate, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
            lines.push(`${pad}}`);
          }
        } else {
          lines.push(`${pad}}`);
        }
        break;
      }

      case "while": {
        const label = `lp_${++this.loopLabelCounter}`;
        this.loopStack.push({ label, type: "loop" });
        try {
          const cond = this.transpileExpr(node.test, filepath);
          lines.push(`${pad}${label}: while (await ctx.isTruthy(${cond})) {`);
          this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
          lines.push(`${pad}}`);
        } finally {
          this.loopStack.pop();
        }
        break;
      }

      case "do": {
        const label = `lp_${++this.loopLabelCounter}`;
        this.loopStack.push({ label, type: "loop" });
        try {
          const cond = this.transpileExpr(node.test, filepath);
          lines.push(`${pad}${label}: do {`);
          this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
          lines.push(`${pad}} while (await ctx.isTruthy(${cond}));`);
        } finally {
          this.loopStack.pop();
        }
        break;
      }

      case "for": {
        const label = `lp_${++this.loopLabelCounter}`;
        this.loopStack.push({ label, type: "loop" });
        try {
          const init = (node.init || []).map((e: any) => this.transpileExpr(e, filepath)).join(", ");
          const test = (node.test || []).map((e: any) => this.transpileExpr(e, filepath)).join(" && ") || "true";
          const increment = (node.increment || []).map((e: any) => this.transpileExpr(e, filepath)).join(", ");

          if (init) lines.push(`${pad}${init};`);
          lines.push(`${pad}${label}: while (await ctx.isTruthy(${test})) {`);
          this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
          if (increment) lines.push(`${pad}  ${increment};`);
          lines.push(`${pad}}`);
        } finally {
          this.loopStack.pop();
        }
        break;
      }

      case "foreach": {
        const label = `fe_${++this.loopLabelCounter}`;
        this.loopStack.push({ label, type: "loop" });
        try {
          const source = this.transpileExpr(node.source || node.what || node.expr, filepath);
          const keyNode = node.key;
          let valNode = node.value;

          let isByRefVal = false;
          if (valNode?.kind === "byref" || valNode?.byref || valNode?.byRef) {
            isByRefVal = true;
            valNode = valNode.what || valNode.expr || valNode.value || valNode;
          }

          let setKeyLine = "";
          if (keyNode) {
            setKeyLine = (this.transpileExpr({ kind: "assign", left: keyNode, right: { kind: "raw", code: "__k" } }, filepath)) + ";";
          }

          let setValLine = "";
          if (valNode) {
            if (isByRefVal) {
              setValLine = (this.transpileExpr({ kind: "assignref", left: valNode, right: { kind: "raw", code: `new PHPArrayOffsetReference(__src_val_${label}, __k)` } }, filepath)) + ";";
            } else {
              setValLine = (this.transpileExpr({ kind: "assign", left: valNode, right: { kind: "raw", code: "__entry_val" } }, filepath)) + ";";
            }
          }

          lines.push(`${pad}const __src_val_${label} = ${source};`);
          lines.push(`${pad}const __src_${label} = __src_val_${label} instanceof PHPReference ? __src_val_${label}.get() : __src_val_${label};`);
          lines.push(`${pad}const __entries_${label} = (typeof __src_${label} === "object" && __src_${label} !== null) ? Object.entries(__src_${label}) : [];`);
          lines.push(`${pad}${label}: for (const [__raw_k, __entry_val] of __entries_${label}) {`);
          lines.push(`${pad}  if (__entry_val === undefined && Array.isArray(__src_${label})) continue;`);
          lines.push(`${pad}  const __k = (!isNaN(Number(__raw_k)) && String(Number(__raw_k)) === String(__raw_k)) ? Number(__raw_k) : __raw_k;`);
          if (setKeyLine) lines.push(`${pad}  ${setKeyLine}`);
          if (setValLine) lines.push(`${pad}  ${setValLine}`);
          this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
          lines.push(`${pad}}`);
        } finally {
          this.loopStack.pop();
        }
        break;
      }

      case "switch": {
        const label = `sw_${++this.switchLabelCounter}`;
        this.loopStack.push({ label, type: "switch" });
        try {
          const test = this.transpileExpr(node.test, filepath);
          lines.push(`${pad}${label}: {`);
          lines.push(`${pad}  const __sw = ${test};`);
          lines.push(`${pad}  let __matched = false;`);
          const caseNodes = node.body?.children || node.body || node.children || [];
          for (const caseNode of caseNodes) {
            if (caseNode.test) {
              const caseVal = this.transpileExpr(caseNode.test, filepath);
              lines.push(`${pad}  if (__matched || __sw == ${caseVal}) {`);
              lines.push(`${pad}    __matched = true;`);
            } else {
              lines.push(`${pad}  if (__matched || true) {`);
              lines.push(`${pad}    __matched = true;`);
            }
            this.transpileNodeList(caseNode.body?.children || caseNode.body || caseNode.children || [], lines, lineMap, mapGen, filepath, indent + 4, "{main}");
            lines.push(`${pad}  }`);
          }
          lines.push(`${pad}}`);
        } finally {
          this.loopStack.pop();
        }
        break;
      }

      case "return": {
        const value = node.expr ? this.transpileExpr(node.expr, filepath) : "undefined";
        lines.push(`${pad}return ${value};`);
        break;
      }

      case "global": {
        for (const v of node.items || []) {
          const varName = this.getConstName(v.name || v);
          if (varName !== "GLOBALS" && !this.isSuperglobal(varName)) {
            lines.push(`${pad}${this.phpVariableReference(varName)} = ctx.bindGlobal(${JSON.stringify(varName)});`);
          } else {
            lines.push(`${pad}ctx.bindGlobal(${JSON.stringify(varName)});`);
          }
        }
        break;
      }

      case "static": {
        const scopeKey = this.currentClassName ? `${this.currentClassName}::${this.currentFuncName}` : (this.currentFuncName || "{main}");
        for (const v of node.result || node.items || node.variables || []) {
          const varName = this.getConstName(v.variable?.name || v.variable || v.name || v);
          const valueNode = v.defaultValue || v.value;
          const value = valueNode ? this.transpileExpr(valueNode, filepath) : "undefined";
          lines.push(`${pad}${this.phpVariableReference(varName)} = ctx.initStaticVar(${JSON.stringify(scopeKey)}, ${JSON.stringify(varName)}, ${value});`);
        }
        break;
      }

      case "unset": {
        for (const v of node.variables || node.expressions || []) {
          if (v.kind === "variable") {
            const varName = this.getConstName(v.name || v);
            const reference = this.phpVariableReference(varName);
            lines.push(this.currentPhpScopeRequired
              ? `${pad}ctx.unsetVar(${JSON.stringify(varName)}); ${reference} = ctx.getPHPVar(${JSON.stringify(varName)});`
              : `${pad}${reference} = new PHPVariable();`);
          } else if (v.kind === "offsetlookup") {
            const offsets: string[] = [];
            let current = v;
            while (current?.kind === "offsetlookup") {
              offsets.unshift(current.offset ? this.transpileExpr(current.offset, filepath) : "null");
              current = current.what;
            }
            if (current?.kind === "propertylookup") {
              const obj = this.transpileExpr(current.what, filepath);
              const prop = this.transpilePropertyOffset(current.offset, filepath);
              lines.push(`${pad}await ctx.unsetPropertyOffsets(${obj}, ${prop}, [${offsets.join(", ")}]);`);
            } else {
              const varName = this.getConstName(current);
              if (varName && typeof varName === "string") {
                lines.push(`${pad}await ctx.unsetVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}]);`);
              } else {
                const obj = this.transpileExpr(current, filepath);
                lines.push(`${pad}if ((${obj}) !== undefined && (${obj}) !== null) { let __t = ${obj}; for (let i = 0; i < ${offsets.length} - 1; i++) { __t = __t[ [${offsets.join(", ")}][i] ]; if (!__t) break; } if (__t) delete __t[ [${offsets.join(", ")}][${offsets.length - 1}] ]; }`);
              }
            }
          } else if (v.kind === "propertylookup") {
            const obj = this.transpileExpr(v.what, filepath);
            const prop = this.transpilePropertyOffset(v.offset, filepath);
            if (this.hasDirectPhpProperty(v.what, v.offset)) {
              lines.push(`${pad}await (${obj})[${prop}].unset();`);
            } else {
              lines.push(`${pad}await (await ctx.getPropertyReference(${obj}, ${prop})).unset();`);
            }
          }
        }
        break;
      }

      case "try": {
        lines.push(`${pad}try {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
        lines.push(`${pad}} catch (__err) {`);
        lines.push(`${pad}  const __php_err = PHPError.wrapJSError(__err);`);

        for (const catchNode of node.catches || []) {
          const catchVar = this.getConstName(catchNode.variable) || "e";
          lines.push(`${pad}  await ctx.setVar(${JSON.stringify(catchVar)}, __php_err);`);
          this.transpileNodeList(catchNode.body?.children || catchNode.body, lines, lineMap, mapGen, filepath, indent + 4, "{main}");
        }

        if (node.always) {
          lines.push(`${pad}} finally {`);
          this.transpileNodeList(node.always?.children || node.always, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
        }
        lines.push(`${pad}}`);
        break;
      }

      case "throw": {
        const expr = (node.expr || node.what) ? this.transpileExpr(node.expr || node.what, filepath) : "undefined";
        lines.push(`${pad}throw ${expr};`);
        break;
      }

      case "expressionstatement": {
        const expr = this.transpileExpr(node.expression || node.expr, filepath);
        lines.push(`${pad}${expr};`);
        break;
      }

      case "break": {
        let level = 1;
        if (node.level) {
          const lvlVal = this.getConstName(node.level?.value || node.level);
          if (lvlVal) level = Number(lvlVal) || 1;
        }
        const target = this.loopStack[this.loopStack.length - level];
        if (target) {
          lines.push(`${pad}break ${target.label};`);
        } else {
          lines.push(`${pad}break;`);
        }
        break;
      }

      case "continue": {
        let level = 1;
        if (node.level) {
          const lvlVal = this.getConstName(node.level?.value || node.level);
          if (lvlVal) level = Number(lvlVal) || 1;
        }
        let targetLabel: string | undefined;
        let count = 0;
        for (let i = this.loopStack.length - 1; i >= 0; i--) {
          count++;
          if (count === level) {
            targetLabel = this.loopStack[i].label;
            break;
          }
        }
        if (targetLabel) {
          lines.push(`${pad}continue ${targetLabel};`);
        } else {
          lines.push(`${pad}continue;`);
        }
        break;
      }

      case "exit":
      case "die": {
        const statusNode = node.expression || node.status || node.expr || node.value;
        const status = statusNode ? this.transpileExpr(statusNode, filepath) : "0";
        lines.push(`${pad}await ${this.functionCallTarget("exit")}(${this.withContextArgs([`new PHPLiteral(${status})`])});`);
        break;
      }

      case "label": {
        const labelName = this.getConstName(node.name || node.label) || "lbl";
        lines.push(`${pad}${labelName}: ;`);
        break;
      }

      case "goto": {
        const labelName = this.getConstName(node.label || node.name) || "lbl";
        lines.push(`${pad}/* goto ${labelName} */`);
        break;
      }

      case "declare":
      case "noop":
        break;

      case "usegroup":
      case "use": {
        for (const item of node.items || []) {
          const name = this.getConstName(item.name || item);
          const alias = (item.alias ? this.getConstName(item.alias) : "") || name.split("\\").pop() || name;
          this.classImports[alias.toLowerCase()] = normalizePhpRegistryName(name);
          this.classImportsOriginal[alias.toLowerCase()] = name;
        }
        break;
      }

      case "trait": {
        const name = (node.name?.name || node.name || "").toString();
        const originalName = this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${name}` : name;
        const qualifiedName = normalizePhpRegistryName(originalName);
        lines.push(`${pad}if (Object.hasOwn(ctx.classes, ${JSON.stringify(qualifiedName)})) throw new PHPFatalError(\`Cannot declare trait ${originalName}, because the name is already in use\`);`);
        break;
      }

      case "interface": {
        const name = (node.name?.name || node.name || "").toString();
        const originalName = this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${name}` : name;
        const qualifiedName = normalizePhpRegistryName(originalName);
        const safeId = this.encodePhpQualifiedIdentifier(qualifiedName);
        const previousClassName = this.currentClassName;
        const previousClassNameOriginal = this.currentClassNameOriginal;
        this.currentClassName = qualifiedName;
        this.currentClassNameOriginal = originalName;

        try {
          lines.push(`${pad}if (Object.hasOwn(ctx.classes, ${JSON.stringify(qualifiedName)}) || Object.hasOwn(ctx.interfaces, ${JSON.stringify(qualifiedName)})) throw new PHPFatalError(\`Cannot declare interface ${originalName}, because the name is already in use\`);`);

          const extendsList = Array.isArray(node.extends) ? node.extends : (node.extends ? [node.extends] : []);
          const parentIfaces = extendsList.map((ext: any) => {
            const extName = this.transpileClassReferenceLower(ext, filepath);
            const extOrig = this.transpileClassReferenceOriginal(ext, filepath);
            return `(ctx.interfaces[${extName}] || ctx.classes[${extName}] || (await ctx.resolveMissingClass(${extName}, ${extOrig})))`;
          });

          const bodyItems = Array.isArray(node.body)
            ? node.body
            : Array.isArray(node.body?.children)
            ? node.body.children
            : Array.isArray(node.body?.body)
            ? node.body.body
            : Array.isArray(node.children)
            ? node.children
            : (node.body ? [node.body] : []);

          const ifaceVariable = `__iface_${safeId}`;
          const ifaceDefinition = this.isConditionalClassBinding(qualifiedName)
            ? `${ifaceVariable} = new PHPInterface(${JSON.stringify(originalName)}, [${parentIfaces.join(", ")}]);`
            : `const ${ifaceVariable} = new PHPInterface(${JSON.stringify(originalName)}, [${parentIfaces.join(", ")}]);`;
          lines.push(`${pad}${ifaceDefinition}`);
          lines.push(`${pad}ctx.interfaces[${JSON.stringify(qualifiedName)}] = ${ifaceVariable};`);
          lines.push(`${pad}ctx.classes[${JSON.stringify(qualifiedName)}] = ${ifaceVariable};`);
          lines.push(`${pad}${ifaceVariable}[SYMBOL_PHP_CONSTANTS] = Object.create(null);`);
          for (const constant of this.orderClassConstants(bodyItems, qualifiedName, filepath)) {
            const name = this.getConstName(constant.name).toLowerCase();
            const val = this.transpileExpr(constant.value, filepath);
            lines.push(`${pad}${ifaceVariable}[SYMBOL_PHP_CONSTANTS][${JSON.stringify(name)}] = ${val};`);
          }
          const scope = this.transpileScopes[this.transpileScopes.length - 1];
          if (scope) scope.classBindings[qualifiedName] = ifaceVariable;
        } finally {
          this.currentClassName = previousClassName;
          this.currentClassNameOriginal = previousClassNameOriginal;
        }
        break;
      }

      case "function": {
        break;
      }

      case "class": {
        const className = (node.name?.name || node.name || "AnonymousClass").toString();
        const originalClassName = this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${className}` : className;
        const qualifiedClassName = normalizePhpRegistryName(originalClassName);
        const safeClassId = this.encodePhpQualifiedIdentifier(qualifiedClassName);
        const classVariable = `__cls_${safeClassId}`;
        const parentVariable = `__parent_${safeClassId}`;
        const isChildClass = Boolean(node.extends);
        const previousClassName = this.currentClassName;
        const previousClassNameOriginal = this.currentClassNameOriginal;
        const previousClassVariable = this.currentClassVariable;
        const previousParentVariable = this.currentParentVariable;
        this.currentClassName = qualifiedClassName;
        this.currentClassNameOriginal = originalClassName;
        this.currentClassVariable = classVariable;
        this.currentParentVariable = isChildClass ? parentVariable : "";

        const parentClass = node.extends ? this.transpileClassValue(node.extends, filepath) : "undefined";
        lines.push(`${pad}if (Object.hasOwn(ctx.classes, ${JSON.stringify(qualifiedClassName)})) throw new PHPFatalError(\`Cannot declare class ${originalClassName}, because the name is already in use\`);`);

        const bodyItems = Array.isArray(node.body)
          ? node.body
          : Array.isArray(node.body?.children)
          ? node.body.children
          : Array.isArray(node.body?.body)
          ? node.body.body
          : Array.isArray(node.children)
          ? node.children
          : (node.body ? [node.body] : []);

        const hasExplicitConstruct = bodyItems.some(
          (item: any) => item?.kind === "method" && (item.name?.name || item.name || "").toString().toLowerCase() === "__construct"
        );
        const hasConstructor = bodyItems.some((item: any) => {
          if (item?.kind !== "method") return false;
          const name = (item.name?.name || item.name || "").toString().toLowerCase();
          return name === "__construct" || (!hasExplicitConstruct && name === className.toLowerCase());
        });
        const hasOwnInstanceMagic = bodyItems.some((item: any) => {
          if (item?.kind !== "method" || item.isStatic) return false;
          const name = (item.name?.name || item.name || "").toString().toLowerCase();
          return name === "__get" || name === "__set" || name === "__isset" || name === "__unset" || name === "__call";
        });
        const hasOwnStaticMagic = bodyItems.some((item: any) =>
          item?.kind === "method" && item.isStatic && (item.name?.name || item.name || "").toString().toLowerCase() === "__callstatic"
        );
        const parentKeyExpression = node.extends ? this.transpileClassReferenceLower(node.extends, filepath) : "";
        const parentClassKey = parentKeyExpression.startsWith('"') ? JSON.parse(parentKeyExpression) : "";
        const hasInstanceMagic = hasOwnInstanceMagic || this.magicClasses.has(parentClassKey);
        const hasStaticMagic = hasOwnStaticMagic || this.staticMagicClasses.has(parentClassKey);
        this.classProperties[qualifiedClassName] = new Set(
          bodyItems
            .filter((item: any) => item?.kind === "propertystatement" && !item.isStatic)
            .flatMap((item: any) => (item.properties || []).map((property: any) => {
              const raw = String(property.name?.name || property.name || "");
              return raw.startsWith("$") ? raw.slice(1) : raw;
            }))
        );
        this.classStaticMethods[qualifiedClassName] = new Set([
          ...(this.classStaticMethods[parentClassKey] || []),
          ...bodyItems
            .filter((item: any) => item?.kind === "method" && item.isStatic)
            .map((item: any) => (item.name?.name || item.name || "").toString().toLowerCase()),
        ]);
        if (hasInstanceMagic) this.magicClasses.add(qualifiedClassName);
        if (hasStaticMagic) this.staticMagicClasses.add(qualifiedClassName);

        const conditionalClass = this.isConditionalClassBinding(qualifiedClassName);
        if (isChildClass) {
          lines.push(`${pad}const ${parentVariable} = ${parentClass};`);
          lines.push(`${pad}${conditionalClass ? "" : "const "}${classVariable} = class ${classVariable} extends ${parentVariable} {`);
        } else {
          lines.push(`${pad}${conditionalClass ? "" : "const "}${classVariable} = class ${classVariable} {`);
        }

        for (const item of bodyItems) {
          if (item?.kind === "classconstant") continue;
          if (item?.kind === "method") {
            const mName = (item.name?.name || item.name || "").toString();
            const isConstruct = mName.toLowerCase() === "__construct" || (!hasExplicitConstruct && mName.toLowerCase() === className.toLowerCase());
            const isStatic = Boolean(item.isStatic);
            const phpMethodName = isConstruct ? "__construct" : mName.toLowerCase();
            const methodDeclaration = this.methodDeclaration(phpMethodName, isStatic);
            const bodyNodes = item.body?.children || item.body;
            const parameterNodes = item.arguments || [];
            const methodScopeNodes = [...this.normalizeScopeNodes(bodyNodes), ...parameterNodes.map((p: any) => p.value).filter(Boolean)];
            const methodScope = this.createTranspileScope(methodScopeNodes);
            this.transpileScopes.push(methodScope);
            const savedLoopStack = this.loopStack;
            const savedFuncName = this.currentFuncName;
            this.currentFuncName = `${this.currentClassName}::${mName}`;
            this.loopStack = [];
            const params = parameterNodes.map((a: any, idx: number) => {
              const pName = this.getConstName(a.name || a);
              const hasDefault = Boolean(a.value);
              const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
              return { name: pName, position: idx, byref: Boolean(a.byref || a.byRef), variadic: Boolean(a.variadic || a.isVariadic), isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
            });
            const isGen = this.containsYield(bodyNodes);
            const usage = this.analyzeFunctionUsage(bodyNodes, params);
            const needsScope = usage.requiresPhpScope || usage.requiresArgumentScope;
            lines.push(`${pad}  ${isStatic ? "static " : ""}async ${isGen ? "*" : ""}${methodDeclaration}(${this.functionParameterList(params)}) {`);

            if (needsScope) {
              lines.push(`${pad}    ctx.pushScope(arguments, 1);`);
              lines.push(`${pad}    try {`);
            }
            const bodyIndent = indent + (needsScope ? 6 : 4);
            const bodyPad = " ".repeat(bodyIndent);
            const classCacheMarker = lines.length;
            lines.push("");
            const savedParameterBindings = this.currentParameterBindings;
            const savedPhpScopeRequired = this.currentPhpScopeRequired;
            try {
              this.emitScopePreamble(methodScope, lines, lineMap, mapGen, filepath, bodyIndent);

              const scopeVars = this.collectVariablesInScope(bodyNodes);
              const parameterNames = new Set(params.map((p: any) => p.name));
              const parameterBindings = this.emitParameterBindings(params, lines, bodyIndent, usage, usage.requiresPhpScope);
              this.currentParameterBindings = parameterBindings;
              this.currentPhpScopeRequired = usage.requiresPhpScope;
              const reboundVariables = this.collectReboundVariables(bodyNodes);
              for (const vName of scopeVars) {
                if (vName === "this" || this.isSuperglobal(vName)) continue;
                if (parameterNames.has(vName)) continue;
                const safeId = encodePhpIdentifier(vName);
                const variable = usage.requiresPhpScope ? `ctx.getPHPVar(${JSON.stringify(vName)})` : "new PHPVariable()";
                lines.push(`${bodyPad}${reboundVariables.has(vName) ? "let" : "const"} $v_${safeId} = ${variable};`);
              }

              this.transpileNodeList(bodyNodes, lines, lineMap, mapGen, filepath, bodyIndent, mName, true);
            } finally {
              this.loopStack = savedLoopStack;
              this.currentFuncName = savedFuncName;
              this.currentParameterBindings = savedParameterBindings;
              this.currentPhpScopeRequired = savedPhpScopeRequired;
              this.insertClassCachePreamble(methodScope, lines, classCacheMarker, bodyIndent);
              this.transpileScopes.pop();
            }

            if (needsScope) {
              lines.push(`${pad}    } finally {`);
              lines.push(`${pad}      ctx.popScope();`);
              lines.push(`${pad}    }`);
            }
            lines.push(`${pad}  }`);
          }
        }

        if (!hasConstructor) {
          lines.push(`${pad}  async __construct(ctx, ...args) {`);
          if (isChildClass) lines.push(`${pad}    await super.__construct(ctx, ...args);`);
          lines.push(`${pad}  }`);
        }

        lines.push(`${pad}  static async [SYMBOL_PHP_NEW](ctx, ...args) {`);
        lines.push(`${pad}    const instance = Object.create(this.prototype);`);
        lines.push(`${pad}    await this[SYMBOL_PHP_INIT](ctx, instance);`);
        lines.push(`${pad}    const object = ${hasInstanceMagic ? "new Proxy(instance, PROXY_HANDLER(ctx))" : "instance"};`);
        lines.push(`${pad}    await object.__construct(ctx, ...args);`);
        lines.push(`${pad}    return object;`);
        lines.push(`${pad}  }`);

        lines.push(`${pad}  static async [SYMBOL_PHP_INIT](ctx, obj) {`);
        if (isChildClass) {
          lines.push(`${pad}    await ${parentVariable}[SYMBOL_PHP_INIT](ctx, obj);`);
        }
        for (const item of bodyItems) {
          if (item?.kind === "propertystatement" && !item.isStatic) {
            for (const property of item.properties || []) {
              const rawName = property.name?.name || property.name;
              const phpName = rawName.startsWith("$") ? rawName.slice(1) : rawName;
              const propName = encodePhpPropertyName(phpName);
              const value = property.value ? this.transpileExpr(property.value, filepath) : "undefined";
              lines.push(`${pad}    obj.${propName} = new PHPVariable(${value});`);
            }
          }
        }
        lines.push(`${pad}  }`);
        lines.push(`${pad}}`);

        lines.push(`${pad}${classVariable}[SYMBOL_PHP_NAME] = ${JSON.stringify(originalClassName)};`);
        lines.push(`${pad}${classVariable}.prototype[SYMBOL_PHP_NAME] = ${JSON.stringify(originalClassName)};`);
        lines.push(`${pad}${classVariable}[SYMBOL_PHP_CLASS] = true;`);
        lines.push(`${pad}${classVariable}.prototype[SYMBOL_PHP_CLASS] = ${classVariable};`);
        lines.push(`${pad}${classVariable}[SYMBOL_PHP_PARENT] = ${isChildClass ? parentVariable : "null"};`);
        lines.push(`${pad}${classVariable}[SYMBOL_PHP_CONSTANTS] = Object.create(null);`);
        for (const constant of this.orderClassConstants(bodyItems, qualifiedClassName, filepath)) {
          const name = this.getConstName(constant.name);
          const key = name.toLowerCase();
          lines.push(`${pad}${classVariable}[SYMBOL_PHP_CONSTANTS][${JSON.stringify(key)}] = { name: ${JSON.stringify(name)}, value: ${this.transpileExpr(constant.value, filepath)} };`);
        }
        const propertyMetadata: string[] = [];
        for (const item of bodyItems) {
          if (item?.kind === "propertystatement") {
            const vis = item.visibility || "public";
            const isStat = Boolean(item.isStatic);
            for (const property of item.properties || []) {
              const rawName = property.name?.name || property.name;
              const phpName = rawName.startsWith("$") ? rawName.slice(1) : rawName;
              const defaultValue = property.value ? this.transpileExpr(property.value, filepath) : "undefined";
              propertyMetadata.push(`[${JSON.stringify(phpName)}]: { name: ${JSON.stringify(phpName)}, visibility: ${JSON.stringify(vis)}, isStatic: ${isStat}, isReadOnly: ${Boolean(item.readonly)}, defaultValue: ${defaultValue}, encodedName: ${JSON.stringify(encodePhpPropertyName(phpName))} }`);
            }
          }
        }
        lines.push(`${pad}${classVariable}[SYMBOL_PHP_PROPERTIES] = { ${propertyMetadata.join(", ")} };`);
        const methodMeta = bodyItems.filter((item: any) => item?.kind === "method").map((item: any) => {
          const originalMethodName = (item.name?.name || item.name || "").toString();
          const isConstructor = originalMethodName.toLowerCase() === "__construct"
            || (!hasExplicitConstruct && originalMethodName.toLowerCase() === className.toLowerCase());
          const phpMethodName = isConstructor ? "__construct" : originalMethodName;
          const isStatic = Boolean(item.isStatic);
          const encodedName = this.methodKeyExpression(phpMethodName, isStatic);
          const parameters = (item.arguments || []).map((argument: any, index: number) => {
            const parameterName = this.getConstName(argument.name || argument);
            return `{ name: ${JSON.stringify(parameterName)}, position: ${index}, isOptional: ${Boolean(argument.value)}, hasDefault: ${Boolean(argument.value)}, byref: ${Boolean(argument.byref || argument.byRef)} }`;
          });
          const required = (item.arguments || []).filter((argument: any) => !argument.value).length;
          const methodRef = isStatic ? `${classVariable}[${encodedName}]` : `${classVariable}.prototype[${encodedName}]`;
          return `[${encodedName}]: { name: ${JSON.stringify(originalMethodName)}, visibility: ${JSON.stringify(item.visibility || "public")}, isStatic: ${isStatic}, isAbstract: ${Boolean(item.isAbstract)}, isFinal: ${Boolean(item.isFinal)}, numberOfParameters: ${(item.arguments || []).length}, numberOfRequiredParameters: ${required}, parameters: [${parameters.join(", ")}], fn: ${methodRef} }`;
        });
        lines.push(`${pad}${classVariable}[SYMBOL_PHP_METHODS] = { ${methodMeta.join(", ")} };`);
        if (hasInstanceMagic) {
          lines.push(`${pad}${classVariable}[SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS] = true;`);
          lines.push(`${pad}${classVariable}.prototype[SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS] = true;`);
        }
        if (hasStaticMagic) {
          lines.push(`${pad}${classVariable}[SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS] = true;`);
        }

        const implList = Array.isArray(node.implements) ? node.implements : (node.implements ? [node.implements] : []);
        if (implList.length > 0) {
          const implIfaces = implList.map((impl: any) => {
            const implName = this.transpileClassReferenceLower(impl, filepath);
            const implOrig = this.transpileClassReferenceOriginal(impl, filepath);
            return `(ctx.interfaces[${implName}] || ctx.classes[${implName}] || (await ctx.resolveMissingClass(${implName}, ${implOrig})))`;
          });
          lines.push(`${pad}${classVariable}[SYMBOL_PHP_CLASS_INTERFACES] = [${implIfaces.join(", ")}];`);
          lines.push(`${pad}${classVariable}.prototype[SYMBOL_PHP_CLASS_INTERFACES] = ${classVariable}[SYMBOL_PHP_CLASS_INTERFACES];`);
        }

        for (const item of bodyItems) {
          if (item?.kind === "propertystatement" && item.isStatic) {
            for (const property of item.properties || []) {
              const rawName = property.name?.name || property.name;
              const phpName = rawName.startsWith("$") ? rawName.slice(1) : rawName;
              const propName = encodePhpPropertyName(phpName);
              const value = property.value ? this.transpileExpr(property.value, filepath) : "undefined";
              lines.push(`${pad}${classVariable}.${propName} = new PHPVariable(${value});`);
            }
          }
        }
        if (hasStaticMagic) lines.push(`${pad}${classVariable} = new Proxy(${classVariable}, STATIC_PROXY_HANDLER(ctx));`);
        lines.push(`${pad}ctx.classes[${JSON.stringify(qualifiedClassName)}] = ${classVariable};`);
        if (!node.isAnonymous) {
          const scope = this.transpileScopes[this.transpileScopes.length - 1];
          if (scope) scope.classBindings[qualifiedClassName] = classVariable;
        }
        this.currentClassName = previousClassName;
        this.currentClassNameOriginal = previousClassNameOriginal;
        this.currentClassVariable = previousClassVariable;
        this.currentParentVariable = previousParentVariable;
        break;
      }

      default: {
        const expr = this.transpileExpr(node, filepath);
        lines.push(`${pad}${expr};`);
        break;
      }
    }
  }

  private containsYield(node: any): boolean {
    if (!node || typeof node !== "object") return false;
    if (node.kind === "yield" || node.kind === "yieldfrom") return true;
    if (node.kind === "function" || node.kind === "closure" || node.kind === "arrowfunc") return false;
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "comments" || key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) if (this.containsYield(c)) return true;
      } else if (child && typeof child === "object") {
        if (this.containsYield(child)) return true;
      }
    }
    return false;
  }

  private orderClassConstants(body: any[], className: string, filepath: string): any[] {
    const constants: Record<string, any> = Object.create(null);
    for (const item of body) {
      if (item?.kind !== "classconstant") continue;
      for (const constant of item.constants || []) constants[this.getConstName(constant.name).toLowerCase()] = constant;
    }
    const visited = new Set<string>();
    const pending = new Set<string>();
    const ordered: any[] = [];
    const visit = (name: string) => {
      if (visited.has(name) || !Object.hasOwn(constants, name)) return;
      if (pending.has(name)) throw new PHPFatalError(`Cannot declare constant ${className}::${name} with self-referencing constant`);
      pending.add(name);
      const constant = constants[name];
      const visitValue = (value: any) => {
        if (!value || typeof value !== "object") return;
        if (value.kind === "staticlookup" && value.offset && this.transpileClassReference(value.what, filepath) === JSON.stringify(className)) {
          visit(this.getConstName(value.offset).toLowerCase());
        }
        for (const key of Object.keys(value)) {
          if (key !== "loc" && typeof value[key] === "object") visitValue(value[key]);
        }
      };
      visitValue(constant.value);
      pending.delete(name);
      visited.add(name);
      ordered.push(constant);
    };
    for (const name of Object.keys(constants)) visit(name);
    return ordered;
  }

  private transpileCallArgs(args: any[], filepath: string): string[] {
    return (args || []).map((a: any) => {
      let inner = a;
      while (inner?.kind === "parenthesis" || inner?.kind === "parentheses") inner = inner.inner || inner.expr;
      if (inner?.kind === "variadic" || a?.kind === "variadic") {
        const innerNode = inner?.what || inner?.value || inner?.expr || a?.what || a?.value || a?.expr;
        const val = innerNode ? this.transpileExpr(innerNode, filepath) : "[]";
        return `...(${val} || [])`;
      }
      if (inner?.kind === "string") {
        return this.stringLiteralBindings[JSON.stringify(inner.value)] || `new PHPLiteral(${JSON.stringify(inner.value)})`;
      }
      if (inner?.kind === "variable") {
        const vName = this.getConstName(inner.name || inner);
        if (vName !== "this") {
          if (this.isSuperglobal(vName)) return `ctx.getPHPVar(${JSON.stringify(vName)})`;
          return this.phpVariableReference(vName);
        }
      }
      if (inner?.kind === "propertylookup") {
        if (this.hasDirectPhpProperty(inner.what, inner.offset)) {
          const object = this.transpileExpr(inner.what, filepath);
          return this.propertyAccessExpression(object, inner.offset, filepath);
        }
        return `new PHPPropertyReference(ctx, ${this.transpileExpr(inner.what, filepath)}, ${this.transpilePropertyOffset(inner.offset, filepath)})`;
      }
      const expr = this.transpileExpr(a, filepath);
      if (inner?.kind === "string" || inner?.kind === "number" || inner?.kind === "boolean"
        || inner?.kind === "null" || inner?.kind === "nil" || inner?.kind === "array" || inner?.kind === "closure" || inner?.kind === "arrowfunc") {
        return `new PHPLiteral(${expr})`;
      }
      return `ctx.toLiteral(${expr})`;
    });
  }

  private collectVariablesInScope(nodes: any): Set<string> {
    const vars = new Set<string>();
    if (!nodes) return vars;
    const list = Array.isArray(nodes) ? nodes : [nodes];
    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.kind === "variable") {
        const vName = this.getConstName(node.name || node);
        if (vName && typeof vName === "string") vars.add(vName);
      }
      if (node.kind === "function" || node.kind === "method" || node.kind === "closure" || node.kind === "arrowfunc" || node.kind === "class") return;
      if (node.children) visit(node.children);
      if (node.body) visit(node.body);
      if (node.expr) visit(node.expr);
      if (node.expression) visit(node.expression);
      if (node.expressions) visit(node.expressions);
      if (node.what) visit(node.what);
      if (node.offset) visit(node.offset);
      if (node.left) visit(node.left);
      if (node.right) visit(node.right);
      if (node.test) visit(node.test);
      if (node.init) visit(node.init);
      if (node.increment) visit(node.increment);
      if (node.alternate) visit(node.alternate);
      if (node.source) visit(node.source);
      if (node.value) visit(node.value);
      if (node.key) visit(node.key);
      if (node.arguments) visit(node.arguments);
      if (node.variables) visit(node.variables);
      if (node.variable) visit(node.variable);
      if (node.items) visit(node.items);
      if (node.catches) visit(node.catches);
      if (node.always) visit(node.always);
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
      }
    };
    for (const item of list) visit(item);
    return vars;
  }

  private collectReboundVariables(nodes: any): Set<string> {
    const variables = new Set<string>();
    const addVariables = (items: any[]): void => {
      for (let item of items || []) {
        while (item?.kind === "parenthesis" || item?.kind === "parentheses" || item?.kind === "reference" || item?.kind === "byref") {
          item = item.inner || item.what || item.expr || item.value;
        }
        const variable = item?.kind === "variable" ? item : item?.variable;
        if (!variable) continue;
        const name = this.getConstName(variable.name || variable);
        if (name) variables.add(name);
      }
    };
    const visit = (node: any, isRoot = false): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (!isRoot && ["function", "method", "closure", "arrowfunc", "class"].includes(node.kind)) return;
      if (node.kind === "unset") addVariables(node.variables || node.expressions || []);
      if (node.kind === "global") addVariables(node.items || []);
      if (node.kind === "static") addVariables(node.result || node.items || node.variables || []);
      if (node.kind === "assignref") addVariables([node.left]);
      if (node.kind === "foreach" && (node.byref || node.value?.kind === "reference" || node.value?.byref)) {
        addVariables([node.value, node.key]);
      }
      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "parent" || key === "comments") continue;
        visit(node[key]);
      }
    };
    visit(nodes, true);
    return variables;
  }

  private analyzeFunctionUsage(
    nodes: any,
    params: Array<{ name: string; byref?: boolean; variadic?: boolean; hasDefault?: boolean }>
  ): PHPFunctionUsage {
    const parameters: Record<string, PHPParameterUsage> = Object.create(null);
    for (const param of params) {
      parameters[param.name] = {
        read: false,
        readCount: 0,
        needsReference: false,
        rebindsReference: false,
        passThroughReference: false,
        requiresScopeBinding: false,
      };
    }

    let requiresPhpScope = false;
    let requiresArgumentScope = false;
    let requiresAllParametersInScope = false;
    const unwrap = (node: any): any => {
      while (node?.kind === "parenthesis" || node?.kind === "parentheses" || node?.kind === "byref" || node?.kind === "reference") {
        node = node.inner || node.what || node.expr || node.value;
      }
      return node;
    };
    const mark = (node: any, mode: "read" | "reference" | "rebind" | "pass-through"): void => {
      const variable = unwrap(node);
      if (variable?.kind !== "variable" || typeof variable.name !== "string") return;
      const usage = parameters[variable.name];
      if (!usage) return;
      if (mode === "read") {
        usage.read = true;
        usage.readCount++;
      }
      if (mode === "reference" || mode === "rebind") usage.needsReference = true;
      if (mode === "rebind") usage.rebindsReference = true;
      if (mode === "pass-through") usage.passThroughReference = true;
    };
    const visitTarget = (node: any): void => {
      node = unwrap(node);
      if (!node || typeof node !== "object") return;
      if (node.kind === "variable") {
        mark(node, "reference");
        if (typeof node.name !== "string") {
          requiresPhpScope = true;
          visit(node.name);
        }
        return;
      }
      if (node.kind === "offsetlookup") {
        let root = node;
        while (root?.kind === "offsetlookup") root = root.what;
        if (root?.kind === "variable" && typeof root.name === "string" && !this.isSuperglobal(root.name)) {
          requiresPhpScope = true;
          if (parameters[root.name]) parameters[root.name].requiresScopeBinding = true;
        }
        visitTarget(node.what);
        visit(node.offset);
        return;
      }
      visit(node);
    };
    const visit = (node: any): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (["function", "method", "class", "interface", "trait"].includes(node.kind)) return;
      if (node.kind === "closure") {
        for (const use of node.uses || []) {
          const variable = use?.kind === "variable" ? use : use.variable || use.name || use;
          mark(variable, use.byref || use.byRef ? "reference" : "read");
        }
        return;
      }
      if (node.kind === "arrowfunc") {
        const innerParams = new Set((node.arguments || []).map((arg: any) => this.getConstName(arg.name || arg)));
        for (const name of this.collectVariablesInScope(node.body?.children || node.body)) {
          if (!innerParams.has(name)) mark({ kind: "variable", name }, "read");
        }
        return;
      }
      if (node.kind === "global" || node.kind === "static") {
        requiresPhpScope = true;
        const variables = node.kind === "global"
          ? node.items || []
          : node.result || node.items || node.variables || [];
        for (const item of variables) {
          const variable = item?.variable || item;
          mark(variable, "rebind");
        }
      }
      if (node.kind === "variable" && typeof node.name !== "string") {
        requiresPhpScope = true;
        requiresAllParametersInScope = true;
        visit(node.name);
        return;
      }
      if (node.kind === "variable") {
        mark(node, "read");
        return;
      }
      if (node.kind === "offsetlookup") {
        let root = node;
        while (root?.kind === "offsetlookup") root = root.what;
        if (root?.kind === "variable" && typeof root.name === "string" && !this.isSuperglobal(root.name)) {
          requiresPhpScope = true;
          if (parameters[root.name]) parameters[root.name].requiresScopeBinding = true;
        }
      }
      if (node.kind === "call") {
        if (node.what?.kind === "name" || node.what?.kind === "constref" || node.what?.kind === "identifier") {
          const functionName = normalizePhpRegistryName(this.getConstName(node.what)).split("$$").pop();
          if (functionName === "func_get_args" || functionName === "func_get_arg" || functionName === "func_num_args") {
            requiresArgumentScope = true;
          }
          if (functionName === "get_defined_vars" || functionName === "extract" || functionName === "compact" || functionName === "eval") {
            requiresPhpScope = true;
            requiresAllParametersInScope = true;
          }
        }
        const what = node.what;
        const args = node.arguments || [];
        for (let index = 0; index < args.length; index++) {
          const arg = args[index];
          const variable = unwrap(arg);
          if (variable?.kind === "variable" && typeof variable.name === "string") {
            mark(variable, "reference");
          } else {
            visit(arg);
          }
        }
        visit(what);
        return;
      }
      if (node.kind === "include") {
        requiresPhpScope = true;
        requiresAllParametersInScope = true;
        visit(node.target || node.expr || node.what);
        return;
      }
      if (node.kind === "assign" || node.kind === "assignref") {
        visitTarget(node.left);
        if (node.kind === "assignref") mark(node.left, "rebind");
        if (node.operator && node.operator !== "=") visit(node.left);
        const right = unwrap(node.right);
        const left = unwrap(node.left);
        const directReferenceTarget = left?.kind === "variable"
          || left?.kind === "staticlookup"
          || (left?.kind === "propertylookup" && this.hasDirectPhpProperty(left.what, left.offset));
        if (node.kind === "assign" && (node.operator || "=") === "=" && directReferenceTarget
          && right?.kind === "variable" && typeof right.name === "string") {
          mark(right, "pass-through");
        } else {
          visit(node.right);
        }
        return;
      }
      if (node.kind === "unset") {
        for (const target of node.variables || node.expressions || []) {
          const variable = unwrap(target);
          if (variable?.kind === "variable") mark(variable, "rebind");
          else visitTarget(target);
        }
        return;
      }
      if (node.kind === "pre" || node.kind === "post") {
        visitTarget(node.what);
        visit(node.what);
        return;
      }
      if (node.kind === "foreach") {
        visit(node.source || node.what || node.expr);
        visitTarget(node.key);
        const value = node.value;
        const byReference = value?.kind === "byref" || value?.byref || value?.byRef;
        if (byReference) mark(value.what || value.expr || value.value || value, "rebind");
        else visitTarget(value);
        visit(node.body);
        return;
      }
      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "parent" || key === "comments") continue;
        visit(node[key]);
      }
    };

    visit(nodes);
    for (const param of params) {
      if (param.variadic && (parameters[param.name].read || parameters[param.name].needsReference)) {
        requiresPhpScope = true;
        parameters[param.name].requiresScopeBinding = true;
      }
      if (requiresAllParametersInScope) parameters[param.name].requiresScopeBinding = true;
    }
    return { requiresPhpScope, requiresArgumentScope, requiresAllParametersInScope, parameters };
  }

  private static readonly SUPERGLOBALS = new Set(["GLOBALS", "_GET", "_POST", "_SERVER", "_COOKIE", "_FILES", "_ENV", "_REQUEST", "_SESSION"]);

  private isSuperglobal(name: string): boolean {
    return JSTranspiler.SUPERGLOBALS.has(name);
  }

  private getConstName(node: any): string {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (typeof node.name === "string") return node.name;
    if (typeof node.value === "string") return node.value;
    if (Array.isArray(node.parts)) return node.parts.map((p: any) => typeof p === "string" ? p : p?.name || p).join("\\");
    if (node.name && typeof node.name === "object") return this.getConstName(node.name);
    if (node.what) return this.getConstName(node.what);
    return String(node?.name || node?.value || "");
  }

  private transpilePropertyOffset(offset: any, filepath: string, isStatic = false): string {
    if (!offset) return '"prop"';
    if (isStatic && offset.kind === "variable" && typeof offset.name === "string") {
      return JSON.stringify(encodePhpPropertyName(offset.name));
    }
    if (offset.kind === "variable" || (typeof offset === "object" && offset.kind && offset.kind !== "identifier" && offset.kind !== "constref")) {
      return `encodePhpPropertyName(String(await ctx.toVal(${this.transpileExpr(offset, filepath)})))`;
    }
    const propName = this.getConstName(offset);
    return JSON.stringify(encodePhpPropertyName(propName));
  }

  private propertyAccessExpression(objectExpression: string, offset: any, filepath: string, isStatic = false): string {
    const base = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(objectExpression)
      || (objectExpression.startsWith("(") && objectExpression.endsWith(")"))
      ? objectExpression
      : `(${objectExpression})`;
    const staticName = isStatic && offset?.kind === "variable" && typeof offset.name === "string";
    const dynamic = !offset
      || (offset.kind === "variable" && !staticName)
      || (typeof offset === "object" && offset.kind && offset.kind !== "identifier" && offset.kind !== "constref" && offset.kind !== "variable");
    if (dynamic) return `${base}[${this.transpilePropertyOffset(offset, filepath, isStatic)}]`;
    const propertyName = encodePhpPropertyName(this.getConstName(offset));
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(propertyName)
      ? `${base}.${propertyName}`
      : `${base}[${JSON.stringify(propertyName)}]`;
  }

  private methodAccessExpression(objectExpression: string, offset: any, filepath: string, isStatic = false): string {
    const base = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(objectExpression)
      || (objectExpression.startsWith("(") && objectExpression.endsWith(")"))
      ? objectExpression
      : `(${objectExpression})`;
    const dynamic = !offset
      || offset.kind === "variable"
      || (typeof offset === "object" && offset.kind && offset.kind !== "identifier" && offset.kind !== "constref");
    if (dynamic) return `${base}[${this.transpileMethodOffset(offset, filepath, isStatic)}]`;
    const methodName = this.getConstName(offset).toLowerCase();
    const methodKey = encodePhpMethodName(methodName, isStatic);
    if (typeof methodKey === "symbol") {
      return `${base}[${methodKey === SYMBOL_PHP_METHOD_THEN ? "SYMBOL_PHP_METHOD_THEN" : "SYMBOL_PHP_STATIC_METHOD_PROTOTYPE"}]`;
    }
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(methodKey)
      ? `${base}.${methodKey}`
      : `${base}[${JSON.stringify(methodKey)}]`;
  }

  private closureParentCallHelper(offset: any, expression: string): string | undefined {
    const helpers = this.currentClosureSuperHelpers;
    const methodName = this.getConstName(offset);
    if (!helpers || !methodName || offset?.kind === "variable" || methodName.startsWith("$")) return undefined;
    const key = methodName.toLowerCase();
    if (!helpers[key]) {
      helpers[key] = {
        variable: `__parent_call_${encodePhpIdentifier(key)}_${Object.keys(helpers).length}`,
        expression,
      };
    }
    return helpers[key].variable;
  }

  private hasDirectPhpProperty(objectNode: any, offset: any): boolean {
    if (!offset || offset.kind === "variable" || (typeof offset === "object" && offset.kind && offset.kind !== "identifier" && offset.kind !== "constref")) {
      return false;
    }

    let object = objectNode;
    while (object?.kind === "parenthesis" || object?.kind === "parentheses") {
      object = object.inner || object.expr || object.value || object.what;
    }
    if (object?.kind !== "variable") return false;

    const varName = this.getConstName(object.name || object);
    const className = varName === "this" ? this.currentClassName : this.variableClassNames[varName];
    if (!className) return false;

    const propertyName = this.getConstName(offset).replace(/^\$/, "");
    return Boolean(this.classProperties[className]?.has(propertyName) || this.magicClasses.has(className));
  }

  private staticMethodClass(objectNode: any, offset: any): string | undefined {
    if (!offset || offset.kind === "variable" || (typeof offset === "object" && offset.kind && offset.kind !== "identifier" && offset.kind !== "constref")) {
      return undefined;
    }

    let object = objectNode;
    while (object?.kind === "parenthesis" || object?.kind === "parentheses") {
      object = object.inner || object.expr || object.value || object.what;
    }
    if (object?.kind !== "variable") return undefined;

    const objectName = this.getConstName(object.name || object);
    const className = objectName === "this" ? this.currentClassName : this.variableClassNames[objectName];
    return className && this.classStaticMethods[className]?.has(this.getConstName(offset).toLowerCase())
      ? className
      : undefined;
  }

  private classValueForObject(objectNode: any, className: string | undefined, filepath: string): string {
    let object = objectNode;
    while (object?.kind === "parenthesis" || object?.kind === "parentheses") {
      object = object.inner || object.expr || object.value || object.what;
    }
    if (object?.kind === "variable" && this.getConstName(object.name || object) === "this") {
      return "this[SYMBOL_PHP_CLASS]";
    }
    if (className) {
      return this.transpileClassValue({ kind: "name", name: className, resolution: "fqn" }, filepath);
    }
    return this.transpileExpr(objectNode, filepath);
  }

  private transpileListAssignItem(targetNode: any, valExpr: string, filepath: string): string {
    if (!targetNode || targetNode.kind === "noop") return "";

    let node = targetNode;
    while (node?.kind === "parenthesis" || node?.kind === "parentheses") {
      node = node.inner || node.expr || node.value || node.what;
    }

    if (!node || node.kind === "noop") return "";

    if (node.kind === "variable") {
      const varName = this.getConstName(node.name || node);
      if (this.isSuperglobal(varName)) {
        return `await ctx.setVar(${JSON.stringify(varName)}, ${valExpr})`;
      }
      return `await ${this.phpVariableReference(varName)}.set(${valExpr})`;
    }

    if (node.kind === "propertylookup") {
      const obj = this.transpileExpr(node.what, filepath);
      const prop = this.transpilePropertyOffset(node.offset, filepath);
      return `await (${obj})[${prop}].set(${valExpr})`;
    }

    if (node.kind === "offsetlookup") {
      const arr = this.transpileExpr(node.what, filepath);
      const offset = node.offset ? this.transpileExpr(node.offset, filepath) : "null";
      return `await ctx.setArrayElement(${arr}, ${offset}, ${valExpr})`;
    }

    if (node.kind === "list" || node.kind === "array") {
      return this.transpileListAssign(node, valExpr, filepath);
    }

    return "";
  }

  private transpileListAssign(listNode: any, rightValExpr: string, filepath: string): string {
    const items = listNode.items || listNode.arguments || listNode.value || [];
    const assigns = items.map((item: any, idx: number) => {
      if (!item || item.kind === "noop") return "";

      let keyExpr: string = String(idx);
      let targetNode = item;

      if (item.kind === "entry") {
        targetNode = item.value;
        if (item.key) {
          keyExpr = this.transpileExpr(item.key, filepath);
        }
      }

      if (!targetNode || targetNode.kind === "noop") return "";

      const itemValExpr = `(__list !== null && __list !== undefined ? (Array.isArray(__list) ? __list[${keyExpr}] : (typeof __list === "object" ? __list[${keyExpr}] : undefined)) : undefined) ?? null`;

      return this.transpileListAssignItem(targetNode, itemValExpr, filepath);
    }).filter(Boolean);

    return `(await (async () => { const __list = ${rightValExpr}; ${assigns.join("; ")}; return __list; })())`;
  }

  private methodKeyExpression(name: string, isStatic: boolean): string {
    const methodKey = encodePhpMethodName(name, isStatic);
    if (methodKey === SYMBOL_PHP_METHOD_THEN) return "SYMBOL_PHP_METHOD_THEN";
    if (methodKey === SYMBOL_PHP_STATIC_METHOD_PROTOTYPE) return "SYMBOL_PHP_STATIC_METHOD_PROTOTYPE";
    return JSON.stringify(methodKey);
  }

  private methodDeclaration(name: string, isStatic: boolean): string {
    const methodKey = encodePhpMethodName(name, isStatic);
    if (typeof methodKey === "symbol") {
      return `[${methodKey === SYMBOL_PHP_METHOD_THEN ? "SYMBOL_PHP_METHOD_THEN" : "SYMBOL_PHP_STATIC_METHOD_PROTOTYPE"}]`;
    }
    return methodKey !== "constructor" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(methodKey)
      ? methodKey
      : `[${JSON.stringify(methodKey)}]`;
  }

  private withContextArgs(args: string[]): string {
    return args.length ? `ctx, ${args.join(", ")}` : "ctx";
  }

  private transpileMethodOffset(offset: any, filepath: string, isStatic = false): string {
    if (!offset) return '"method"';
    if (offset.kind === "variable" || (typeof offset === "object" && offset.kind && offset.kind !== "identifier" && offset.kind !== "constref")) {
      return `encodePhpMethodName(String(await ctx.toVal(${this.transpileExpr(offset, filepath)})), ${isStatic})`;
    }
    return this.methodKeyExpression(this.getConstName(offset), isStatic);
  }

  private transpileClassReferenceLower(node: any, filepath: string): string {
    if (!node) return '""';
    const namespace = this.getNamespaceContext(node);
    const isExpr = typeof node === "object" && (node.kind === "variable" || node.kind === "propertylookup" || node.kind === "staticlookup" || node.kind === "call" || node.kind === "arraylookup");
    if (isExpr) return `normalizePhpRegistryName(String(${this.transpileExpr(node, filepath)}))`;
    const name = this.getConstName(node);
    if (node?.kind === "selfreference" || name.toLowerCase() === "self") return JSON.stringify(this.currentClassName);
    if (node?.kind === "staticreference" || name.toLowerCase() === "static") {
      return `normalizePhpRegistryName(typeof this === "function" ? this[SYMBOL_PHP_NAME] : this[SYMBOL_PHP_CLASS]?.[SYMBOL_PHP_NAME] || ${JSON.stringify(this.currentClassNameOriginal || this.currentClassName)})`;
    }
    if (node?.kind === "parentreference" || name.toLowerCase() === "parent") {
      const parent = this.currentParentVariable || "null";
      return `normalizePhpRegistryName(${parent}?.[SYMBOL_PHP_NAME] || ${parent}?.name || "Object")`;
    }
    if (name.startsWith("\\") || node?.resolution === "fqn") return JSON.stringify(normalizePhpRegistryName(name));
    const parts = name.split("\\");
    const importedName = namespace.imports[parts[0].toLowerCase()];
    if (importedName) return JSON.stringify(parts.length > 1 ? `${importedName}$$${parts.slice(1).map((part) => part.toLowerCase()).join("$$")}` : importedName);
    const localName = normalizePhpRegistryName(name);
    return JSON.stringify(namespace.name ? `${namespace.name}$$${localName}` : localName);
  }

  private transpileClassReferenceOriginal(node: any, filepath: string): string {
    if (!node) return '""';
    const namespace = this.getNamespaceContext(node);
    const isExpr = typeof node === "object" && (node.kind === "variable" || node.kind === "propertylookup" || node.kind === "staticlookup" || node.kind === "call" || node.kind === "arraylookup");
    if (isExpr) return `String(${this.transpileExpr(node, filepath)})`;
    const name = this.getConstName(node);
    if (node?.kind === "selfreference" || name.toLowerCase() === "self") return JSON.stringify(this.currentClassNameOriginal || this.currentClassName);
    if (node?.kind === "staticreference" || name.toLowerCase() === "static") {
      return `(typeof this === "function" ? this[SYMBOL_PHP_NAME] : this[SYMBOL_PHP_CLASS]?.[SYMBOL_PHP_NAME] || ${JSON.stringify(this.currentClassNameOriginal || this.currentClassName)})`;
    }
    if (node?.kind === "parentreference" || name.toLowerCase() === "parent") {
      const parent = this.currentParentVariable || "null";
      return `(${parent}?.[SYMBOL_PHP_NAME] || ${parent}?.name || "Object")`;
    }
    if (name.startsWith("\\") || node?.resolution === "fqn") return JSON.stringify(name.replace(/^\\/, ""));
    const parts = name.split("\\");
    const importedName = namespace.importsOriginal[parts[0].toLowerCase()];
    if (importedName) return JSON.stringify(parts.length > 1 ? `${importedName}\\${parts.slice(1).join("\\")}` : importedName);
    return JSON.stringify(namespace.originalName ? `${namespace.originalName}\\${name}` : name);
  }

  private transpileClassReference(node: any, filepath: string): string {
    return this.transpileClassReferenceLower(node, filepath);
  }

  private transpileClassValue(node: any, filepath: string): string {
    const name = this.getConstName(node);
    if (node?.kind === "selfreference" || name.toLowerCase() === "self") {
      return this.currentClassVariable || `(ctx.classes[${JSON.stringify(this.currentClassName)}] ?? (await ctx.resolveMissingClass(${JSON.stringify(this.currentClassName)}, ${JSON.stringify(this.currentClassNameOriginal || this.currentClassName)})))`;
    }
    if (node?.kind === "staticreference" || name.toLowerCase() === "static") {
      return `(typeof this === "function" ? this : this[SYMBOL_PHP_CLASS])`;
    }
    if (node?.kind === "parentreference" || name.toLowerCase() === "parent") {
      return this.currentParentVariable || `Object.getPrototypeOf(this)`;
    }
    const dynamic = typeof node === "object" && (node.kind === "variable" || node.kind === "propertylookup" || node.kind === "staticlookup" || node.kind === "call" || node.kind === "offsetlookup");
    if (dynamic) {
      const expression = this.transpileExpr(node, filepath);
      return `(await (async () => { const __value = await ctx.toVal(${expression}); return await ctx.resolveClassOrInstance(__value, typeof __value === "string" ? __value : undefined); })())`;
    }
    const lower = this.transpileClassReferenceLower(node, filepath);
    const original = this.transpileClassReferenceOriginal(node, filepath);
    const classLookupName = lower.startsWith('"') ? JSON.parse(lower) : "";
    const direct = this.findClassBinding(classLookupName);
    if (direct) return direct;
    const cached = this.findClassCache(classLookupName);
    if (cached) return `(${cached} ??= (ctx.classes[${lower}] ?? (await ctx.resolveMissingClass(${lower}, ${original}))))`;
    const scope = this.transpileScopes[this.transpileScopes.length - 1];
    if (!scope || !classLookupName) return `(ctx.classes[${lower}] ?? (await ctx.resolveMissingClass(${lower}, ${original})))`;
    const variable = `__class_${this.encodePhpQualifiedIdentifier(classLookupName)}_${scope.id}`;
    scope.classCaches[classLookupName] = variable;
    return `(${variable} ??= (ctx.classes[${lower}] ?? (await ctx.resolveMissingClass(${lower}, ${original}))))`;
  }

  private transpileExpr(node: any, filepath: string = "eval"): string {
    if (!node || typeof node !== "object") return "undefined";

    switch (node.kind) {
      case "string":
        return JSON.stringify(node.value);

      case "number": {
        const raw = String(node.value ?? "0");
        if (/^0[0-7]+$/.test(raw)) return "0o" + raw.slice(1);
        return raw;
      }

      case "boolean":
        return String(node.value);

      case "null":
      case "nil":
        return "null";

      case "magic": {
        const m = (node.value || node.name || "").toString().toUpperCase();
        const relDir = path.relative(process.cwd(), path.dirname(filepath)).replace(/\\/g, "/");
        const relFile = path.relative(process.cwd(), filepath).replace(/\\/g, "/");
        if (m === "__DIR__") return `path.resolve(ctx.root || process.cwd(), ${JSON.stringify(relDir)}).replace(/\\\\/g, "/")`;
        if (m === "__FILE__") return `path.resolve(ctx.root || process.cwd(), ${JSON.stringify(relFile)}).replace(/\\\\/g, "/")`;
        if (m === "__LINE__") return String(node.loc?.start?.line || 1);
        if (m === "__CLASS__") return JSON.stringify(this.currentClassNameOriginal);
        if (m === "__METHOD__") return JSON.stringify(this.currentClassNameOriginal ? `${this.currentClassNameOriginal}::${this.currentFuncName}` : this.currentFuncName);
        if (m === "__FUNCTION__") return JSON.stringify(this.currentFuncName);
        if (m === "__NAMESPACE__") return JSON.stringify(this.currentNamespaceNameOriginal);
        return JSON.stringify(m);
      }
      case "name":
      case "constref": {
        const rawName = this.getConstName(node.name || node);
        const upper = rawName.toUpperCase();
        if (upper === "TRUE") return "true";
        if (upper === "FALSE") return "false";
        if (upper === "NULL") return "null";
        const relDir = path.relative(process.cwd(), path.dirname(filepath)).replace(/\\/g, "/");
        const relFile = path.relative(process.cwd(), filepath).replace(/\\/g, "/");
        if (upper === "__DIR__") return `path.resolve(ctx.root || process.cwd(), ${JSON.stringify(relDir)}).replace(/\\\\/g, "/")`;
        if (upper === "__FILE__") return `path.resolve(ctx.root || process.cwd(), ${JSON.stringify(relFile)}).replace(/\\\\/g, "/")`;
        if (upper === "SELF" || upper === "STATIC") return `(ctx.currentClassName || ${JSON.stringify(this.currentClassName ? this.currentClassName.toLowerCase() : "")})`;
        if (upper === "PARENT") return `ctx.currentParentClassName`;
        if (upper === "__LINE__") return String(node.loc?.start?.line || 1);
        if (upper === "__CLASS__") return JSON.stringify(this.currentClassNameOriginal);
        if (upper === "__METHOD__") return JSON.stringify(this.currentClassNameOriginal ? `${this.currentClassNameOriginal}::${this.currentFuncName}` : this.currentFuncName);
        if (upper === "__FUNCTION__") return JSON.stringify(this.currentFuncName);
        if (upper === "__NAMESPACE__") return JSON.stringify(this.currentNamespaceNameOriginal);
        const constName = rawName.toLowerCase();
        return `(ctx.constants[${JSON.stringify(constName)}] ?? ${JSON.stringify(rawName)})`;
      }
      case "closure":
      case "arrowfunc": {
        const bodyNodes = node.body?.children || node.body;
        const parameterNodes = node.arguments || [];
        const closureScope = this.createTranspileScope([
          ...this.normalizeScopeNodes(bodyNodes),
          ...parameterNodes.map((parameter: any) => parameter.value).filter(Boolean),
        ]);
        this.transpileScopes.push(closureScope);
        const params = parameterNodes.map((a: any, idx: number) => {
          const pName = this.getConstName(a.name || a);
          const hasDefault = Boolean(a.value);
          const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
          const byref = Boolean(a.byref || a.byRef);
          const variadic = Boolean(a.variadic || a.isVariadic);
          return { name: pName, position: idx, byref, variadic, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
        });

        const usage = this.analyzeFunctionUsage(bodyNodes, params);
        const needsScope = usage.requiresPhpScope || usage.requiresArgumentScope;
        const scopeVars = this.collectVariablesInScope(bodyNodes);
        const useItems: Array<{ name: string; byref: boolean }> = [];
        if (node.kind === "arrowfunc") {
          const bodyVars = this.collectVariablesInScope(node.body?.children || node.body);
          for (const p of params) bodyVars.delete(p.name);
          for (const vName of bodyVars) {
            if (vName !== "this" && !this.isSuperglobal(vName)) useItems.push({ name: vName, byref: false });
          }
        }
        for (const useItem of node.uses || []) {
          const uName = this.getConstName(useItem.name?.name || useItem.name || useItem);
          if (uName) useItems.push({ name: uName, byref: Boolean(useItem.byref || useItem.byRef) });
        }
        for (const useItem of useItems) scopeVars.add(useItem.name);

        const varDeclLines: string[] = [];
        const parameterNames = new Set(params.map((p: any) => p.name));
        const reboundVariables = this.collectReboundVariables(bodyNodes);
        for (const useItem of useItems) reboundVariables.add(useItem.name);
        for (const vName of scopeVars) {
          if (vName === "this" || this.isSuperglobal(vName)) continue;
          if (parameterNames.has(vName)) continue;
          const safeId = encodePhpIdentifier(vName);
          const variable = needsScope ? `ctx.getPHPVar(${JSON.stringify(vName)})` : "new PHPVariable()";
          varDeclLines.push(`${reboundVariables.has(vName) ? "let" : "const"} $v_${safeId} = ${variable};`);
        }

        const paramBindLines: string[] = [];
        const parameterBindings = this.emitParameterBindings(params, paramBindLines, 16, usage, usage.requiresPhpScope);

        const dummyLines: string[] = [];
        const dummyLineMap: Record<number, any> = Object.create(null);
        const savedLoopStack = this.loopStack;
        const savedParameterBindings = this.currentParameterBindings;
        const savedPhpScopeRequired = this.currentPhpScopeRequired;
        const previousClosureSuperHelpers = this.currentClosureSuperHelpers;
        const closureSuperHelpers: Record<string, { variable: string; expression: string }> = Object.create(null);
        this.currentClosureSuperHelpers = closureSuperHelpers;
        this.currentParameterBindings = parameterBindings;
        this.currentPhpScopeRequired = usage.requiresPhpScope;
        this.loopStack = [];
        const classCacheMarker = dummyLines.length;
        dummyLines.push("");
        try {
          this.emitScopePreamble(closureScope, dummyLines, dummyLineMap, null, filepath, 12);
          if (node.kind === "arrowfunc" && !node.body?.children) {
            dummyLines.push(`            return ${this.transpileExpr(node.body, filepath)};`);
          } else {
            this.transpileNodeList(bodyNodes, dummyLines, dummyLineMap, null, filepath, 12, "closure", true);
          }
        } finally {
          this.loopStack = savedLoopStack;
          this.currentParameterBindings = savedParameterBindings;
          this.currentPhpScopeRequired = savedPhpScopeRequired;
          this.currentClosureSuperHelpers = previousClosureSuperHelpers;
          this.insertClassCachePreamble(closureScope, dummyLines, classCacheMarker, 12);
          this.transpileScopes.pop();
        }

        const isGen = this.containsYield(bodyNodes);
        const parentCallHelpers = Object.values(closureSuperHelpers)
          .map(({ variable, expression }) => `const ${variable} = (...__args) => ${expression}(...__args);`);

        const useCaptures: string[] = [];
        const useInitLines: string[] = [];

        useItems.forEach((useItem, idx) => {
          const uName = useItem.name;
          if (!uName) return;
          const safeId = encodePhpIdentifier(uName);
          const isByRef = useItem.byref;
          const capName = `__cap_${safeId}_${idx}`;
          const currentReference = this.phpVariableReference(uName);
          const currentValue = this.currentParameterBindings[uName]?.readExpression || `(await ${currentReference}.get())`;
          if (isByRef) {
            useCaptures.push(`const ${capName} = ${currentReference};`);
            useInitLines.push(`$v_${safeId} = ${capName};`);
          } else {
            useCaptures.push(`const ${capName} = new PHPVariable(); await ${capName}.set(${currentValue});`);
            useInitLines.push(`$v_${safeId} = ${capName};`);
          }
        });

        const closureScopeOpen = needsScope
          ? "ctx.pushScope(arguments, 1);\n              try {"
          : "";
        const closureScopeClose = needsScope
          ? "\n              } finally {\n                ctx.popScope();\n              }"
          : "";
        if (useCaptures.length > 0) {
          return `(await (async () => {
            ${useCaptures.join("\n            ")}
            ${parentCallHelpers.join("\n            ")}
            return (async function${isGen ? "*" : ""} (${this.functionParameterList(params)}) {
              ${closureScopeOpen}
                ${paramBindLines.join("\n                ")}
                ${varDeclLines.join("\n                ")}
                ${useInitLines.join("\n                ")}
${dummyLines.join("\n")}
              ${closureScopeClose}
            });
          })())`;
        }

        const closureFunction = `(async function${isGen ? "*" : ""} (${this.functionParameterList(params)}) {
          ${closureScopeOpen}
            ${paramBindLines.join("\n            ")}
            ${varDeclLines.join("\n            ")}
${dummyLines.join("\n")}
          ${closureScopeClose}
        })`;
        if (parentCallHelpers.length > 0) {
          return `(() => {
            ${parentCallHelpers.join("\n            ")}
            return ${closureFunction};
          })()`;
        }
        return closureFunction;
      }

      case "variable": {
        const varName = this.getConstName(node.name || node);
        if (varName === "this") return "this";
        if (this.isSuperglobal(varName)) return `(await ctx.getVar(${JSON.stringify(varName)}))`;
        return this.phpVariableValue(varName);
      }

      case "assignref":
      case "assign": {
        let leftNode = node.left;
        while (leftNode?.kind === "parenthesis" || leftNode?.kind === "parentheses") {
          leftNode = leftNode.inner || leftNode.expr || leftNode.value || leftNode.what;
        }

        if (leftNode?.kind === "list" || (leftNode?.kind === "array" && node.operator === "=")) {
          const rightVal = this.transpileExpr(node.right, filepath);
          return this.transpileListAssign(leftNode, rightVal, filepath);
        }

        if (leftNode?.kind === "variable" && (node.operator || "=") === "=") {
          const variableName = this.getConstName(leftNode.name || leftNode);
          let assignedNode = node.right;
          while (assignedNode?.kind === "parenthesis" || assignedNode?.kind === "parentheses") {
            assignedNode = assignedNode.inner || assignedNode.expr || assignedNode.value || assignedNode.what;
          }
          if (assignedNode?.kind === "new" && assignedNode.what) {
            const className = this.transpileClassReferenceLower(assignedNode.what, filepath);
            if (className.startsWith('"')) this.variableClassNames[variableName] = JSON.parse(className);
            else delete this.variableClassNames[variableName];
          } else if (assignedNode?.kind === "variable") {
            const sourceName = this.getConstName(assignedNode.name || assignedNode);
            const sourceClass = this.variableClassNames[sourceName];
            if (sourceClass) this.variableClassNames[variableName] = sourceClass;
            else delete this.variableClassNames[variableName];
          } else {
            delete this.variableClassNames[variableName];
          }
        }

        const val = this.transpileExpr(node.right, filepath);
        const op = node.operator || "=";
        const isByRef = node.kind === "assignref" || node.byRef || node.byref || node.right?.kind === "byref";

        if (leftNode?.kind === "variable") {
          const varName = this.getConstName(leftNode.name || leftNode);
          if (this.isSuperglobal(varName)) {
            const rightReference = !isByRef ? this.directReferenceExpression(node.right, filepath) : undefined;
            if (rightReference) return `(await ctx.getPHPVar(${JSON.stringify(varName)}).setFrom(${rightReference}))`;
            if (op === "+=") return `(await ctx.setVar(${JSON.stringify(varName)}, ctx.addAssign(await ctx.getVar(${JSON.stringify(varName)}), ${val})))`;
            if (op === "-=") return `(await ctx.setVar(${JSON.stringify(varName)}, (Number(await ctx.getVar(${JSON.stringify(varName)})) || 0) - Number(${val})))`;
            if (op === ".=") return `(await ctx.setVar(${JSON.stringify(varName)}, (await ctx.str(await ctx.getVar(${JSON.stringify(varName)}))) + (await ctx.str(${val}))))`;
            return `(await ctx.setVar(${JSON.stringify(varName)}, ${val}))`;
          }
          const vRef = this.phpVariableReference(varName);
          if (isByRef) {
            let rightNode = node.right;
            while (rightNode?.kind === "byref" || rightNode?.kind === "parenthesis" || rightNode?.kind === "parentheses") {
              rightNode = rightNode.what || rightNode.inner || rightNode.expr;
            }
            if (rightNode?.kind === "variable") {
              const rightName = this.getConstName(rightNode.name || rightNode);
              const rightRef = this.isSuperglobal(rightName)
                ? `ctx.getPHPVar(${JSON.stringify(rightName)})`
                : this.phpVariableReference(rightName);
              return this.currentPhpScopeRequired
                ? `(await (${vRef} = ${rightRef}, ctx.setVar(${JSON.stringify(varName)}, ${vRef})))`
                : `(await (${vRef} = ${rightRef}), await ${vRef}.get())`;
            }
          }
          if (op === "=" && !isByRef) {
            const rightReference = this.directReferenceExpression(node.right, filepath);
            if (rightReference) return `(await ${vRef}.setFrom(${rightReference}))`;
          }
          if (op === "+=") return `(await ${vRef}.set(ctx.addAssign(await ${vRef}.get(), ${val})))`;
          if (op === "-=") return `(await ${vRef}.set((Number(await ${vRef}.get()) || 0) - Number(${val})))`;
          if (op === ".=") return `(await ${vRef}.set((await ctx.str(await ${vRef}.get())) + (await ctx.str(${val}))))`;
          return `(await ${vRef}.set(${val}))`;
        }

        if (leftNode?.kind === "propertylookup") {
          const obj = this.transpileExpr(leftNode.what, filepath);
          const prop = this.transpilePropertyOffset(leftNode.offset, filepath);
          const propertyRef = this.propertyAccessExpression(obj, leftNode.offset, filepath);
          if (!this.hasDirectPhpProperty(leftNode.what, leftNode.offset)) {
            if (op === ".=") return `(await (async () => { const __old = await ctx.str(await ctx.getProperty(${obj}, ${prop})); return await ctx.setProperty(${obj}, ${prop}, __old + await ctx.str(${val})); })())`;
            if (op === "+=") return `(await (async () => { const __old = await ctx.getProperty(${obj}, ${prop}); return await ctx.setProperty(${obj}, ${prop}, ctx.addAssign(__old, ${val})); })())`;
            if (op === "-=") return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; return await ctx.setProperty(${obj}, ${prop}, __old - Number(${val})); })())`;
            return `(await ctx.setProperty(${obj}, ${prop}, ${val}))`;
          }
          if (op === "=" && !isByRef) {
            const rightReference = this.directReferenceExpression(node.right, filepath);
            if (rightReference) return `(await ${propertyRef}.setFrom(${rightReference}))`;
          }
          if (op === "+=") return `(await ${propertyRef}.set(ctx.addAssign(await ${propertyRef}.get(), ${val})))`;
          if (op === "-=") return `(await ${propertyRef}.set((Number(await ${propertyRef}.get()) || 0) - Number(${val})))`;
          if (op === ".=") return `(await ${propertyRef}.set((await ctx.str(await ${propertyRef}.get())) + (await ctx.str(${val}))))`;
          return `(await ${propertyRef}.set(${val}))`;
        }

        if (leftNode?.kind === "staticlookup") {
          const classExpr = this.transpileClassValue(leftNode.what, filepath);
          const prop = this.transpilePropertyOffset(leftNode.offset, filepath);
          const propertyRef = this.propertyAccessExpression(classExpr, leftNode.offset, filepath, true);
          if (op === "=" && !isByRef) {
            const rightReference = this.directReferenceExpression(node.right, filepath);
            if (rightReference) return `(await ${propertyRef}.setFrom(${rightReference}))`;
          }
          if (op === "+=") return `(await ${propertyRef}.set(ctx.addAssign(await ${propertyRef}.get(), ${val})))`;
          if (op === "-=") return `(await ${propertyRef}.set((Number(await ${propertyRef}.get()) || 0) - Number(${val})))`;
          if (op === ".=") return `(await ${propertyRef}.set((await ctx.str(await ${propertyRef}.get())) + (await ctx.str(${val}))))`;
          return `(await ${propertyRef}.set(${val}))`;
        }

        if (leftNode?.kind === "offsetlookup") {
          const offsets: string[] = [];
          let current = leftNode;
          while (current?.kind === "offsetlookup") {
            offsets.unshift(current.offset ? this.transpileExpr(current.offset, filepath) : "null");
            current = current.what;
            while (current?.kind === "parenthesis" || current?.kind === "parentheses") {
              current = current.inner || current.expr || current.value || current.what;
            }
          }
          let rightVal = val;
          if (isByRef) {
            let rightNode = node.right;
            while (rightNode?.kind === "byref" || rightNode?.kind === "parenthesis" || rightNode?.kind === "parentheses") {
              rightNode = rightNode.what || rightNode.inner || rightNode.expr;
            }
            if (rightNode?.kind === "variable") {
              const rightName = this.getConstName(rightNode.name || rightNode);
              rightVal = this.phpVariableReference(rightName);
            }
          }
          if (current?.kind === "propertylookup") {
            const obj = this.transpileExpr(current.what, filepath);
            const prop = this.transpilePropertyOffset(current.offset, filepath);
            return `(await ctx.setPropertyOffsets(${obj}, ${prop}, [${offsets.join(", ")}], ${rightVal}))`;
          }
          if (current?.kind === "staticlookup") {
            const className = this.transpileClassReference(current.what, filepath);
            const propName = this.getConstName(current.offset);
            return `(await ctx.setStaticPropertyOffsets(${className}, ${JSON.stringify(propName)}, [${offsets.join(", ")}], ${rightVal}))`;
          }
          const varName = this.getConstName(current);
          if (varName) {
            if (this.isSuperglobal(varName) && varName === "GLOBALS") {
              const offsetsStr = `[${offsets.join(", ")}]`;
              if (op === "+=") return `(await (async () => { const __old = await ctx.getVarOffsets(String((${offsetsStr})[0]), (${offsetsStr}).slice(1)); return await ctx.setGlobalVar(String((${offsetsStr})[0]), (${offsetsStr}).slice(1), await ctx.addAssign(__old, ${val})); })())`;
              if (op === "-=") return `(await (async () => { const __old = Number(await ctx.getVarOffsets(String((${offsetsStr})[0]), (${offsetsStr}).slice(1))) || 0; return await ctx.setGlobalVar(String((${offsetsStr})[0]), (${offsetsStr}).slice(1), __old - Number(${val})); })())`;
              if (op === ".=") return `(await (async () => { const __old = String(await ctx.getVarOffsets(String((${offsetsStr})[0]), (${offsetsStr}).slice(1))) ?? ""; return await ctx.setGlobalVar(String((${offsetsStr})[0]), (${offsetsStr}).slice(1), __old + String(${val})); })())`;
              if (node.byRef || node.byref || node.right?.kind === "byref") {
                return `(await (async () => { const __r = ${rightVal}; const __os = [${offsets.join(", ")}]; return await ctx.setGlobalVar(String(__os[0]), __os.slice(1), __r); })())`;
              }
              return `(await ctx.setGlobalVar(String((${offsetsStr})[0]), (${offsetsStr}).slice(1), ${rightVal}))`;
            }
            if (node.byRef || node.byref || node.right?.kind === "byref") {
              return `(await (async () => { const __r = ${rightVal}; return await ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __r); })())`;
            }
            if (op === "+=") return `(await (async () => { const __old = await ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}]); return await ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], await ctx.addAssign(__old, ${val})); })())`;
            if (op === "-=") return `(await (async () => { const __old = Number(await ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; return await ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old - Number(${val})); })())`;
            if (op === ".=") return `(await (async () => { const __old = String(await ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}]) ?? ""); return await ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + String(${val})); })())`;
            return `(await ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], ${rightVal}))`;
          }
        }

        throw new PHPFatalError(`Unsupported assignment target: ${leftNode?.kind || "unknown"}`);
      }

      case "array": {
        const items = node.items || [];
        const isAssoc = items.some((item: any) => item?.key !== null && item?.key !== undefined);
        if (isAssoc) {
          const pairs = items.map((item: any) => {
            const k = item.key ? this.transpileExpr(item.key, filepath) : "null";
            const v = this.transpileExpr(item.value, filepath);
            return `[${k}, ${v}]`;
          });
          return `Object.fromEntries([${pairs.join(", ")}])`;
        }
        const vals = items.map((item: any) => this.transpileExpr(item.value || item, filepath));
        return `[${vals.join(", ")}]`;
      }

      case "offsetlookup": {
        const obj = this.transpileExpr(node.what, filepath);
        const offset = node.offset ? this.transpileExpr(node.offset, filepath) : "undefined";
        return `(await ctx.toVal((${obj})?.[await ctx.toVal(${offset})]))`;
      }

      case "propertylookup": {
        const obj = this.transpileExpr(node.what, filepath);
        const prop = this.transpilePropertyOffset(node.offset, filepath);
        return this.hasDirectPhpProperty(node.what, node.offset)
          ? `(await ${this.propertyAccessExpression(obj, node.offset, filepath)}.get())`
          : `(await ctx.getProperty(${obj}, ${prop}))`;
      }

      case "nullsafepropertylookup": {
        const obj = this.transpileExpr(node.what, filepath);
        const prop = this.transpilePropertyOffset(node.offset, filepath);
        const propertyValue = this.hasDirectPhpProperty(node.what, node.offset)
          ? `await ${this.propertyAccessExpression("__o", node.offset, filepath)}.get()`
          : `await ctx.getProperty(__o, ${prop})`;
        return `(await (async () => { const __o = ${obj}; return (__o !== null && __o !== undefined) ? ${propertyValue} : null; })())`;
      }

      case "encapsed": {
        const parts = (node.value || []).map((part: any) => {
          if (typeof part === "string") return JSON.stringify(part);
          if (part.kind === "string" || part.kind === "number") return JSON.stringify(String(part.value));
          return `String((${this.transpileExpr(part, filepath)}) ?? "")`;
        });
        return `(${parts.join(" + ")})`;
      }

      case "encapsedpart": {
        if (node.expression || node.value || node.curly || node.what) {
          const inner = node.expression || node.value || node.curly || node.what;
          if (typeof inner === "string") return JSON.stringify(inner);
          return `String((${this.transpileExpr(inner, filepath)}) ?? "")`;
        }
        return '""';
      }

      case "pre":
      case "post": {
        const isInc = node.type === "+" || node.type === "++";
        const delta = isInc ? 1 : -1;
        if (node.what?.kind === "variable") {
          const varName = this.getConstName(node.what.name || node.what);
          if (this.isSuperglobal(varName)) {
            if (node.kind === "pre") {
              return `(await ctx.setVar(${JSON.stringify(varName)}, (Number(await ctx.getVar(${JSON.stringify(varName)})) || 0) + ${delta}))`;
            }
            return `(await (async () => { const __old = Number(await ctx.getVar(${JSON.stringify(varName)})) || 0; await ctx.setVar(${JSON.stringify(varName)}, __old + ${delta}); return __old; })())`;
          }
          const vRef = this.phpVariableReference(varName);
          if (node.kind === "pre") {
            return `(await ${vRef}.set((Number(await ${vRef}.get()) || 0) + ${delta}))`;
          }
          return `(await (async () => { const __old = Number(await ${vRef}.get()) || 0; await ${vRef}.set(__old + ${delta}); return __old; })())`;
        }
        if (node.what?.kind === "offsetlookup") {
          const offsets: string[] = [];
          let current = node.what;
          while (current?.kind === "offsetlookup") {
            offsets.unshift(current.offset ? this.transpileExpr(current.offset, filepath) : "null");
            current = current.what;
          }
          if (current?.kind === "variable") {
            const varName = this.getConstName(current.name || current);
            if (node.kind === "pre") {
              return `(await (async () => { const __old = Number(await ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; return await ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + ${delta}); })())`;
            }
            return `(await (async () => { const __old = Number(await ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; await ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + ${delta}); return __old; })())`;
          }
        }
        if (node.what?.kind === "propertylookup") {
          const obj = this.transpileExpr(node.what.what, filepath);
          const prop = this.transpilePropertyOffset(node.what.offset, filepath);
          if (node.kind === "pre") {
            return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; await ctx.setProperty(${obj}, ${prop}, __old + ${delta}); return __old + ${delta}; })())`;
          }
          return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; await ctx.setProperty(${obj}, ${prop}, __old + ${delta}); return __old; })())`;
        }
        return "0";
      }

      case "unary": {
        const val = this.transpileExpr(node.what, filepath);
        if (node.type === "!") return `(!(await ctx.isTruthy(${val})))`;
        if (node.type === "+") return `(+${val})`;
        if (node.type === "-") return `(-${val})`;
        return `${node.type}${val}`;
      }

      case "isset": {
        const argsList = node.variables || node.arguments || [node.variable || node.expr || node.expression || node.value].filter(Boolean);
        const args = (Array.isArray(argsList) ? argsList : [argsList]).map((v: any) =>
          this.transpileExpr(v, filepath)
        );
        return `(await ctx.isset(${args.map((a: string) => `async () => ${a}`).join(", ")}))`;
      }

      case "empty": {
        const exprNode = node.expr || node.expression || node.variable || node.value || (node.arguments && node.arguments[0]);
        const val = exprNode ? this.transpileExpr(exprNode, filepath) : "null";
        return `(await ctx.isEmpty(async () => ${val}))`;
      }

      case "new": {
        if (node.what?.kind === "class") {
          const anonName = `AnonymousClass_${++this.anonClassCounter}`;
          const anonNode = { ...node.what, name: anonName };
          const anonLines: string[] = [];
          this.transpileStmt(anonNode, anonLines, Object.create(null), new SourceMapGenerator(), filepath, 0);
          const rawArgs = this.transpileCallArgs(node.arguments, filepath);
          const lowerName = JSON.stringify(anonName.toLowerCase());
          return `(await (async () => { ${anonLines.join("\n")}; const __cls = await ctx.resolveClass(${lowerName}); return await __cls[SYMBOL_PHP_NEW](${this.withContextArgs(rawArgs)}); })())`;
        }
        if (node.what?.kind === "staticreference" || this.getConstName(node.what).toLowerCase() === "static") {
          const rawArgs = this.transpileCallArgs(node.arguments, filepath);
          return `(await this[SYMBOL_PHP_NEW](${this.withContextArgs(rawArgs)}))`;
        }
        const rawArgs = this.transpileCallArgs(node.arguments, filepath);
        const classExpr = this.transpileClassValue(node.what, filepath);
        return `(await ${classExpr}[SYMBOL_PHP_NEW](${this.withContextArgs(rawArgs)}))`;
      }

      case "bin":
      case "binary": {
        const op = node.type || node.operator || "=";
        if (op === "=" || op === "+=" || op === "-=" || op === ".=" || op === "*=" || op === "/=") {
          return this.transpileExpr({ ...node, kind: "assign", operator: op }, filepath);
        }
        const left = this.transpileExpr(node.left, filepath);
        if (op === "<=>") {
          const right = this.transpileExpr(node.right, filepath);
          return `(await (async () => { const __l = ${left}; const __r = ${right}; return __l < __r ? -1 : (__l > __r ? 1 : 0); })())`;
        }
        if (op === "instanceof") {
          const r = node.right;
          if (r && typeof r === "object" && (r.kind === "variable" || r.kind === "propertylookup" || r.kind === "staticlookup" || r.kind === "call" || r.kind === "arraylookup")) {
            const right = this.transpileExpr(r, filepath);
            return `(await ctx.isInstanceOf(${left}, ${right}))`;
          } else {
            const rightName = this.transpileClassReferenceLower(r, filepath);
            return `(await ctx.isInstanceOf(${left}, ${rightName}))`;
          }
        }
        const right = this.transpileExpr(node.right, filepath);
        if (op === "xor") return `((await ctx.isTruthy(${left}) ? 1 : 0) !== (await ctx.isTruthy(${right}) ? 1 : 0))`;
        if (op === "and" || op === "&&") return `(await ctx.isTruthy(${left}) && await ctx.isTruthy(${right}))`;
        if (op === "or" || op === "||") return `(await ctx.isTruthy(${left}) || await ctx.isTruthy(${right}))`;
        if (op === ".") return `((await ctx.str(${left})) + (await ctx.str(${right})))`;
        if (op === "+") return `(await ctx.add(${left}, ${right}))`;
        if (op === "==" || op === "===" || op === "!=" || op === "!==" || op === "<>") {
          return `(await ctx.equals(${left}, ${right}, ${op === "===" || op === "!==" ? "true" : "false"}, ${op.startsWith("!") || op === "<>" ? "true" : "false"}))`;
        }
        return `(${left} ${op} ${right})`;
      }

      case "include": {
        const target = this.transpileExpr(node.target || node.expr || node.what, filepath);
        if (node.once) {
          return node.require
            ? `(await ctx.requireOnce(${target}))`
            : `(await ctx.includeOnce(${target}))`;
        }
        return node.require
          ? `(await ctx.require(${target}))`
          : `(await ctx.include(${target}))`;
      }

      case "ternary": {
        const test = this.transpileExpr(node.test, filepath);
        const iftrue = node.trueExpr ? this.transpileExpr(node.trueExpr, filepath) : test;
        const iffalse = this.transpileExpr(node.falseExpr, filepath);
        return `((await ctx.isTruthy(${test})) ? ${iftrue} : ${iffalse})`;
      }

      case "call": {
        const originalName = this.getConstName(node.what) || "func";
        const name = originalName.toLowerCase();
        if (name === "include" || name === "include_once" || name === "require" || name === "require_once") {
          const fileArg = this.transpileExpr((node.arguments || [])[0], filepath);
          if (name === "include") return `(await ctx.include(${fileArg}))`;
          if (name === "include_once") return `(await ctx.includeOnce(${fileArg}))`;
          if (name === "require") return `(await ctx.require(${fileArg}))`;
          if (name === "require_once") return `(await ctx.requireOnce(${fileArg}))`;
        }

        const rawArgs = this.transpileCallArgs(node.arguments, filepath);

        if (node.what?.kind === "staticlookup") {
          const isParent = node.what.what?.kind === "parentreference" || this.getConstName(node.what.what).toLowerCase() === "parent";
          const method = this.methodAccessExpression(isParent ? "super" : this.transpileClassValue(node.what.what, filepath), node.what.offset, filepath, true);
          if (isParent) {
            const parentHelper = this.closureParentCallHelper(node.what.offset, method);
            return `(await ${parentHelper || method}(${this.withContextArgs(rawArgs)}))`;
          }
          return `(await ${method}(${this.withContextArgs(rawArgs)}))`;
        }

        if (node.what?.kind === "propertylookup") {
          const staticClassName = this.staticMethodClass(node.what.what, node.what.offset);
          const isStatic = staticClassName !== undefined;
          const obj = isStatic
            ? this.classValueForObject(node.what.what, staticClassName, filepath)
            : this.transpileExpr(node.what.what, filepath);
          const method = this.methodAccessExpression(obj, node.what.offset, filepath, isStatic);
          return `(await ${method}(${this.withContextArgs(rawArgs)}))`;
        }

        if (node.what?.kind === "nullsafepropertylookup") {
          const obj = this.transpileExpr(node.what.what, filepath);
          const method = this.methodAccessExpression("__object", node.what.offset, filepath);
          return `(await (async () => { const __object = ${obj}; return __object === null || __object === undefined ? null : await ${method}(${this.withContextArgs(rawArgs)}); })())`;
        }

        if (node.what?.kind === "variable") {
          const fnExpr = this.transpileExpr(node.what, filepath);
          const namespace = this.getNamespaceContext(node).name;
          const functionKey = namespace
            ? `(__name.includes("$$") ? __name : ${JSON.stringify(`${namespace}$$`)} + __name)`
            : "__name";
          return `(await (async () => { const __callback = await ctx.toVal(${fnExpr}); const __name = normalizePhpRegistryName(String(__callback)); const __key = ${functionKey}; const __fn = typeof __callback === "function" ? __callback : (ctx.functions[__key] ?? ctx.functions[__name] ?? ctx.functionMissing(String(__callback))); return await __fn(${this.withContextArgs(rawArgs)}); })())`;
        }

        const staticFunction = this.getStaticFunctionCall(node);
        return `(await ${this.functionCallTarget(staticFunction?.key || name, originalName, staticFunction?.fallbackName)}(${this.withContextArgs(rawArgs)}))`;
      }
      case "staticlookup": {
        const classExpr = this.transpileClassValue(node.what, filepath);
        const origClassName = this.transpileClassReferenceOriginal(node.what, filepath);
        const member = this.getConstName(node.offset);
        const isStaticProp = node.offset?.kind === "variable" || node.offset?.kind === "property" || member.startsWith("$");
        if (member.toLowerCase() === "class" && !isStaticProp) return `${origClassName}`;
        if (isStaticProp) {
          return `(await ${this.propertyAccessExpression(classExpr, node.offset, filepath, true)}.get())`;
        }
        const constant = member.toLowerCase();
        return `(await ctx.getClassConstant(${classExpr}, ${JSON.stringify(constant)}, ${origClassName}))`;
      }

      case "selfreference":
        return JSON.stringify(this.currentClassName);
      case "staticreference":
        return `normalizePhpRegistryName(this?.[SYMBOL_PHP_NAME] || this?.[SYMBOL_PHP_CLASS]?.[SYMBOL_PHP_NAME] || ${JSON.stringify(this.currentClassNameOriginal || this.currentClassName)})`;
      case "parentreference":
        return `normalizePhpRegistryName((await ctx.resolveClass(${JSON.stringify(this.currentClassName)}))[SYMBOL_PHP_PARENT]?.[SYMBOL_PHP_NAME] || (await ctx.resolveClass(${JSON.stringify(this.currentClassName)}))[SYMBOL_PHP_PARENT]?.name || "Object")`;

      case "parenthesis":
      case "parentheses": {
        const inner = node.inner || node.expr || node.value || node.what;
        return inner ? `(${this.transpileExpr(inner, filepath)})` : "undefined";
      }

      case "null":
      case "nil":
      case "nullkeyword":
        return "null";

      case "exit":
      case "die": {
        const statusNode = node.expression || node.status || node.expr || node.value;
        const status = statusNode ? this.transpileExpr(statusNode, filepath) : "0";
        return `(await ${this.functionCallTarget("exit")}(${this.withContextArgs([`new PHPLiteral(${status})`])}))`;
      }

      case "retif":
      case "ternary": {
        const test = this.transpileExpr(node.test || node.cond, filepath);
        const iftrue = (node.trueExpr || node.true || node.value) ? this.transpileExpr(node.trueExpr || node.true || node.value, filepath) : test;
        const iffalse = this.transpileExpr(node.falseExpr || node.false || node.alternate, filepath);
        return `((await ctx.isTruthy(${test})) ? ${iftrue} : ${iffalse})`;
      }

      case "cast": {
        const val = this.transpileExpr(node.expr || node.what || node.value, filepath);
        const type = (node.type || node.raw || "").toLowerCase();
        if (type === "bool" || type === "boolean") return `(await ctx.isTruthy(${val}))`;
        if (type === "int" || type === "integer") return `(Number(parseInt(String(${val}), 10)) || 0)`;
        if (type === "float" || type === "double" || type === "real") return `(Number(parseFloat(String(${val}))) || 0)`;
        if (type === "string") return `(await ctx.str(${val}))`;
        if (type === "array") return `(Array.isArray(${val}) ? ${val} : (${val} === null || ${val} === undefined) ? [] : (typeof ${val} === "object") ? ${val} : [${val}])`;
        if (type === "object") return `(typeof ${val} === "object" && ${val} !== null ? ${val} : { scalar: ${val} })`;
        return val;
      }

      case "postinc":
        return this.transpileExpr({ ...node, kind: "post", type: "+" }, filepath);

      case "preinc":
        return this.transpileExpr({ ...node, kind: "pre", type: "+" }, filepath);

      case "postdec":
        return this.transpileExpr({ ...node, kind: "post", type: "-" }, filepath);

      case "predec":
        return this.transpileExpr({ ...node, kind: "pre", type: "-" }, filepath);

      case "silent":
      case "silence": {
        const expr = this.transpileExpr(node.expr || node.what || node.inner, filepath);
        return `(await (async () => { const __oldLevel = ctx.errorReportingLevel; ctx.errorReportingLevel = 0; try { return await (${expr}); } finally { ctx.errorReportingLevel = __oldLevel; } })())`;
      }

      case "list": {
        const items = (node.items || node.arguments || node.value || []).map((item: any) => {
          if (!item || item.kind === "noop") return "null";
          const target = item.kind === "entry" ? item.value : item;
          return target ? this.transpileExpr(target, filepath) : "null";
        });
        return `[${items.join(", ")}]`;
      }

      case "empty": {
        const expr = node.expr || node.value || node.what;
        const val = expr ? this.transpileExpr(expr, filepath) : "undefined";
        return `(await ctx.isEmpty(async () => ${val}))`;
      }

      case "isset": {
        const args = (node.variables || node.arguments || node.value || []).map((v: any) => {
          const val = this.transpileExpr(v, filepath);
          return `async () => ${val}`;
        });
        return `(await ctx.isset(${args.join(", ")}))`;
      }

      case "eval": {
        const code = this.transpileExpr(node.expr || node.value || node.what, filepath);
        return `(await ctx.eval(String(${code} ?? "")))`;
      }

      case "print": {
        const expr = this.transpileExpr(node.expr || node.value || node.what, filepath);
        return `(await (async () => { await ctx.echo(${expr}); return 1; })())`;
      }

      case "clone": {
        const expr = this.transpileExpr(node.expr || node.value || node.what, filepath);
        return `(await ctx.cloneObject(${expr}))`;
      }

      case "yield": {
        const expr = node.value || node.expr ? this.transpileExpr(node.value || node.expr, filepath) : "null";
        return `(yield ${expr})`;
      }

      case "yieldfrom": {
        const expr = this.transpileExpr(node.value || node.expr, filepath);
        return `(yield* ${expr})`;
      }

      case "goto": {
        throw new Error("GOTO is not implemented");
      }

      case "assignref": {
        return this.transpileExpr({ ...node, kind: "assign" }, filepath);
      }

      case "reference":
      case "byref": {
        const expr = node.what || node.expr || node.value;
        if (expr?.kind === "variable") {
          const varName = (expr.name?.name || expr.name).toString();
          return `ctx.getVarRef(${JSON.stringify(varName)})`;
        }
        return expr ? this.transpileExpr(expr, filepath) : "null";
      }

      case "noop":
        return "";

      case "variadic": {
        const expr = node.what || node.value || node.expr || node.argument;
        const val = expr ? this.transpileExpr(expr, filepath) : "[]";
        return `...(${val} || [])`;
      }

      case "identifier": {
        const idName = (node.name || node.value || "").toString();
        return JSON.stringify(idName);
      }

      case "nowdoc": {
        const val = typeof node.value === "string" ? node.value : (node.value?.value || String(node.value || ""));
        return JSON.stringify(val);
      }

      case "heredoc": {
        if (typeof node.value === "string") return JSON.stringify(node.value);
        if (Array.isArray(node.value)) {
          const parts = node.value.map((part: any) => {
            if (typeof part === "string") return JSON.stringify(part);
            if (part.kind === "string" || part.kind === "number") return JSON.stringify(String(part.value));
            if (part.kind === "variable") return `String(ctx.getVar(${JSON.stringify(part.name?.name || part.name)}) ?? "")`;
            return `String(${this.transpileExpr(part, filepath)} ?? "")`;
          });
          return `(${parts.join(" + ")})`;
        }
        return JSON.stringify(String(node.value || ""));
      }

      case "raw":
        return node.code || "";

      default:
        throw new Error(`Not Implemented expression kind: ${node?.kind}`);
    }
  }
}
