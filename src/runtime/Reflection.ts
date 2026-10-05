import type { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";
import { PHPLiteral, PHPReference } from "./PHPVariable.js";

export const SYMBOL_PHP_META = Symbol.for("php.meta");
export const SYMBOL_PHP_NAME = Symbol.for("php.name");
export const SYMBOL_PHP_CONSTANTS = Symbol.for("php.constants");
export const SYMBOL_PHP_PROPERTIES = Symbol.for("php.properties");
export const SYMBOL_PHP_METHODS = Symbol.for("php.methods");
export const SYMBOL_PHP_CLASS = Symbol.for("php.class");
export const SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS = Symbol.for("php.hasMagicMethods");
export const SYMBOL_PHP_CLASS_INTERFACES = Symbol.for("php.interfaces");

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
}

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
  public static getModifierNames(ctx: PHPContext, modifiersArg?: PHPReference): string[] {
    const modifiers = Number(modifiersArg?.get()) || 0;
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

  public static async __$$__new(ctx: PHPContext, typeNameArg?: PHPReference, allowsNullFlagArg?: PHPReference): Promise<ReflectionType> {
    const obj = Object.create(ReflectionType.prototype);
    await ReflectionType.__construct.call(obj, ctx, typeNameArg, allowsNullFlagArg);
    return obj;
  }

  public static async __construct(this: ReflectionType, ctx: PHPContext, typeNameArg?: PHPReference, allowsNullFlagArg?: PHPReference): Promise<void> {
    this.typeName = typeNameArg ? String(typeNameArg.get() ?? "") : "mixed";
    this.allowsNullFlag = allowsNullFlagArg ? Boolean(allowsNullFlagArg.get()) : true;
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

  public static async __$$__new(ctx: PHPContext, nameArg?: PHPReference, positionArg?: PHPReference, defaultValueArg?: PHPReference, hasDefaultArg?: PHPReference): Promise<ReflectionParameter> {
    const obj = Object.create(ReflectionParameter.prototype);
    await ReflectionParameter.__construct.call(obj, ctx, nameArg, positionArg, defaultValueArg, hasDefaultArg);
    return obj;
  }

  public static async __construct(this: ReflectionParameter, ctx: PHPContext, nameArg?: PHPReference, positionArg?: PHPReference, defaultValueArg?: PHPReference, hasDefaultArg?: PHPReference): Promise<void> {
    this.paramName = nameArg ? String(nameArg.get() ?? "") : "";
    this.paramPosition = positionArg ? Number(positionArg.get()) || 0 : 0;
    this.defaultValue = defaultValueArg ? defaultValueArg.get() : undefined;
    this.hasDefault = hasDefaultArg ? Boolean(hasDefaultArg.get()) : false;
  }

  public getName(ctx: PHPContext): string { return this.paramName; }
  public getPosition(ctx: PHPContext): number { return this.paramPosition; }
  public isOptional(ctx: PHPContext): boolean { return this.hasDefault; }
  public isDefaultValueAvailable(ctx: PHPContext): boolean { return this.hasDefault; }
  public getDefaultValue(ctx: PHPContext): any { return this.defaultValue; }
  public isPassedByReference(ctx: PHPContext): boolean { return false; }
  public async getType(ctx: PHPContext): Promise<ReflectionType> {
    return await ReflectionType.__$$__new(ctx);
  }
}

export class ReflectionProperty {
  public name!: string;
  public declaringClassName!: string;
  public meta?: PHPPropertyMetadata;
  public isAccessible = true;

  public static async __$$__new(ctx: PHPContext, classArg?: PHPReference, nameArg?: PHPReference, metaArg?: PHPReference): Promise<ReflectionProperty> {
    const obj = Object.create(ReflectionProperty.prototype);
    await ReflectionProperty.__construct.call(obj, ctx, classArg, nameArg, metaArg);
    return obj;
  }

  public static async __construct(this: ReflectionProperty, ctx: PHPContext, classArg?: PHPReference, nameArg?: PHPReference, metaArg?: PHPReference): Promise<void> {
    this.declaringClassName = classArg ? String(classArg.get() ?? "") : "";
    this.name = nameArg ? String(nameArg.get() ?? "") : "";
    this.meta = metaArg ? metaArg.get() : undefined;
  }

  public getName(ctx: PHPContext): string { return this.name; }
  public async getDeclaringClass(ctx: PHPContext): Promise<ReflectionClass> {
    return await ReflectionClass.__$$__new(ctx, new PHPLiteral(this.declaringClassName));
  }
  public isPublic(ctx: PHPContext): boolean { return !this.meta || this.meta.visibility === "public"; }
  public isProtected(ctx: PHPContext): boolean { return this.meta?.visibility === "protected"; }
  public isPrivate(ctx: PHPContext): boolean { return this.meta?.visibility === "private"; }
  public isStatic(ctx: PHPContext): boolean { return this.meta?.isStatic || false; }
  public isReadOnly(ctx: PHPContext): boolean { return this.meta?.isReadOnly || false; }
  public setAccessible(ctx: PHPContext, accessibleArg?: PHPReference): void {
    this.isAccessible = accessibleArg ? Boolean(accessibleArg.get()) : true;
  }
  public async getValue(ctx: PHPContext, objArg?: PHPReference): Promise<any> {
    const obj = objArg?.get();
    if (obj && typeof obj === "object") {
      return await ctx.getProperty(obj, this.name);
    }
    return undefined;
  }
  public async setValue(ctx: PHPContext, objArg?: PHPReference, valArg?: PHPReference): Promise<void> {
    const obj = objArg?.get();
    if (obj && typeof obj === "object") {
      await ctx.setProperty(obj, this.name, valArg?.get());
    }
  }
}

export class ReflectionMethod {
  public className!: string;
  public methodName!: string;
  public meta!: PHPMethodMetadata;

  public static async __$$__new(ctx: PHPContext, classArg?: PHPReference, methodArg?: PHPReference, metaArg?: PHPReference, fnArg?: PHPReference): Promise<ReflectionMethod> {
    const obj = Object.create(ReflectionMethod.prototype);
    await ReflectionMethod.__construct.call(obj, ctx, classArg, methodArg, metaArg, fnArg);
    return obj;
  }

  public static async __construct(this: ReflectionMethod, ctx: PHPContext, classArg?: PHPReference, methodArg?: PHPReference, metaArg?: PHPReference, fnArg?: PHPReference): Promise<void> {
    const cls = classArg ? String(classArg.get() ?? "") : "";
    const methodName = methodArg ? String(methodArg.get() ?? "") : "";
    if (!methodName && cls.includes("::")) {
      const parts = cls.split("::");
      this.className = parts[0];
      this.methodName = parts[1];
    } else {
      this.className = cls;
      this.methodName = methodName;
    }
    const meta = metaArg ? metaArg.get() : undefined;
    const fn = fnArg ? fnArg.get() : undefined;
    this.meta = meta || parseJSFunctionMetadata(fn || meta?.fn, this.methodName);
  }

  public getName(ctx: PHPContext): string { return this.methodName; }
  public async getDeclaringClass(ctx: PHPContext): Promise<ReflectionClass> {
    return await ReflectionClass.__$$__new(ctx, new PHPLiteral(this.className));
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
      params.push(await ReflectionParameter.__$$__new(ctx, new PHPLiteral(p.name), new PHPLiteral(idx), new PHPLiteral(p.defaultValue), new PHPLiteral(p.hasDefault)));
    }
    return params;
  }
  public setAccessible(ctx: PHPContext, accessibleArg?: PHPReference): void {}
  public async invoke(ctx: PHPContext, objectArg?: PHPReference, ...args: PHPReference[]): Promise<any> {
    const object = objectArg?.get();
    const lower = this.methodName.toLowerCase();
    if (object && typeof object === "object") {
      if (typeof object[lower] === "function") return await object[lower](ctx, ...args);
      if (typeof object.__call === "function") return await object.__call(ctx, new PHPLiteral(lower), new PHPLiteral(args));
      return ctx.methodMissing(object, lower);
    }
    return undefined;
  }
  public async invokeArgs(ctx: PHPContext, objectArg?: PHPReference, argsArg?: PHPReference): Promise<any> {
    const object = objectArg?.get();
    const args = argsArg ? argsArg.get() : [];
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

  public static async __$$__new(ctx: PHPContext, nameArg?: PHPReference, fnOrCtxArg?: PHPReference): Promise<ReflectionFunction> {
    const obj = Object.create(ReflectionFunction.prototype);
    await ReflectionFunction.__construct.call(obj, ctx, nameArg, fnOrCtxArg);
    return obj;
  }

  public static async __construct(this: ReflectionFunction, ctx: PHPContext, nameArg?: PHPReference, fnOrCtxArg?: PHPReference): Promise<void> {
    this.name = nameArg ? String(nameArg.get() ?? "") : "";
    let targetFn: Function | undefined;
    const fnOrCtx = fnOrCtxArg ? fnOrCtxArg.get() : undefined;

    if (typeof fnOrCtx === "function") {
      targetFn = fnOrCtx;
    } else if (ctx.engine) {
      targetFn = ctx.engine.functions[this.name.toLowerCase()];
    }

    this.meta = (targetFn as any)?.phpMeta || parseJSFunctionMetadata(targetFn, this.name);
  }

  public getName(ctx: PHPContext): string { return this.name; }
  public getNamespaceName(ctx: PHPContext): string { return ""; }
  public inNamespace(ctx: PHPContext): boolean { return false; }
  public getNumberOfParameters(ctx: PHPContext): number { return this.meta?.numberOfParameters ?? 0; }
  public getNumberOfRequiredParameters(ctx: PHPContext): number { return this.meta?.numberOfRequiredParameters ?? 0; }
  public async getParameters(ctx: PHPContext): Promise<ReflectionParameter[]> {
    if (!this.meta?.parameters) return [];
    const params: ReflectionParameter[] = [];
    for (let idx = 0; idx < this.meta.parameters.length; idx++) {
      const p = this.meta.parameters[idx];
      params.push(await ReflectionParameter.__$$__new(ctx, new PHPLiteral(p.name), new PHPLiteral(idx), new PHPLiteral(p.defaultValue), new PHPLiteral(p.hasDefault)));
    }
    return params;
  }
  public async invoke(ctx: PHPContext, ...args: PHPReference[]): Promise<any> {
    const fn = ctx.functions[this.name.toLowerCase()] || ctx.functionMissing(this.name);
    return await fn(ctx, ...args);
  }
  public async invokeArgs(ctx: PHPContext, argsArg?: PHPReference): Promise<any> {
    const args = argsArg ? argsArg.get() : [];
    const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
    const fn = ctx.functions[this.name.toLowerCase()] || ctx.functionMissing(this.name);
    return await fn(ctx, ...callArgs);
  }
}

export class ReflectionClass {
  public name!: string;
  private phpClass?: any;

  public static async __$$__new(ctx: PHPContext, nameOrInstanceArg?: PHPReference): Promise<ReflectionClass> {
    const obj = Object.create(ReflectionClass.prototype);
    await ReflectionClass.__construct.call(obj, ctx, nameOrInstanceArg);
    return obj;
  }

  public static async __construct(this: ReflectionClass, ctx: PHPContext, nameOrInstanceArg?: PHPReference): Promise<void> {
    const nameOrInstance = nameOrInstanceArg?.get();
    if (typeof nameOrInstance === "string") {
      this.name = nameOrInstance;
      const lower = this.name.toLowerCase();
      this.phpClass = ctx.classes[this.name] || ctx.classes[lower] || ctx.engine.classes[this.name] || ctx.engine.classes[lower];
    } else if (nameOrInstance?.phpClass) {
      this.phpClass = nameOrInstance.phpClass;
      this.name = this.phpClass?.name || "Object";
    } else {
      this.name = nameOrInstance?.name || "Object";
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
    return this.phpClass?.parentClass ? await ReflectionClass.__$$__new(ctx, new PHPLiteral(this.phpClass.parentClass.name)) : false;
  }
  public isInterface(ctx: PHPContext): boolean { return false; }
  public isAbstract(ctx: PHPContext): boolean { return this.phpClass?.isAbstract || false; }
  public isFinal(ctx: PHPContext): boolean { return this.phpClass?.isFinal || false; }
  public isInstantiable(ctx: PHPContext): boolean { return !this.isAbstract(ctx) && !this.isInterface(ctx); }
  public isSubclassOf(ctx: PHPContext, classNameArg?: PHPReference): boolean {
    const className = String(classNameArg?.get() ?? "");
    return this.phpClass ? this.phpClass.isSubclassOf(className) : false;
  }

  public hasMethod(ctx: PHPContext, nameArg?: PHPReference): boolean {
    const name = String(nameArg?.get() ?? "");
    return this.phpClass ? this.phpClass.methods.has(name.toLowerCase()) : true;
  }
  public async getMethod(ctx: PHPContext, nameArg?: PHPReference): Promise<ReflectionMethod> {
    const name = String(nameArg?.get() ?? "");
    const meta = this.phpClass?.methods.get(name.toLowerCase());
    return await ReflectionMethod.__$$__new(ctx, new PHPLiteral(this.name), new PHPLiteral(name), new PHPLiteral(meta), new PHPLiteral(meta?.fn));
  }
  public async getMethods(ctx: PHPContext): Promise<ReflectionMethod[]> {
    if (!this.phpClass) return [];
    const methods: ReflectionMethod[] = [];
    for (const [m, meta] of this.phpClass.methods.entries()) {
      methods.push(await ReflectionMethod.__$$__new(ctx, new PHPLiteral(this.name), new PHPLiteral(m), new PHPLiteral(meta), new PHPLiteral(meta?.fn)));
    }
    return methods;
  }

  public hasProperty(ctx: PHPContext, nameArg?: PHPReference): boolean {
    const name = String(nameArg?.get() ?? "");
    return this.phpClass ? this.phpClass.properties.has(name) : true;
  }
  public async getProperty(ctx: PHPContext, nameArg?: PHPReference): Promise<ReflectionProperty> {
    const name = String(nameArg?.get() ?? "");
    const meta = this.phpClass?.properties.get(name);
    return await ReflectionProperty.__$$__new(ctx, new PHPLiteral(this.name), new PHPLiteral(name), new PHPLiteral(meta));
  }
  public async getProperties(ctx: PHPContext): Promise<ReflectionProperty[]> {
    if (!this.phpClass) return [];
    const props: ReflectionProperty[] = [];
    for (const [p, meta] of this.phpClass.properties.entries()) {
      props.push(await ReflectionProperty.__$$__new(ctx, new PHPLiteral(this.name), new PHPLiteral(p), new PHPLiteral(meta)));
    }
    return props;
  }

  public hasConstant(ctx: PHPContext, nameArg?: PHPReference): boolean {
    const name = String(nameArg?.get() ?? "");
    return this.phpClass ? this.phpClass.constants.has(name) : false;
  }
  public getConstant(ctx: PHPContext, nameArg?: PHPReference): any {
    const name = String(nameArg?.get() ?? "");
    return this.phpClass ? this.phpClass.constants.get(name) : undefined;
  }
  public getConstants(ctx: PHPContext): Record<string, any> {
    if (!this.phpClass) return {};
    return Object.fromEntries(this.phpClass.constants);
  }

  public async newInstance(ctx: PHPContext, ...args: PHPReference[]): Promise<any> {
    return await ctx.createObject(this.name, args);
  }
  public async newInstanceArgs(ctx: PHPContext, argsArg?: PHPReference): Promise<any> {
    const args = argsArg ? argsArg.get() : [];
    const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
    return await ctx.createObject(this.name, callArgs);
  }
  public async newInstanceWithoutConstructor(ctx: PHPContext): Promise<any> {
    const cls = this.phpClass || ctx.classes[this.name] || ctx.classes[this.name.toLowerCase()] || ctx.engine.classes[this.name] || ctx.engine.classes[this.name.toLowerCase()];
    if (cls && typeof cls.__$$__init === "function") {
      const obj = Object.create(cls.prototype);
      await cls.__$$__init(ctx, obj);
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
