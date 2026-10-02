import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { SourceMapGenerator } from "source-map";
import { SourceMapRegistry, PHPLineLocation } from "../runtime/SourceMapRegistry";
import { PHPFatalError } from "../runtime/PHPError";
import type { PHPEngine } from "../PHPEngine";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineParser = require("php-parser");

export interface TranspileOptions {
  engineSHA1?: string;
  cacheDir?: string;
  engine?: PHPEngine;
}

export interface TranspilationResult {
  code: string;
  map?: string;
}

export class JSTranspiler {
  private parser: any;
  private currentClassName = "";
  private currentClassNameOriginal = "";
  private currentNamespaceName = "";
  private currentNamespaceNameOriginal = "";
  private classImports: Map<string, string> = new Map();
  private classImportsOriginal: Map<string, string> = new Map();
  private switchLabelCounter = 0;
  private switchLabelStack: string[] = [];
  private foreachDepth = 0;

  constructor() {
    this.parser = new engineParser({
      parser: {
        extractDoc: true,
        phpVersion: "8.1",
        suppressErrors: true,
      },
      ast: {
        withPositions: true,
      },
    });
  }

  public transpile(code: string, filepath: string = "eval", options: TranspileOptions = {}): TranspilationResult {
    const codeHash = crypto.createHash("sha1").update(code).digest("hex");
    const engineHash = options.engineSHA1 || "default";
    const cacheFileName = `${codeHash}_${engineHash}.js`;

    if (options.cacheDir) {
      const cachedFilePath = path.join(options.cacheDir, cacheFileName);
      if (fs.existsSync(cachedFilePath)) {
        try {
          const cachedCode = fs.readFileSync(cachedFilePath, "utf8");
          return { code: cachedCode };
        } catch {
          // Ignore cache read error
        }
      }
    }

    const codeToParse = code.includes("<?") ? code : "<?php\n" + code;
    const parser = new engineParser({
      parser: {
        extractDoc: true,
        phpVersion: "8.1",
        suppressErrors: true,
      },
      ast: {
        withPositions: true,
      },
    });
    const ast = parser.parseCode(codeToParse, filepath);

    let finalAst = ast;
    if (options.engine) {
      const { ASTOptimizer } = require("./ASTOptimizer");
      finalAst = ASTOptimizer.optimize(ast, options.engine);
    }

    const mapGen = new SourceMapGenerator({ file: filepath });
    const lines: string[] = [];
    const lineMap = new Map<number, PHPLineLocation>();

    lines.push("module.exports = async function(ctx) {");
    lines.push("  try {");

    this.currentClassName = "";
    this.currentNamespaceName = "";
    this.classImports.clear();

    const bodyNodes = finalAst?.children || finalAst?.body || (Array.isArray(finalAst) ? finalAst : [finalAst]);

    const topFuncs = bodyNodes.filter((n: any) => n?.kind === "function");
    for (const funcNode of topFuncs) {
      const funcName = (funcNode.name?.name || funcNode.name || "").toString().toLowerCase();
      const safeFnId = funcName.replace(/[^a-zA-Z0-9_]/g, "_");
      lines.push(`    if (typeof __fn_${safeFnId} === "function") {`);
      lines.push(`      ctx.functions[${JSON.stringify(funcName)}] = __fn_${safeFnId};`);
      lines.push(`      ctx.engine.functions[${JSON.stringify(funcName)}] = __fn_${safeFnId};`);
      lines.push(`    }`);
    }

    this.transpileNodeList(bodyNodes, lines, lineMap, mapGen, filepath, 4, "{main}");

    lines.push("  } catch (err) {");
    lines.push("    throw err;");
    lines.push("  }");
    lines.push("};");

    const fullCode = lines.join("\n");

    SourceMapRegistry.register(filepath, lineMap);

    if (options.cacheDir) {
      const lockPath = path.join(options.cacheDir, `${cacheFileName}.lock`);
      try {
        fs.mkdirSync(options.cacheDir, { recursive: true });
        const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
        fs.closeSync(fd);
        fs.writeFileSync(path.join(options.cacheDir, cacheFileName), fullCode, "utf8");
        fs.unlinkSync(lockPath);
      } catch {
        // Ignore cache write error or lock contention
      }
    }

    return {
      code: fullCode,
      map: mapGen.toString(),
    };
  }

  private transpileNodeList(
    nodes: any[],
    lines: string[],
    lineMap: Map<number, PHPLineLocation>,
    mapGen: SourceMapGenerator,
    filepath: string,
    indent: number,
    currentFunc: string
  ): void {
    if (!nodes) return;
    const nodeList = Array.isArray(nodes) ? nodes : [nodes];

    for (const node of nodeList) {
      if (!node) continue;
      lines.push(`${" ".repeat(indent)}if (++ctx.tickCount > 50000) ctx.checkLoop(${JSON.stringify(filepath)}, ${node.loc?.start?.line || 0});`);
      const startLine = lines.length + 1;
      this.transpileStmt(node, lines, lineMap, mapGen, filepath, indent);
      const endLine = lines.length;

      const phpLine = node.loc?.start?.line;
      if (phpLine) {
        for (let l = startLine; l <= endLine; l++) {
          lineMap.set(l, { file: filepath, line: phpLine, function: currentFunc });
          if (mapGen) {
            mapGen.addMapping({
              generated: { line: l, column: 0 },
              original: { line: phpLine, column: 0 },
              source: filepath,
              name: currentFunc,
            });
          }
        }
      }
    }
  }

  private transpileStmt(
    node: any,
    lines: string[],
    lineMap: Map<number, PHPLineLocation>,
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
        this.currentNamespaceNameOriginal = this.getConstName(node.name || node.namespace || "");
        this.currentNamespaceName = this.currentNamespaceNameOriginal.toLowerCase();
        const children = node.children || node.body || [];
        this.transpileNodeList(children, lines, lineMap, mapGen, filepath, indent, "{main}");
        break;
      }

      case "usegroup": {
        for (const item of node.items || []) {
          const importedName = this.getConstName(item.name || item);
          const alias = this.getConstName(item.alias) || importedName.split("\\").pop()!;
          this.classImports.set(alias.toLowerCase(), importedName.toLowerCase());
          this.classImportsOriginal.set(alias.toLowerCase(), importedName);
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
        lines.push(`${pad}if (ctx.isTruthy(${cond})) {`);
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
        const cond = this.transpileExpr(node.test, filepath);
        lines.push(`${pad}while (ctx.isTruthy(${cond})) {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
        lines.push(`${pad}}`);
        break;
      }

      case "do": {
        const cond = this.transpileExpr(node.test, filepath);
        lines.push(`${pad}do {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
        lines.push(`${pad}} while (ctx.isTruthy(${cond}));`);
        break;
      }

      case "for": {
        const init = (node.init || []).map((e: any) => this.transpileExpr(e, filepath)).join(", ");
        const test = (node.test || []).map((e: any) => this.transpileExpr(e, filepath)).join(" && ") || "true";
        const increment = (node.increment || []).map((e: any) => this.transpileExpr(e, filepath)).join(", ");

        if (init) lines.push(`${pad}${init};`);
        lines.push(`${pad}while (ctx.isTruthy(${test})) {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
        if (increment) lines.push(`${pad}  ${increment};`);
        lines.push(`${pad}}`);
        break;
      }

      case "foreach": {
        const source = this.transpileExpr(node.source, filepath);
        const keyVar = node.key ? (node.key.name?.name || node.key.name || node.key.value) : null;
        const valueVar = node.value ? (node.value.name?.name || node.value.name || node.value.value) : "value";

        const savedSwitchStack = this.switchLabelStack;
        this.switchLabelStack = [];
        this.foreachDepth++;
        try {
          lines.push(`${pad}var __fe_res = await (async () => {`);
          lines.push(`${pad}  const __src = ${source};`);
          lines.push(`${pad}  const __entries = Array.isArray(__src) ? __src.map((v, i) => [i, v]) : Object.entries(__src || {});`);
          lines.push(`${pad}  for (const [__k, __v] of __entries) {`);
          if (keyVar) lines.push(`${pad}    ctx.setVar(${JSON.stringify(keyVar)}, __k);`);
          lines.push(`${pad}    ctx.setVar(${JSON.stringify(valueVar)}, __v);`);
          this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 4, "{main}");
          lines.push(`${pad}  }`);
          lines.push(`${pad}})();`);
          if (savedSwitchStack.length > 0) {
            lines.push(`${pad}if (__fe_res?.break) {`);
            lines.push(`${pad}  break ${savedSwitchStack[savedSwitchStack.length - 1]};`);
            lines.push(`${pad}}`);
          }
        } finally {
          this.switchLabelStack = savedSwitchStack;
          this.foreachDepth--;
        }
        break;
      }

      case "switch": {
        const swLabel = `sw_${++this.switchLabelCounter}`;
        this.switchLabelStack.push(swLabel);
        const test = this.transpileExpr(node.test, filepath);
        lines.push(`${pad}${swLabel}: {`);
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
        this.switchLabelStack.pop();
        break;
      }

      case "return": {
        const value = node.expr ? this.transpileExpr(node.expr, filepath) : "undefined";
        lines.push(`${pad}return ${value};`);
        break;
      }

      case "global": {
        for (const v of node.items || []) {
          const varName = (v.name?.name || v.name || v).toString();
          lines.push(`${pad}ctx.bindGlobal(${JSON.stringify(varName)});`);
        }
        break;
      }

      case "static": {
        for (const v of node.result || node.items || []) {
          const varName = (v.variable?.name?.name || v.variable?.name || v.variable || v.name?.name || v.name || v).toString();
          const valueNode = v.defaultValue || v.value;
          const value = valueNode ? this.transpileExpr(valueNode, filepath) : "undefined";
          lines.push(`${pad}ctx.initStaticVar(${JSON.stringify(this.currentClassName)}, ${JSON.stringify(varName)}, ${value});`);
        }
        break;
      }

      case "unset": {
        for (const v of node.variables || node.expressions || []) {
          if (v.kind === "variable") {
            const varName = (v.name?.name || v.name).toString();
            lines.push(`${pad}delete ctx.vars[${JSON.stringify(varName)}];`);
          } else if (v.kind === "offsetlookup") {
            const offsets: string[] = [];
            let current = v;
            while (current?.kind === "offsetlookup") {
              offsets.unshift(current.offset ? this.transpileExpr(current.offset, filepath) : "null");
              current = current.what;
            }
            const varName = this.getConstName(current);
            if (varName) {
              lines.push(`${pad}ctx.unsetVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}]);`);
            } else {
              const obj = this.transpileExpr(v.what, filepath);
              const offset = this.transpileExpr(v.offset, filepath);
              lines.push(`${pad}if ((${obj}) !== undefined && (${obj}) !== null) delete (${obj})[${offset}];`);
            }
          }
        }
        break;
      }

      case "try": {
        lines.push(`${pad}try {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
        lines.push(`${pad}} catch (__err) {`);

        for (const catchNode of node.catches || []) {
          const catchVar = this.getConstName(catchNode.variable) || "e";
          lines.push(`${pad}  ctx.setVar(${JSON.stringify(catchVar)}, __err);`);
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
        if (this.foreachDepth > 0) {
          lines.push(`${pad}return { break: true };`);
        } else if (this.switchLabelStack.length > 0) {
          lines.push(`${pad}break ${this.switchLabelStack[this.switchLabelStack.length - 1]};`);
        } else {
          lines.push(`${pad}break;`);
        }
        break;
      }

      case "continue": {
        lines.push(`${pad}continue;`);
        break;
      }

      case "exit":
      case "die": {
        const statusNode = node.expression || node.status || node.expr || node.value;
        const status = statusNode ? this.transpileExpr(statusNode, filepath) : "0";
        lines.push(`${pad}await ctx.callFunction("exit", [${status}]);`);
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
          const alias = item.alias ? this.getConstName(item.alias) : name.split("\\").pop() || name;
          this.classImports.set(alias.toLowerCase(), name.toLowerCase());
        }
        break;
      }

      case "trait":
      case "interface": {
        const name = (node.name?.name || node.name || "").toString();
        const safeId = name.replace(/[^a-zA-Z0-9_]/g, "_");
        const originalName = this.currentNamespaceName ? `${this.currentNamespaceName}\\${name}` : name;
        const qualifiedName = originalName.toLowerCase();
        lines.push(`${pad}var __cls_${safeId} = ctx.engine.classes[${JSON.stringify(qualifiedName)}] || new PHPClass(${JSON.stringify(originalName)});`);
        lines.push(`${pad}ctx.classes[${JSON.stringify(qualifiedName)}] = __cls_${safeId};`);
        lines.push(`${pad}ctx.engine.classes[${JSON.stringify(qualifiedName)}] = __cls_${safeId};`);
        break;
      }

      case "function": {
        const originalFuncName = (node.name?.name || node.name || "").toString();
        const funcName = originalFuncName.toLowerCase();
        const safeFnId = funcName.replace(/[^a-zA-Z0-9_]/g, "_");
        const visibility = (node.visibility || "public").toString();
        const params = (node.arguments || []).map((a: any, idx: number) => {
          const pName = (a.name?.name || a.name || "p").toString();
          const hasDefault = Boolean(a.value);
          const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
          return { name: pName, position: idx, byref: Boolean(a.byref || a.byRef), isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
        });

        const requiredCount = params.filter((p: any) => !p.hasDefault).length;
        const isGen = this.containsYield(node.body?.children || node.body);

        lines.push(`${pad}async function${isGen ? "*" : ""} __fn_${safeFnId}(ctx, ...args) {`);
        lines.push(`${pad}  ctx.pushScope();`);
        lines.push(`${pad}  try {`);
        params.forEach((p: any, idx: number) => {
          lines.push(`${pad}    ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`);
        });

        const savedSwitchStack = this.switchLabelStack;
        this.switchLabelStack = [];
        try {
          this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen!, filepath, indent + 2, funcName);
        } finally {
          this.switchLabelStack = savedSwitchStack;
        }

        lines.push(`${pad}  } finally {`);
        lines.push(`${pad}    ctx.popScope();`);
        lines.push(`${pad}  }`);
        lines.push(`${pad}};`);
        lines.push(`${pad}__fn_${safeFnId}.phpMeta = { name: ${JSON.stringify(originalFuncName)}, visibility: ${JSON.stringify(visibility)}, numberOfParameters: ${params.length}, numberOfRequiredParameters: ${requiredCount}, parameters: ${JSON.stringify(params)} };`);
        lines.push(`${pad}ctx.functions[${JSON.stringify(funcName)}] = __fn_${safeFnId};`);
        lines.push(`${pad}ctx.engine.functions[${JSON.stringify(funcName)}] = __fn_${safeFnId};`);
        break;
      }

      case "class": {
        const className = (node.name?.name || node.name || "AnonymousClass").toString();
        const safeClassId = className.replace(/[^a-zA-Z0-9_]/g, "_");
        const originalClassName = this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${className}` : (this.currentNamespaceName ? `${this.currentNamespaceName}\\${className}` : className);
        const qualifiedClassName = originalClassName.toLowerCase();
        const previousClassName = this.currentClassName;
        const previousClassNameOriginal = this.currentClassNameOriginal;
        this.currentClassName = qualifiedClassName;
        this.currentClassNameOriginal = originalClassName;

        const parentClass = node.extends ? `(await ctx.resolveClass(${this.transpileClassReferenceLower(node.extends, filepath)}, ${this.transpileClassReferenceOriginal(node.extends, filepath)}))` : "undefined";
        lines.push(`${pad}var __cls_${safeClassId} = ctx.engine.classes[${JSON.stringify(qualifiedClassName)}] || new PHPClass(${JSON.stringify(originalClassName)}, ${parentClass});`);
        lines.push(`${pad}ctx.classes[${JSON.stringify(qualifiedClassName)}] = __cls_${safeClassId};`);
        lines.push(`${pad}ctx.engine.classes[${JSON.stringify(qualifiedClassName)}] = __cls_${safeClassId};`);

        const bodyItems = Array.isArray(node.body)
          ? node.body
          : Array.isArray(node.body?.children)
          ? node.body.children
          : Array.isArray(node.body?.body)
          ? node.body.body
          : Array.isArray(node.children)
          ? node.children
          : (node.body ? [node.body] : []);

        for (const constant of this.orderClassConstants(bodyItems, qualifiedClassName, filepath)) {
          const name = this.getConstName(constant.name);
          lines.push(`${pad}__cls_${safeClassId}.constants.set(${JSON.stringify(name)}, ${this.transpileExpr(constant.value, filepath)});`);
        }
        for (const item of bodyItems) {
          if (item?.kind === "classconstant") continue;
          if (item?.kind === "propertystatement") {
            const visibility = (item.visibility || "public").toString();
            for (const property of item.properties || []) {
              const name = property.name?.name || property.name;
              const value = property.value ? this.transpileExpr(property.value, filepath) : "null";
              lines.push(`${pad}__cls_${safeClassId}.properties.set(${JSON.stringify(name)}, { name: ${JSON.stringify(name)}, visibility: ${JSON.stringify(visibility)}, isStatic: ${Boolean(item.isStatic)}, isReadOnly: ${Boolean(item.isReadOnly)}, defaultValue: ${value} });`);
            }
          } else if (item?.kind === "method") {
            const mName = (item.name?.name || item.name || "").toString();
            const safeMId = mName.replace(/[^a-zA-Z0-9_]/g, "_");
            const visibility = (item.visibility || "public").toString();
            const params = (item.arguments || []).map((a: any, idx: number) => {
              const pName = (a.name?.name || a.name || "p").toString();
              const hasDefault = Boolean(a.value);
              const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
              return { name: pName, position: idx, byref: Boolean(a.byref), isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
            });

            const requiredCount = params.filter((p: any) => !p.hasDefault).length;
            const isGen = this.containsYield(item.body?.children || item.body);

            lines.push(`${pad}var __method_${safeMId} = async function${isGen ? "*" : ""}(ctx, ...args) {`);
            lines.push(`${pad}  ctx.pushScope();`);
            lines.push(`${pad}  try {`);
            params.forEach((p: any, idx: number) => {
              lines.push(`${pad}    ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`);
            });

            const savedSwitchStack = this.switchLabelStack;
            this.switchLabelStack = [];
            try {
              this.transpileNodeList(item.body?.children || item.body, lines, lineMap, mapGen!, filepath, indent + 4, mName);
            } finally {
              this.switchLabelStack = savedSwitchStack;
            }

            lines.push(`${pad}  } finally {`);
            lines.push(`${pad}    ctx.popScope();`);
            lines.push(`${pad}  }`);
            lines.push(`${pad}};`);

            lines.push(`${pad}__cls_${safeClassId}.methods.set(${JSON.stringify(mName.toLowerCase())}, { name: ${JSON.stringify(mName)}, visibility: ${JSON.stringify(visibility)}, isStatic: ${Boolean(item.isStatic)}, isAbstract: ${Boolean(item.isAbstract)}, isFinal: ${Boolean(item.isFinal)}, numberOfParameters: ${params.length}, numberOfRequiredParameters: ${requiredCount}, parameters: ${JSON.stringify(params)}, fn: __method_${safeMId} });`);
          }
        }

        lines.push(`${pad}ctx.classes[${JSON.stringify(qualifiedClassName)}] = __cls_${safeClassId};`);
        lines.push(`${pad}ctx.engine.classes[${JSON.stringify(qualifiedClassName)}] = __cls_${safeClassId};`);
        this.currentClassName = previousClassName;
        break;
      }

      default: {
        const expr = this.transpileExpr(node, filepath);
        lines.push(`${pad}${expr};`);
        break;
      }
    }
  }

  private containsYield(nodes: any): boolean {
    if (!nodes) return false;
    const list = Array.isArray(nodes) ? nodes : [nodes];
    for (const node of list) {
      if (!node || typeof node !== "object") continue;
      if (node.kind === "yield" || node.kind === "yieldfrom") return true;
      if (node.kind === "function" || node.kind === "closure") continue;
      for (const key of Object.keys(node)) {
        if (key !== "loc" && typeof node[key] === "object") {
          if (this.containsYield(node[key])) return true;
        }
      }
    }
    return false;
  }

  private orderClassConstants(body: any[], className: string, filepath: string): any[] {
    const constants = new Map<string, any>();
    for (const item of body) {
      if (item?.kind !== "classconstant") continue;
      for (const constant of item.constants || []) constants.set(this.getConstName(constant.name), constant);
    }
    const visited = new Set<string>();
    const pending = new Set<string>();
    const ordered: any[] = [];
    const visit = (name: string) => {
      if (visited.has(name) || !constants.has(name)) return;
      if (pending.has(name)) throw new PHPFatalError(`Cannot declare constant ${className}::${name} with self-referencing constant`);
      pending.add(name);
      const constant = constants.get(name);
      const visitValue = (value: any) => {
        if (!value || typeof value !== "object") return;
        if (value.kind === "staticlookup" && value.offset && this.transpileClassReference(value.what, filepath) === JSON.stringify(className)) {
          visit(this.getConstName(value.offset));
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
    for (const name of constants.keys()) visit(name);
    return ordered;
  }

  private getConstName(node: any): string {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (typeof node.name === "string") return node.name;
    if (typeof node.value === "string") return node.value;
    if (node.name && typeof node.name === "object") return this.getConstName(node.name);
    return String(node);
  }

  private transpileClassReferenceLower(node: any, filepath: string): string {
    if (node?.kind === "variable") return `String(${this.transpileExpr(node, filepath)}).toLowerCase()`;
    const name = this.getConstName(node);
    if (node?.kind === "selfreference" || name.toLowerCase() === "self") return JSON.stringify(this.currentClassName.toLowerCase());
    if (node?.kind === "staticreference" || name.toLowerCase() === "static") {
      return `(ctx.currentClass?.name?.toLowerCase() || ${JSON.stringify(this.currentClassName.toLowerCase())})`;
    }
    if (node?.kind === "parentreference" || name.toLowerCase() === "parent") {
      return `(await ctx.resolveClass(${JSON.stringify(this.currentClassName.toLowerCase())})).parentClass.name.toLowerCase()`;
    }
    if (name.startsWith("\\") || node?.resolution === "fqn") return JSON.stringify(name.replace(/^\\/, "").toLowerCase());
    const parts = name.split("\\");
    const importedName = this.classImports.get(parts[0].toLowerCase());
    if (importedName) return JSON.stringify([importedName, ...parts.slice(1)].join("\\").toLowerCase());
    return JSON.stringify((this.currentNamespaceName ? `${this.currentNamespaceName}\\${name}` : name).toLowerCase());
  }

  private transpileClassReferenceOriginal(node: any, filepath: string): string {
    if (node?.kind === "variable") return `String(${this.transpileExpr(node, filepath)})`;
    const name = this.getConstName(node);
    if (node?.kind === "selfreference" || name.toLowerCase() === "self") return JSON.stringify(this.currentClassNameOriginal || this.currentClassName);
    if (node?.kind === "staticreference" || name.toLowerCase() === "static") {
      return `(ctx.currentClass?.name || ${JSON.stringify(this.currentClassNameOriginal || this.currentClassName)})`;
    }
    if (node?.kind === "parentreference" || name.toLowerCase() === "parent") {
      return `(await ctx.resolveClass(${JSON.stringify(this.currentClassName.toLowerCase())})).parentClass.name`;
    }
    if (name.startsWith("\\") || node?.resolution === "fqn") return JSON.stringify(name.replace(/^\\/, ""));
    const parts = name.split("\\");
    const importedName = this.classImportsOriginal.get(parts[0].toLowerCase()) || this.classImports.get(parts[0].toLowerCase());
    if (importedName) return JSON.stringify([importedName, ...parts.slice(1)].join("\\"));
    return JSON.stringify(this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${name}` : (this.currentNamespaceName ? `${this.currentNamespaceName}\\${name}` : name));
  }

  private transpileClassReference(node: any, filepath: string): string {
    return this.transpileClassReferenceLower(node, filepath);
  }

  private transpileExpr(node: any, filepath: string = "eval"): string {
    if (!node || typeof node !== "object") return "undefined";

    switch (node.kind) {
      case "string":
        return JSON.stringify(node.value);

      case "number":
        return String(node.value);

      case "boolean":
        return String(node.value);

      case "null":
      case "nil":
        return "null";

      case "magic": {
        const m = (node.value || node.name || "").toString();
        if (m === "__DIR__") return JSON.stringify(path.dirname(filepath));
        if (m === "__FILE__") return JSON.stringify(filepath);
        if (m === "__LINE__") return String(node.loc?.start?.line || 1);
        return JSON.stringify(m);
      }
      case "name":
      case "constref": {
        const rawName = this.getConstName(node.name || node);
        if (rawName.toLowerCase() === "true") return "true";
        if (rawName.toLowerCase() === "false") return "false";
        if (rawName.toLowerCase() === "null") return "null";
        const constName = rawName.toLowerCase();
        return `(ctx.getConstant(${JSON.stringify(constName)}) ?? ${JSON.stringify(constName)})`;
      }
      case "closure":
      case "arrowfunc": {
        const params = (node.arguments || []).map((a: any, idx: number) => {
          const pName = (a.name?.name || a.name || "p").toString();
          const hasDefault = Boolean(a.value);
          const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
          return { name: pName, position: idx, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
        });

        const dummyLines: string[] = [];
        const dummyLineMap = new Map<number, PHPLineLocation>();
        const savedSwitchStack = this.switchLabelStack;
        this.switchLabelStack = [];
        try {
          this.transpileNodeList(node.body?.children || node.body, dummyLines, dummyLineMap, null as any, filepath, 12, "closure");
        } finally {
          this.switchLabelStack = savedSwitchStack;
        }

        const isGen = this.containsYield(node.body?.children || node.body);
        return `(async function${isGen ? "*" : ""} (ctx, ...args) {
          ctx.pushScope();
          try {
            ${params.map((p: any, idx: number) => `ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`).join("\n            ")}
${dummyLines.join("\n")}
          } finally {
            ctx.popScope();
          }
        })`;
      }

      case "variable": {
        const varName = (node.name?.name || node.name || "var").toString();
        return `ctx.getVar(${JSON.stringify(varName)})`;
      }

      case "assign": {
        let leftNode = node.left;
        while (leftNode?.kind === "parenthesis" || leftNode?.kind === "parentheses") {
          leftNode = leftNode.inner || leftNode.expr || leftNode.value || leftNode.what;
        }

        if (leftNode?.kind === "list") {
          const items = (leftNode.items || leftNode.arguments || leftNode.value || []);
          const rightVal = this.transpileExpr(node.right, filepath);
          const assigns = items.map((item: any, idx: number) => {
            if (!item) return "";
            if (item.kind === "variable") {
              const varName = this.getConstName(item);
              return `ctx.setVar(${JSON.stringify(varName)}, __list[${idx}])`;
            }
            return "";
          }).filter(Boolean);
          return `(await (async () => { const __list = Array.isArray(${rightVal}) ? ${rightVal} : Object.values(${rightVal} || {}); ${assigns.join("; ")}; return __list; })())`;
        }

        const val = this.transpileExpr(node.right, filepath);
        const op = node.operator || "=";

        if (leftNode?.kind === "variable") {
          const target = JSON.stringify(this.getConstName(leftNode));
          if (op === "+=") return `ctx.setVar(${target}, (Number(ctx.getVar(${target})) || 0) + Number(${val}))`;
          if (op === "-=") return `ctx.setVar(${target}, (Number(ctx.getVar(${target})) || 0) - Number(${val}))`;
          if (op === ".=") return `ctx.setVar(${target}, String(ctx.getVar(${target}) ?? "") + String(${val}))`;
          return `ctx.setVar(${target}, ${val})`;
        }

        if (leftNode?.kind === "propertylookup") {
          const obj = this.transpileExpr(leftNode.what, filepath);
          const prop = JSON.stringify(this.getConstName(leftNode.offset));
          if (op === "+=") return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; return await ctx.setProperty(${obj}, ${prop}, __old + Number(${val})); })())`;
          if (op === "-=") return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; return await ctx.setProperty(${obj}, ${prop}, __old - Number(${val})); })())`;
          if (op === ".=") return `(await (async () => { const __old = String(await ctx.getProperty(${obj}, ${prop}) ?? ""); return await ctx.setProperty(${obj}, ${prop}, __old + String(${val})); })())`;
          return `(await ctx.setProperty(${obj}, ${prop}, ${val}))`;
        }

        if (leftNode?.kind === "staticlookup") {
          const className = this.transpileClassReference(leftNode.what, filepath);
          const propName = this.getConstName(leftNode.offset);
          if (op === "+=") return `(await (async () => { const __old = Number(await ctx.getStaticProperty(${className}, ${JSON.stringify(propName)})) || 0; return await ctx.setStaticProperty(${className}, ${JSON.stringify(propName)}, __old + Number(${val})); })())`;
          if (op === "-=") return `(await (async () => { const __old = Number(await ctx.getStaticProperty(${className}, ${JSON.stringify(propName)})) || 0; return await ctx.setStaticProperty(${className}, ${JSON.stringify(propName)}, __old - Number(${val})); })())`;
          if (op === ".=") return `(await (async () => { const __old = String(await ctx.getStaticProperty(${className}, ${JSON.stringify(propName)}) ?? ""); return await ctx.setStaticProperty(${className}, ${JSON.stringify(propName)}, __old + String(${val})); })())`;
          return `(await ctx.setStaticProperty(${className}, ${JSON.stringify(propName)}, ${val}))`;
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
          if (current?.kind === "propertylookup") {
            const obj = this.transpileExpr(current.what, filepath);
            const prop = JSON.stringify(this.getConstName(current.offset));
            return `(await ctx.setPropertyOffsets(${obj}, ${prop}, [${offsets.join(", ")}], ${val}))`;
          }
          if (current?.kind === "staticlookup") {
            const className = this.transpileClassReference(current.what, filepath);
            const propName = this.getConstName(current.offset);
            return `(await ctx.setStaticPropertyOffsets(${className}, ${JSON.stringify(propName)}, [${offsets.join(", ")}], ${val}))`;
          }
          const varName = this.getConstName(current);
          if (varName) {
            if (op === "+=") return `(await (async () => { const __old = Number(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; return ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + Number(${val})); })())`;
            if (op === "-=") return `(await (async () => { const __old = Number(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; return ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old - Number(${val})); })())`;
            if (op === ".=") return `(await (async () => { const __old = String(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}]) ?? ""); return ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + String(${val})); })())`;
            return `ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], ${val})`;
          }
        }

        console.error("ASSIGN_UNMATCHED_LEFT_NODE:", JSON.stringify(leftNode));
        return `ctx.setVar("tmp", ${val})`;
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
        return `(${obj})?.[${offset}]`;
      }

      case "propertylookup": {
        const obj = this.transpileExpr(node.what, filepath);
        const prop = JSON.stringify(node.offset?.name || node.offset?.value || node.offset || "prop");
        return `(await ctx.getProperty(${obj}, ${prop}))`;
      }

      case "nullsafepropertylookup": {
        const obj = this.transpileExpr(node.what, filepath);
        const prop = JSON.stringify(node.offset?.name || node.offset?.value || node.offset || "prop");
        return `(await (async () => { const __o = ${obj}; return (__o !== null && __o !== undefined) ? await ctx.getProperty(__o, ${prop}) : null; })())`;
      }

      case "encapsed": {
        const parts = (node.value || []).map((part: any) => {
          if (typeof part === "string") return JSON.stringify(part);
          if (part.kind === "string" || part.kind === "number") return JSON.stringify(String(part.value));
          if (part.kind === "variable") return `String(ctx.getVar(${JSON.stringify(part.name?.name || part.name)}) ?? "")`;
          return `String(${this.transpileExpr(part, filepath)} ?? "")`;
        });
        return `(${parts.join(" + ")})`;
      }

      case "encapsedpart": {
        if (node.expression) {
          return `String(${this.transpileExpr(node.expression, filepath)} ?? "")`;
        }
        if (node.value) {
          if (typeof node.value === "string") return JSON.stringify(node.value);
          return `String(${this.transpileExpr(node.value, filepath)} ?? "")`;
        }
        if (node.curly || node.what) {
          return `String(${this.transpileExpr(node.curly || node.what, filepath)} ?? "")`;
        }
        return '""';
      }

      case "pre":
      case "post": {
        const isInc = node.type === "+" || node.type === "++";
        const delta = isInc ? 1 : -1;
        if (node.what?.kind === "variable") {
          const varName = JSON.stringify(node.what.name?.name || node.what.name);
          if (node.kind === "pre") {
            return `ctx.setVar(${varName}, (Number(ctx.getVar(${varName})) || 0) + ${delta})`;
          }
          return `((() => { const __old = Number(ctx.getVar(${varName})) || 0; ctx.setVar(${varName}, __old + ${delta}); return __old; })())`;
        }
        if (node.what?.kind === "offsetlookup") {
          const offsets: string[] = [];
          let current = node.what;
          while (current?.kind === "offsetlookup") {
            offsets.unshift(current.offset ? this.transpileExpr(current.offset, filepath) : "null");
            current = current.what;
          }
          if (current?.kind === "variable") {
            const varName = (current.name?.name || current.name).toString();
            if (node.kind === "pre") {
              return `(await (async () => { const __old = Number(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; return ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + ${delta}); })())`;
            }
            return `(await (async () => { const __old = Number(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + ${delta}); return __old; })())`;
          }
        }
        if (node.what?.kind === "propertylookup") {
          const obj = this.transpileExpr(node.what.what, filepath);
          const prop = JSON.stringify(this.getConstName(node.what.offset));
          if (node.kind === "pre") {
            return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; await ctx.setProperty(${obj}, ${prop}, __old + ${delta}); return __old + ${delta}; })())`;
          }
          return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; await ctx.setProperty(${obj}, ${prop}, __old + ${delta}); return __old; })())`;
        }
        return "0";
      }

      case "unary": {
        const val = this.transpileExpr(node.what, filepath);
        if (node.type === "!") return `(!ctx.isTruthy(${val}))`;
        if (node.type === "+") return `(+${val})`;
        if (node.type === "-") return `(-${val})`;
        return `${node.type}${val}`;
      }

      case "isset": {
        const argsList = node.variables || node.arguments || [node.variable || node.expr || node.expression || node.value].filter(Boolean);
        const args = (Array.isArray(argsList) ? argsList : [argsList]).map((v: any) =>
          this.transpileExpr(v, filepath)
        );
        return `(${args.map((a: string) => `(${a} !== undefined && ${a} !== null)`).join(" && ") || "true"})`;
      }

      case "empty": {
        const exprNode = node.expr || node.expression || node.variable || node.value || (node.arguments && node.arguments[0]);
        const val = exprNode ? this.transpileExpr(exprNode, filepath) : "null";
        return `(!ctx.isTruthy(${val}))`;
      }

      case "new": {
        const className = this.transpileClassReferenceLower(node.what, filepath);
        const origClassName = this.transpileClassReferenceOriginal(node.what, filepath);
        const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
        return `(await ctx.createObject(${className}, [${args.join(", ")}], ${origClassName}))`;
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
          return `((${left} < ${right}) ? -1 : ((${left} > ${right}) ? 1 : 0))`;
        }
        if (op === "instanceof") {
          const rightName = this.getConstName(node.right?.name || node.right).toLowerCase();
          return `ctx.isInstanceOf(${left}, ${JSON.stringify(rightName)})`;
        }
        const right = this.transpileExpr(node.right, filepath);
        if (op === "xor") return `((ctx.isTruthy(${left}) ? 1 : 0) !== (ctx.isTruthy(${right}) ? 1 : 0))`;
        if (op === "and") return `(ctx.isTruthy(${left}) && ctx.isTruthy(${right}))`;
        if (op === "or") return `(ctx.isTruthy(${left}) || ctx.isTruthy(${right}))`;
        const jsOp = op === "." ? "+" : op;
        return `(${left} ${jsOp} ${right})`;
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
        return `(ctx.isTruthy(${test}) ? ${iftrue} : ${iffalse})`;
      }

      case "call": {
        if (node.what?.kind === "staticlookup") {
          const className = this.transpileClassReferenceLower(node.what.what, filepath);
          const origClassName = this.transpileClassReferenceOriginal(node.what.what, filepath);
          const method = JSON.stringify(this.getConstName(node.what.offset).toLowerCase());
          const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
          return `(await ctx.callStaticMethod(${className}, ${method}, [${args.join(", ")}], this, ${origClassName}))`;
        }

        if (node.what?.kind === "propertylookup") {
          const obj = this.transpileExpr(node.what.what, filepath);
          const method = JSON.stringify(this.getConstName(node.what.offset).toLowerCase() || "method");
          const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
          return `(await ctx.callMethod(${obj}, ${method}, [${args.join(", ")}]))`;
        }

        if (node.what?.kind === "nullsafepropertylookup") {
          const obj = this.transpileExpr(node.what.what, filepath);
          const method = JSON.stringify(this.getConstName(node.what.offset).toLowerCase() || "method");
          const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
          return `(await (async () => { const __o = ${obj}; return (__o !== null && __o !== undefined) ? await ctx.callMethod(__o, ${method}, [${args.join(", ")}]) : null; })())`;
        }

        const name = this.getConstName(node.what).toLowerCase() || "func";
        const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));

        if (name === "include") {
          return `(await ctx.include(${args.join(", ")}))`;
        }
        if (name === "include_once") {
          return `(await ctx.includeOnce(${args.join(", ")}))`;
        }
        if (name === "require") {
          return `(await ctx.require(${args.join(", ")}))`;
        }
        if (name === "require_once") {
          return `(await ctx.requireOnce(${args.join(", ")}))`;
        }

        const references = (node.arguments || []).map((a: any) => a?.kind === "variable" ? (a.name?.name || a.name || "").toString() : null);
        return `(await ctx.callFunction(${JSON.stringify(name)}, [${args.join(", ")}], ${JSON.stringify(references)}))`;
      }
      case "staticlookup": {
        const className = this.transpileClassReferenceLower(node.what, filepath);
        const origClassName = this.transpileClassReferenceOriginal(node.what, filepath);
        const member = this.getConstName(node.offset);
        if (member.toLowerCase() === "class" && node.offset?.kind !== "variable") return `((await ctx.resolveClass(${className}, ${origClassName}))?.name || ${origClassName})`;
        const accessor = node.offset?.kind === "variable" ? "getStaticProperty" : "getClassConstant";
        return `(await ctx.${accessor}(${className}, ${JSON.stringify(member.toLowerCase())}, ${origClassName}))`;
      }

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
        return `(await ctx.callFunction("exit", [${status}]))`;
      }

      case "retif":
      case "ternary": {
        const test = this.transpileExpr(node.test || node.cond, filepath);
        const iftrue = (node.trueExpr || node.true || node.value) ? this.transpileExpr(node.trueExpr || node.true || node.value, filepath) : test;
        const iffalse = this.transpileExpr(node.falseExpr || node.false || node.alternate, filepath);
        return `(ctx.isTruthy(${test}) ? ${iftrue} : ${iffalse})`;
      }

      case "cast": {
        const val = this.transpileExpr(node.expr || node.what || node.value, filepath);
        const type = (node.type || node.raw || "").toLowerCase();
        if (type === "bool" || type === "boolean") return `ctx.isTruthy(${val})`;
        if (type === "int" || type === "integer") return `(Number(parseInt(String(${val}), 10)) || 0)`;
        if (type === "float" || type === "double" || type === "real") return `(Number(parseFloat(String(${val}))) || 0)`;
        if (type === "string") return `String(${val} ?? "")`;
        if (type === "array") return `(Array.isArray(${val}) ? ${val} : (${val} === null || ${val} === undefined) ? [] : (${val} instanceof PHPObject) ? Object.fromEntries(${val}.properties) : (typeof ${val} === "object") ? ${val} : [${val}])`;
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
        const items = (node.items || node.arguments || node.value || []).map((item: any) =>
          item ? this.transpileExpr(item, filepath) : "null"
        );
        return `[${items.join(", ")}]`;
      }

      case "empty": {
        const expr = node.expr || node.value || node.what;
        const val = expr ? this.transpileExpr(expr, filepath) : "undefined";
        return `(!ctx.isTruthy(${val}))`;
      }

      case "isset": {
        const args = (node.variables || node.arguments || node.value || []).map((v: any) => {
          const val = this.transpileExpr(v, filepath);
          return `(${val} !== undefined && ${val} !== null)`;
        });
        return `(${args.join(" && ") || "true"})`;
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
        return `(await (async () => { const __obj = ${expr}; return __obj instanceof PHPObject ? __obj.clone(ctx) : (Array.isArray(__obj) ? [...__obj] : (typeof __obj === "object" && __obj !== null ? { ...__obj } : __obj)); })())`;
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
        const labelName = (node.label?.name || node.label || "lbl").toString();
        return `/* goto ${labelName} */ undefined`;
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
        return "undefined";

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

      default:
        throw new Error(`Not Implemented expression kind: ${node?.kind}`);
    }
  }
}
