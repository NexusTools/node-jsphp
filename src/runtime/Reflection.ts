import type { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";
import { PHPLiteral, PHPReference } from "./PHPVariable.js";

export const SYMBOL_PHP_META = Symbol.for("php.meta");
export const SYMBOL_PHP_NAME = Symbol.for("php.name");
export const SYMBOL_PHP_CONSTANTS = Symbol.for("php.constants");
export const SYMBOL_PHP_PROPERTIES = Symbol.for("php.properties");
export const SYMBOL_PHP_METHODS = Symbol.for("php.methods");
export const SYMBOL_PHP_CLASS = Symbol.for("php.class");
export const SYMBOL_PHP_PARENT = Symbol.for("php.parent");
export const SYMBOL_PHP_NEW = Symbol.for("php.new");
export const SYMBOL_PHP_INIT = Symbol.for("php.init");
export const SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS = Symbol.for("php.hasMagicMethods");
export const SYMBOL_PHP_CLASS_INTERFACES = Symbol.for("php.interfaces");
export const SYMBOL_PHP_METHOD_THEN = Symbol.for("php.method.then");
export const SYMBOL_PHP_STATIC_METHOD_PROTOTYPE = Symbol.for("php.staticMethod.prototype");

const HEX = "0123456789ABCDEF";
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

export function normalizePhpRegistryName(name: string): string {
  return String(name ?? "").replace(/^\\+/, "").split("\\").join("$$").toLowerCase();
}

export function encodePhpIdentifier(name: string): string {
  let encoded = "";
  for (const char of name) {
    const code = char.charCodeAt(0);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95) {
      encoded += char;
      continue;
    }
    for (const byte of UTF8_ENCODER.encode(char)) {
      encoded += `$${HEX[byte >>> 4]}${HEX[byte & 0x0f]}`;
    }
  }
  return encoded;
}

export function encodePhpMethodName(name: string, isStatic = false): string | symbol {
  const lower = name.toLowerCase();
  if (lower === "then") return SYMBOL_PHP_METHOD_THEN;
  if (isStatic && lower === "prototype") return SYMBOL_PHP_STATIC_METHOD_PROTOTYPE;
  return encodePhpIdentifier(lower);
}

export function encodePhpPropertyName(name: string): string {
  return `$${encodePhpIdentifier(name.startsWith("$") ? name.slice(1) : name)}`;
}

export function decodePhpIdentifier(name: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < name.length;) {
    if (name[i] === "$" && /^[0-9A-Fa-f]{2}$/.test(name.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(name.slice(i + 1, i + 3), 16));
      i += 3;
      continue;
    }
    for (const byte of UTF8_ENCODER.encode(name[i])) bytes.push(byte);
    i++;
  }
  return UTF8_DECODER.decode(new Uint8Array(bytes));
}

export function decodePhpPropertyName(name: string): string {
  return decodePhpIdentifier(name.startsWith("$") ? name.slice(1) : name);
}

export function decodePhpMethodName(name: string | symbol): string {
  if (name === SYMBOL_PHP_METHOD_THEN) return "then";
  if (name === SYMBOL_PHP_STATIC_METHOD_PROTOTYPE) return "prototype";
  return decodePhpIdentifier(String(name));
}

export function isEncodedPhpMethodKey(name: string): boolean {
  return name.startsWith("$") && encodePhpIdentifier(decodePhpIdentifier(name).toLowerCase()) === name;
}

export interface PHPParameterMetadata {
  name: string;
  position: number;
  isOptional: boolean;
  hasDefault: boolean;
  defaultValue?: any;
  type?: string;
  byref?: boolean;
}

export interface PHPPropertyMetadata {
  name: string;
  visibility: "public" | "protected" | "private";
  isStatic: boolean;
  isReadOnly: boolean;
  defaultValue?: any;
  encodedName?: string;
}

export type PHPPropertyMetadataRecord = Record<string, PHPPropertyMetadata>;

export interface PHPMethodMetadata {
  name: string;
  visibility: "public" | "protected" | "private";
  isStatic: boolean;
  isAbstract: boolean;
  isFinal: boolean;
  numberOfParameters: number;
  numberOfRequiredParameters: number;
  parameters: PHPParameterMetadata[];
  fn?: Function;
}

export interface FunctionMetaOptions {
  name: string;
  visibility?: "public" | "protected" | "private";
  parameters?: {
    name: string;
    byref?: boolean;
    isOptional?: boolean;
    hasDefault?: boolean;
    defaultValue?: any;
    type?: string;
  }[];
}

export function defineFunction<T extends Function>(fn: T, meta: FunctionMetaOptions): T {
  const params: PHPParameterMetadata[] = (meta.parameters || []).map((p, idx) => {
    const hasDefault = p.hasDefault ?? p.isOptional ?? false;
    return {
      name: p.name,
      position: idx,
      isOptional: hasDefault,
      hasDefault: hasDefault,
      defaultValue: p.defaultValue,
      type: p.type || "mixed",
      byref: Boolean(p.byref),
    };
  });

  const requiredCount = params.filter((p) => !p.hasDefault).length;

  Object.defineProperty(fn, SYMBOL_PHP_META, {
    value: {
      name: meta.name.toLowerCase(),
      visibility: meta.visibility || "public",
      numberOfParameters: params.length,
      numberOfRequiredParameters: requiredCount,
      parameters: params,
    },
    enumerable: false,
    configurable: false,
    writable: false
  });

  return fn;
}

export function parseJSFunctionMetadata(fn?: Function, name = ""): any {
  if (!fn || typeof fn !== "function") {
    return {
      name: name.toLowerCase(),
      visibility: "public",
      numberOfParameters: 0,
      numberOfRequiredParameters: 0,
      parameters: [],
    };
  }

  if ((fn as any)[SYMBOL_PHP_META]) {
    return (fn as any)[SYMBOL_PHP_META];
  }

  const str = fn.toString().trim();
  const openParen = str.indexOf("(");
  const closeParen = str.indexOf(")", openParen);

  let paramTokens: string[] = [];
  if (openParen !== -1 && closeParen > openParen) {
    const paramsStr = str.slice(openParen + 1, closeParen).trim();
    if (paramsStr.length > 0) {
      paramTokens = splitParamString(paramsStr);
    }
  }

  // Skip internal 'ctx' or 'context' argument if present
  if (paramTokens.length > 0) {
    const firstToken = paramTokens[0].trim();
    const firstName = firstToken.split("=")[0].trim().replace(/^\.\.\./, "");
    if (firstName === "ctx" || firstName === "_ctx" || firstName === "context") {
      paramTokens.shift();
    }
  }

  const parameters: PHPParameterMetadata[] = [];
  let requiredCount = 0;

  paramTokens.forEach((token, idx) => {
    const trimmed = token.trim();
    if (!trimmed) return;

    const eqIdx = trimmed.indexOf("=");
    let pName = "";
    let defaultValue: any = undefined;
    let hasDefault = false;

    if (eqIdx !== -1) {
      pName = trimmed.slice(0, eqIdx).trim().replace(/^\.\.\./, "");
      const defaultStr = trimmed.slice(eqIdx + 1).trim();
      hasDefault = true;
      defaultValue = parseSimpleLiteral(defaultStr);
    } else {
      pName = trimmed.replace(/^\.\.\./, "").trim();
      hasDefault = false;
      requiredCount++;
    }

    parameters.push({
      name: pName,
      position: idx,
      isOptional: hasDefault,
      hasDefault: hasDefault,
      defaultValue: defaultValue,
      type: "mixed",
    });
  });

  return {
    name: name.toLowerCase(),
    visibility: "public",
    numberOfParameters: parameters.length,
    numberOfRequiredParameters: requiredCount,
    parameters,
  };
}

function splitParamString(paramsStr: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];
    if (char === "(" || char === "{" || char === "[") depth++;
    else if (char === ")" || char === "}" || char === "]") depth--;

    if (char === "," && depth === 0) {
      tokens.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current);
  return tokens;
}

function parseSimpleLiteral(valStr: string): any {
  if (valStr === "null") return null;
  if (valStr === "true") return true;
  if (valStr === "false") return false;
  if (valStr === "undefined") return undefined;
  if (!isNaN(Number(valStr))) return Number(valStr);
  if ((valStr.startsWith('"') && valStr.endsWith('"')) || (valStr.startsWith("'") && valStr.endsWith("'"))) {
    return valStr.slice(1, -1);
  }
  return valStr;
}

export class Reflection {
  public static async getModifierNames(ctx: PHPContext, modifiersArg?: PHPReference): Promise<string[]> {
    const modifiers = Number(await modifiersArg?.get()) || 0;
    const res: string[] = [];
    if (modifiers & 1) res.push("public");
    if (modifiers & 2) res.push("protected");
    if (modifiers & 4) res.push("private");
    if (modifiers & 8) res.push("static");
    if (modifiers & 16) res.push("abstract");
    if (modifiers & 32) res.push("final");
    if (modifiers & 64) res.push("readonly");
    return res;
  }
}

export class ReflectionType {
  public typeName!: string;
  public allowsNullFlag!: boolean;

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, typeNameArg?: PHPReference, allowsNullFlagArg?: PHPReference): Promise<ReflectionType> {
    const obj = Object.create(ReflectionType.prototype);
    await ReflectionType.__construct.call(obj, ctx, typeNameArg, allowsNullFlagArg);
    return obj;
  }

  public static async __construct(this: ReflectionType, ctx: PHPContext, typeNameArg?: PHPReference, allowsNullFlagArg?: PHPReference): Promise<void> {
    this.typeName = typeNameArg ? String(await typeNameArg.get() ?? "") : "mixed";
    this.allowsNullFlag = allowsNullFlagArg ? Boolean(await allowsNullFlagArg.get()) : true;
  }

  public allowsNull(ctx: PHPContext): boolean { return this.allowsNullFlag; }
  public getName(ctx: PHPContext): string { return this.typeName; }
  public __toString(ctx: PHPContext): string { return this.typeName; }
}

export class ReflectionParameter {
  public paramName!: string;
  public paramPosition!: number;
  public defaultValue: any;
  public hasDefault!: boolean;

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, nameArg?: PHPReference, positionArg?: PHPReference, defaultValueArg?: PHPReference, hasDefaultArg?: PHPReference): Promise<ReflectionParameter> {
    const obj = Object.create(ReflectionParameter.prototype);
    await ReflectionParameter.__construct.call(obj, ctx, nameArg, positionArg, defaultValueArg, hasDefaultArg);
    return obj;
  }

  public static async __construct(this: ReflectionParameter, ctx: PHPContext, nameArg?: PHPReference, positionArg?: PHPReference, defaultValueArg?: PHPReference, hasDefaultArg?: PHPReference): Promise<void> {
    this.paramName = nameArg ? String(await nameArg.get() ?? "") : "";
    this.paramPosition = positionArg ? Number(await positionArg.get()) || 0 : 0;
    this.defaultValue = defaultValueArg ? await defaultValueArg.get() : undefined;
    this.hasDefault = hasDefaultArg ? Boolean(await hasDefaultArg.get()) : false;
  }

  public getName(ctx: PHPContext): string { return this.paramName; }
  public getPosition(ctx: PHPContext): number { return this.paramPosition; }
  public isOptional(ctx: PHPContext): boolean { return this.hasDefault; }
  public isDefaultValueAvailable(ctx: PHPContext): boolean { return this.hasDefault; }
  public getDefaultValue(ctx: PHPContext): any { return this.defaultValue; }
  public isPassedByReference(ctx: PHPContext): boolean { return false; }
  public async getType(ctx: PHPContext): Promise<ReflectionType> {
    return await ReflectionType[SYMBOL_PHP_NEW](ctx);
  }
}

export class ReflectionProperty {
  public name!: string;
  public declaringClassName!: string;
  public meta?: PHPPropertyMetadata;
  public isAccessible = true;

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, classArg?: PHPReference, nameArg?: PHPReference, metaArg?: PHPReference): Promise<ReflectionProperty> {
    const obj = Object.create(ReflectionProperty.prototype);
    await ReflectionProperty.__construct.call(obj, ctx, classArg, nameArg, metaArg);
    return obj;
  }

  public static async __construct(this: ReflectionProperty, ctx: PHPContext, classArg?: PHPReference, nameArg?: PHPReference, metaArg?: PHPReference): Promise<void> {
    this.declaringClassName = classArg ? String(await classArg.get() ?? "") : "";
    this.name = nameArg ? String(await nameArg.get() ?? "") : "";
    this.meta = metaArg ? await metaArg.get() : undefined;
  }

  public getName(ctx: PHPContext): string { return this.name; }
  public async getDeclaringClass(ctx: PHPContext): Promise<ReflectionClass> {
    return await ReflectionClass[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.declaringClassName));
  }
  public isPublic(ctx: PHPContext): boolean { return !this.meta || this.meta.visibility === "public"; }
  public isProtected(ctx: PHPContext): boolean { return this.meta?.visibility === "protected"; }
  public isPrivate(ctx: PHPContext): boolean { return this.meta?.visibility === "private"; }
  public isStatic(ctx: PHPContext): boolean { return this.meta?.isStatic || false; }
  public isReadOnly(ctx: PHPContext): boolean { return this.meta?.isReadOnly || false; }
  public async setAccessible(ctx: PHPContext, accessibleArg?: PHPReference): Promise<void> {
    this.isAccessible = accessibleArg ? Boolean(await accessibleArg.get()) : true;
  }
  public async getValue(ctx: PHPContext, objArg?: PHPReference): Promise<any> {
    const obj = await objArg?.get();
    if (obj && typeof obj === "object") {
      return await ctx.getProperty(obj, this.name);
    }
    return undefined;
  }
  public async setValue(ctx: PHPContext, objArg?: PHPReference, valArg?: PHPReference): Promise<void> {
    const obj = await objArg?.get();
    if (obj && typeof obj === "object") {
      await ctx.setProperty(obj, this.name, await valArg?.get());
    }
  }
}

export class ReflectionMethod {
  public className!: string;
  public methodName!: string;
  public meta!: PHPMethodMetadata;

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, classArg?: PHPReference, methodArg?: PHPReference, metaArg?: PHPReference, fnArg?: PHPReference): Promise<ReflectionMethod> {
    const obj = Object.create(ReflectionMethod.prototype);
    await ReflectionMethod.__construct.call(obj, ctx, classArg, methodArg, metaArg, fnArg);
    return obj;
  }

  public static async __construct(this: ReflectionMethod, ctx: PHPContext, classArg?: PHPReference, methodArg?: PHPReference, metaArg?: PHPReference, fnArg?: PHPReference): Promise<void> {
    const cls = classArg ? String(await classArg.get() ?? "") : "";
    const methodName = methodArg ? String(await methodArg.get() ?? "") : "";
    if (!methodName && cls.includes("::")) {
      const parts = cls.split("::");
      this.className = parts[0];
      this.methodName = parts[1];
    } else {
      this.className = cls;
      this.methodName = methodName;
    }
    const meta = metaArg ? await metaArg.get() : undefined;
    const fn = fnArg ? await fnArg.get() : undefined;
    this.meta = meta || parseJSFunctionMetadata(fn || meta?.fn, this.methodName);
  }

  public getName(ctx: PHPContext): string { return this.methodName; }
  public async getDeclaringClass(ctx: PHPContext): Promise<ReflectionClass> {
    return await ReflectionClass[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.className));
  }
  public isPublic(ctx: PHPContext): boolean { return !this.meta || this.meta.visibility === "public"; }
  public isProtected(ctx: PHPContext): boolean { return this.meta?.visibility === "protected"; }
  public isPrivate(ctx: PHPContext): boolean { return this.meta?.visibility === "private"; }
  public isStatic(ctx: PHPContext): boolean { return this.meta?.isStatic || false; }
  public isAbstract(ctx: PHPContext): boolean { return this.meta?.isAbstract || false; }
  public isFinal(ctx: PHPContext): boolean { return this.meta?.isFinal || false; }
  public isConstructor(ctx: PHPContext): boolean { return this.methodName.toLowerCase() === "__construct"; }
  public isDestructor(ctx: PHPContext): boolean { return this.methodName.toLowerCase() === "__destruct"; }
  public getNumberOfParameters(ctx: PHPContext): number { return this.meta?.numberOfParameters ?? 0; }
  public getNumberOfRequiredParameters(ctx: PHPContext): number { return this.meta?.numberOfRequiredParameters ?? 0; }
  public async getParameters(ctx: PHPContext): Promise<ReflectionParameter[]> {
    if (!this.meta?.parameters) return [];
    const params: ReflectionParameter[] = [];
    for (let idx = 0; idx < this.meta.parameters.length; idx++) {
      const p = this.meta.parameters[idx];
      params.push(await ReflectionParameter[SYMBOL_PHP_NEW](ctx, new PHPLiteral(p.name), new PHPLiteral(idx), new PHPLiteral(p.defaultValue), new PHPLiteral(p.hasDefault)));
    }
    return params;
  }
  public setAccessible(ctx: PHPContext, accessibleArg?: PHPReference): void {}
  public async invoke(ctx: PHPContext, objectArg?: PHPReference, ...args: PHPReference[]): Promise<any> {
    const object = await objectArg?.get();
    const lower = this.methodName.toLowerCase();
    if (object && typeof object === "object") {
      if (typeof object[lower] === "function") return await object[lower](ctx, ...args);
      if (typeof object.__call === "function") return await object.__call(ctx, new PHPLiteral(lower), new PHPLiteral(args));
      return ctx.methodMissing(object, lower);
    }
    return undefined;
  }
  public async invokeArgs(ctx: PHPContext, objectArg?: PHPReference, argsArg?: PHPReference): Promise<any> {
    const object = await objectArg?.get();
    const args = argsArg ? await argsArg.get() : [];
    const lower = this.methodName.toLowerCase();
    if (object && typeof object === "object") {
      const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
      if (typeof object[lower] === "function") return await object[lower](ctx, ...callArgs);
      if (typeof object.__call === "function") return await object.__call(ctx, new PHPLiteral(lower), new PHPLiteral(callArgs));
      return ctx.methodMissing(object, lower);
    }
    return undefined;
  }
}

export class ReflectionFunction {
  public name!: string;
  public meta!: any;

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, nameArg?: PHPReference, fnOrCtxArg?: PHPReference): Promise<ReflectionFunction> {
    const obj = Object.create(ReflectionFunction.prototype);
    await ReflectionFunction.__construct.call(obj, ctx, nameArg, fnOrCtxArg);
    return obj;
  }

  public static async __construct(this: ReflectionFunction, ctx: PHPContext, nameArg?: PHPReference, fnOrCtxArg?: PHPReference): Promise<void> {
    this.name = nameArg ? String(await nameArg.get() ?? "") : "";
    let targetFn: Function | undefined;
    const fnOrCtx = fnOrCtxArg ? await fnOrCtxArg.get() : undefined;

    if (typeof fnOrCtx === "function") {
      targetFn = fnOrCtx;
    } else if (ctx.engine) {
      targetFn = ctx.engine.functions[normalizePhpRegistryName(this.name)];
    }

    this.meta = parseJSFunctionMetadata(targetFn, this.name);
  }

  public getName(ctx: PHPContext): string { return this.name; }
  public getNamespaceName(ctx: PHPContext): string {
    const parts = this.name.replace(/^\\+/, "").split("\\");
    return parts.length > 1 ? parts.slice(0, -1).join("\\") : "";
  }
  public inNamespace(ctx: PHPContext): boolean { return this.getNamespaceName(ctx).length > 0; }
  public getNumberOfParameters(ctx: PHPContext): number { return this.meta?.numberOfParameters ?? 0; }
  public getNumberOfRequiredParameters(ctx: PHPContext): number { return this.meta?.numberOfRequiredParameters ?? 0; }
  public async getParameters(ctx: PHPContext): Promise<ReflectionParameter[]> {
    if (!this.meta?.parameters) return [];
    const params: ReflectionParameter[] = [];
    for (let idx = 0; idx < this.meta.parameters.length; idx++) {
      const p = this.meta.parameters[idx];
      params.push(await ReflectionParameter[SYMBOL_PHP_NEW](ctx, new PHPLiteral(p.name), new PHPLiteral(idx), new PHPLiteral(p.defaultValue), new PHPLiteral(p.hasDefault)));
    }
    return params;
  }
  public async invoke(ctx: PHPContext, ...args: PHPReference[]): Promise<any> {
    const fn = ctx.functions[normalizePhpRegistryName(this.name)] || ctx.functionMissing(this.name);
    return await fn(ctx, ...args);
  }
  public async invokeArgs(ctx: PHPContext, argsArg?: PHPReference): Promise<any> {
    const args = argsArg ? await argsArg.get() : [];
    const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
    const fn = ctx.functions[normalizePhpRegistryName(this.name)] || ctx.functionMissing(this.name);
    return await fn(ctx, ...callArgs);
  }
}

export class ReflectionClass {
  public name!: string;
  private phpClass?: any;
  private classConstructor?: any;
  private interfaceFlag = false;

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, nameOrInstanceArg?: PHPReference): Promise<ReflectionClass> {
    const obj = Object.create(ReflectionClass.prototype);
    await ReflectionClass.__construct.call(obj, ctx, nameOrInstanceArg);
    return obj;
  }

  public static async __construct(this: ReflectionClass, ctx: PHPContext, nameOrInstanceArg?: PHPReference): Promise<void> {
    const nameOrInstance = await nameOrInstanceArg?.get();
    if (typeof nameOrInstance === "string") {
      const lower = normalizePhpRegistryName(nameOrInstance);
      this.classConstructor = ctx.classes[lower] || ctx.engine.classes[lower];
      this.interfaceFlag = Boolean(ctx.interfaces[lower] || ctx.engine.interfaces[lower]);
      this.phpClass = this.classConstructor?.phpClass;
      this.name = this.classConstructor?.[SYMBOL_PHP_NAME] || nameOrInstance;
    } else if (nameOrInstance?.phpClass) {
      this.phpClass = nameOrInstance.phpClass;
      this.name = this.phpClass?.name || "Object";
      this.classConstructor = nameOrInstance[SYMBOL_PHP_CLASS] || nameOrInstance.constructor;
    } else {
      this.classConstructor = typeof nameOrInstance === "function"
        ? nameOrInstance
        : nameOrInstance?.[SYMBOL_PHP_CLASS] || nameOrInstance?.constructor;
      this.name = this.classConstructor?.[SYMBOL_PHP_NAME] || nameOrInstance?.name || "Object";
      this.phpClass = this.classConstructor?.phpClass;
    }
  }

  public getName(ctx: PHPContext): string { return this.name; }
  public getShortName(ctx: PHPContext): string {
    const parts = this.name.split("\\");
    return parts[parts.length - 1];
  }
  public getNamespaceName(ctx: PHPContext): string {
    const parts = this.name.split("\\");
    return parts.length > 1 ? parts.slice(0, -1).join("\\") : "";
  }
  public inNamespace(ctx: PHPContext): boolean { return this.getNamespaceName(ctx).length > 0; }
  public async getParentClass(ctx: PHPContext): Promise<ReflectionClass | false> {
    const parent = this.classConstructor?.[SYMBOL_PHP_PARENT] || this.phpClass?.parentClass;
    if (!parent) return false;
    const parentName = parent[SYMBOL_PHP_NAME] || parent.name;
    return ReflectionClass[SYMBOL_PHP_NEW](ctx, new PHPLiteral(parentName));
  }
  public isInterface(ctx: PHPContext): boolean { return this.interfaceFlag; }
  public isAbstract(ctx: PHPContext): boolean { return this.phpClass?.isAbstract || false; }
  public isFinal(ctx: PHPContext): boolean { return this.phpClass?.isFinal || false; }
  public isInstantiable(ctx: PHPContext): boolean { return !this.isAbstract(ctx) && !this.isInterface(ctx); }
  public async isSubclassOf(ctx: PHPContext, classNameArg?: PHPReference): Promise<boolean> {
    const className = String(await classNameArg?.get() ?? "");
    return this.phpClass ? this.phpClass.isSubclassOf(className) : false;
  }

  public async hasMethod(ctx: PHPContext, nameArg?: PHPReference): Promise<boolean> {
    const name = String(await nameArg?.get() ?? "");
    const methods = this.classConstructor?.[SYMBOL_PHP_METHODS];
    if (Object.hasOwn(methods || {}, encodePhpMethodName(name)) || Object.hasOwn(methods || {}, encodePhpMethodName(name, true))) return true;
    return Object.hasOwn(this.phpClass?.methods || {}, name.toLowerCase());
  }
  public async getMethod(ctx: PHPContext, nameArg?: PHPReference): Promise<ReflectionMethod> {
    const name = String(await nameArg?.get() ?? "");
    const methods = this.classConstructor?.[SYMBOL_PHP_METHODS];
    const meta = methods?.[encodePhpMethodName(name)]
      || methods?.[encodePhpMethodName(name, true)]
      || this.phpClass?.methods?.[name.toLowerCase()];
    return ReflectionMethod[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.name), new PHPLiteral(meta?.name || name), new PHPLiteral(meta), new PHPLiteral(meta?.fn));
  }
  public async getMethods(ctx: PHPContext): Promise<ReflectionMethod[]> {
    const methods: ReflectionMethod[] = [];
    const metadata = this.classConstructor?.[SYMBOL_PHP_METHODS] || this.phpClass?.methods;
    if (!metadata) return methods;
    const entries = [...Object.entries(metadata), ...Object.getOwnPropertySymbols(metadata).map((key) => [key, metadata[key]] as [symbol, any])];
    for (const [methodKey, meta] of entries) {
      const methodName = meta?.name || methodKey;
      methods.push(await ReflectionMethod[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.name), new PHPLiteral(methodName), new PHPLiteral(meta), new PHPLiteral(meta?.fn)));
    }
    return methods;
  }

  public async hasProperty(ctx: PHPContext, nameArg?: PHPReference): Promise<boolean> {
    const name = String(await nameArg?.get() ?? "");
    const properties = this.classConstructor?.[SYMBOL_PHP_PROPERTIES];
    if (properties != null) {
      return Object.hasOwn(properties, name);
    }
    return Object.hasOwn(this.phpClass?.properties || {}, name);
  }
  public async getProperty(ctx: PHPContext, nameArg?: PHPReference): Promise<ReflectionProperty> {
    const name = String(await nameArg?.get() ?? "");
    const properties = this.classConstructor?.[SYMBOL_PHP_PROPERTIES];
    const meta = properties?.[name] || this.phpClass?.properties?.[name];
    return ReflectionProperty[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.name), new PHPLiteral(name), new PHPLiteral(meta));
  }
  public async getProperties(ctx: PHPContext): Promise<ReflectionProperty[]> {
    const props: ReflectionProperty[] = [];
    const metadata = (this.classConstructor?.[SYMBOL_PHP_PROPERTIES] || this.phpClass?.properties) as Record<string, PHPPropertyMetadata> | undefined;
    if (!metadata) return props;
    for (const [propertyName, meta] of Object.entries(metadata)) {
      const p = meta?.name || propertyName;
      props.push(await ReflectionProperty[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.name), new PHPLiteral(p), new PHPLiteral(meta)));
    }
    return props;
  }

  public async hasConstant(ctx: PHPContext, nameArg?: PHPReference): Promise<boolean> {
    const name = String(await nameArg?.get() ?? "");
    const constants = this.classConstructor?.[SYMBOL_PHP_CONSTANTS];
    if (constants) return Object.hasOwn(constants, name.toLowerCase());
    return Object.hasOwn(this.phpClass?.constants || {}, name);
  }
  public async getConstant(ctx: PHPContext, nameArg?: PHPReference): Promise<any> {
    const name = String(await nameArg?.get() ?? "");
    const constant = this.classConstructor?.[SYMBOL_PHP_CONSTANTS]?.[name.toLowerCase()];
    if (constant !== undefined) return constant && typeof constant === "object" && "value" in constant ? constant.value : constant;
    return this.phpClass?.constants?.[name];
  }
  public async getConstants(ctx: PHPContext): Promise<Record<string, any>> {
    const metadata = this.classConstructor?.[SYMBOL_PHP_CONSTANTS] as Record<string, any> | undefined;
    if (metadata) {
      const constants: Record<string, any> = {};
      for (const [key, entry] of Object.entries(metadata)) {
        const constantName = entry && typeof entry === "object" && "name" in entry ? entry.name : key;
        constants[constantName] = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
      }
      return constants;
    }
    if (!this.phpClass) return {};
    return { ...this.phpClass.constants };
  }

  public async newInstance(ctx: PHPContext, ...args: PHPReference[]): Promise<any> {
    return await ctx.createObject(this.name, args);
  }
  public async newInstanceArgs(ctx: PHPContext, argsArg?: PHPReference): Promise<any> {
    const args = argsArg ? await argsArg.get() : [];
    const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
    return await ctx.createObject(this.name, callArgs);
  }
  public async newInstanceWithoutConstructor(ctx: PHPContext): Promise<any> {
    const className = normalizePhpRegistryName(this.name);
    const cls = this.phpClass || ctx.classes[className] || ctx.engine.classes[className];
    if (cls?.[SYMBOL_PHP_INIT]) {
      const obj = Object.create(cls.prototype);
      await cls[SYMBOL_PHP_INIT](ctx, obj);
      return obj;
    }
    return {};
  }
}

export class ReflectionRuntime {
  static classes = {
    "reflectionclass": ReflectionClass,
    "reflectionmethod": ReflectionMethod,
    "reflectionproperty": ReflectionProperty,
    "reflectionfunction": ReflectionFunction,
    "reflectionparameter": ReflectionParameter,
    "reflectiontype": ReflectionType,
  };

  public static register(engine: PHPEngine): void {
    engine.registerClasses(ReflectionRuntime.classes);
  }
}
