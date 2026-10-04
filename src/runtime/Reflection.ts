import { PHPClass, PHPObject, PHPMethodMetadata, PHPPropertyMetadata, PHPParameterMetadata } from "./PHPObject.js";
import type { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";

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

  (fn as any).phpMeta = {
    name: meta.name.toLowerCase(),
    visibility: meta.visibility || "public",
    numberOfParameters: params.length,
    numberOfRequiredParameters: requiredCount,
    parameters: params,
  };

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

  if ((fn as any).phpMeta) {
    return (fn as any).phpMeta;
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
  public static getModifierNames(modifiers: number): string[] {
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
  public readonly typeName: string;
  public readonly allowsNullFlag: boolean;

  constructor(typeName = "mixed", allowsNullFlag = true) {
    this.typeName = typeName;
    this.allowsNullFlag = allowsNullFlag;
  }

  public allowsNull(): boolean { return this.allowsNullFlag; }
  public getName(): string { return this.typeName; }
  public __toString(): string { return this.typeName; }
}

export class ReflectionParameter {
  public readonly paramName: string;
  public readonly paramPosition: number;
  public readonly defaultValue: any;
  public readonly hasDefault: boolean;

  constructor(name: string, position: number, defaultValue?: any, hasDefault = false) {
    this.paramName = name;
    this.paramPosition = position;
    this.defaultValue = defaultValue;
    this.hasDefault = hasDefault;
  }

  public getName(): string { return this.paramName; }
  public getPosition(): number { return this.paramPosition; }
  public isOptional(): boolean { return this.hasDefault; }
  public isDefaultValueAvailable(): boolean { return this.hasDefault; }
  public getDefaultValue(): any { return this.defaultValue; }
  public isPassedByReference(): boolean { return false; }
  public getType(): ReflectionType { return new ReflectionType(); }
}

export class ReflectionProperty {
  public readonly name: string;
  public readonly declaringClassName: string;
  public readonly meta?: PHPPropertyMetadata;
  public isAccessible = true;

  constructor(declaringClassName: string, name: string, meta?: PHPPropertyMetadata) {
    this.declaringClassName = declaringClassName;
    this.name = name;
    this.meta = meta;
  }

  public getName(): string { return this.name; }
  public getDeclaringClass(): ReflectionClass { return new ReflectionClass(this.declaringClassName); }
  public isPublic(): boolean { return !this.meta || this.meta.visibility === "public"; }
  public isProtected(): boolean { return this.meta?.visibility === "protected"; }
  public isPrivate(): boolean { return this.meta?.visibility === "private"; }
  public isStatic(): boolean { return this.meta?.isStatic || false; }
  public isReadOnly(): boolean { return this.meta?.isReadOnly || false; }
  public setAccessible(accessible: boolean): void { this.isAccessible = accessible; }
  public async getValue(ctx: PHPContext, obj: PHPObject): Promise<any> {
    return await obj.getProperty(ctx, this.name);
  }
  public async setValue(ctx: PHPContext, obj: PHPObject, val: any): Promise<void> {
    await obj.setProperty(ctx, this.name, val);
  }
}

export class ReflectionMethod {
  public readonly className: string;
  public readonly methodName: string;
  public readonly meta: PHPMethodMetadata;

  constructor(className: string, methodName: string, meta?: PHPMethodMetadata, fn?: Function) {
    this.className = className;
    this.methodName = methodName;
    this.meta = meta || parseJSFunctionMetadata(fn || (meta as any)?.fn, methodName);
  }

  public getName(): string { return this.methodName; }
  public getDeclaringClass(): ReflectionClass { return new ReflectionClass(this.className); }
  public isPublic(): boolean { return !this.meta || this.meta.visibility === "public"; }
  public isProtected(): boolean { return this.meta?.visibility === "protected"; }
  public isPrivate(): boolean { return this.meta?.visibility === "private"; }
  public isStatic(): boolean { return this.meta?.isStatic || false; }
  public isAbstract(): boolean { return this.meta?.isAbstract || false; }
  public isFinal(): boolean { return this.meta?.isFinal || false; }
  public isConstructor(): boolean { return this.methodName.toLowerCase() === "__construct"; }
  public isDestructor(): boolean { return this.methodName.toLowerCase() === "__destruct"; }
  public getNumberOfParameters(): number { return this.meta?.numberOfParameters ?? 0; }
  public getNumberOfRequiredParameters(): number { return this.meta?.numberOfRequiredParameters ?? 0; }
  public getParameters(): ReflectionParameter[] {
    if (!this.meta?.parameters) return [];
    return this.meta.parameters.map((p, idx) => new ReflectionParameter(p.name, idx, p.defaultValue, p.hasDefault));
  }
  public setAccessible(accessible: boolean): void {}
  public async invoke(ctx: PHPContext, object: PHPObject | null, ...args: any[]): Promise<any> {
    if (object) {
      return await object.callMethod(ctx, this.methodName, args);
    }
    return undefined;
  }
}

export class ReflectionFunction {
  public readonly name: string;
  public readonly meta: any;

  constructor(name: string, fnOrCtx?: Function | any) {
    this.name = name;
    let targetFn: Function | undefined;

    if (typeof fnOrCtx === "function") {
      targetFn = fnOrCtx;
    } else if (fnOrCtx?.engine) {
      targetFn = fnOrCtx.engine.functions[name.toLowerCase()];
    }

    this.meta = (targetFn as any)?.phpMeta || parseJSFunctionMetadata(targetFn, name);
  }

  public getName(): string { return this.name; }
  public getNamespaceName(): string { return ""; }
  public inNamespace(): boolean { return false; }
  public getNumberOfParameters(): number { return this.meta?.numberOfParameters ?? 0; }
  public getNumberOfRequiredParameters(): number { return this.meta?.numberOfRequiredParameters ?? 0; }
  public getParameters(): ReflectionParameter[] {
    if (!this.meta?.parameters) return [];
    return this.meta.parameters.map((p: any, idx: number) => new ReflectionParameter(p.name, idx, p.defaultValue, p.hasDefault));
  }
  public async invoke(ctx: PHPContext, ...args: any[]): Promise<any> {
    return await ctx.callFunction(this.name, args);
  }
  public async invokeArgs(ctx: PHPContext, args: any[]): Promise<any> {
    return await ctx.callFunction(this.name, args);
  }
}

export class ReflectionClass {
  public readonly name: string;
  private phpClass?: PHPClass;

  constructor(nameOrInstance: any) {
    if (typeof nameOrInstance === "string") {
      this.name = nameOrInstance;
    } else if (nameOrInstance?.phpClass) {
      this.phpClass = nameOrInstance.phpClass;
      this.name = this.phpClass?.name || "Object";
    } else {
      this.name = nameOrInstance?.name || "Object";
    }
  }

  public getName(): string { return this.name; }
  public getShortName(): string {
    const parts = this.name.split("\\");
    return parts[parts.length - 1];
  }
  public getNamespaceName(): string {
    const parts = this.name.split("\\");
    return parts.length > 1 ? parts.slice(0, -1).join("\\") : "";
  }
  public inNamespace(): boolean { return this.getNamespaceName().length > 0; }
  public getParentClass(): ReflectionClass | false {
    return this.phpClass?.parentClass ? new ReflectionClass(this.phpClass.parentClass.name) : false;
  }
  public isInterface(): boolean { return false; }
  public isAbstract(): boolean { return this.phpClass?.isAbstract || false; }
  public isFinal(): boolean { return this.phpClass?.isFinal || false; }
  public isInstantiable(): boolean { return !this.isAbstract() && !this.isInterface(); }
  public isSubclassOf(className: string): boolean {
    return this.phpClass ? this.phpClass.isSubclassOf(className) : false;
  }

  public hasMethod(name: string): boolean {
    return this.phpClass ? this.phpClass.methods.has(name.toLowerCase()) : true;
  }
  public getMethod(name: string): ReflectionMethod {
    const meta = this.phpClass?.methods.get(name.toLowerCase());
    return new ReflectionMethod(this.name, name, meta, meta?.fn);
  }
  public getMethods(): ReflectionMethod[] {
    if (!this.phpClass) return [];
    return Array.from(this.phpClass.methods.entries()).map(([m, meta]) => new ReflectionMethod(this.name, m, meta, meta?.fn));
  }

  public hasProperty(name: string): boolean {
    return this.phpClass ? this.phpClass.properties.has(name) : true;
  }
  public getProperty(name: string): ReflectionProperty {
    const meta = this.phpClass?.properties.get(name);
    return new ReflectionProperty(this.name, name, meta);
  }
  public getProperties(): ReflectionProperty[] {
    if (!this.phpClass) return [];
    return Array.from(this.phpClass.properties.entries()).map(([p, meta]) => new ReflectionProperty(this.name, p, meta));
  }

  public hasConstant(name: string): boolean {
    return this.phpClass ? this.phpClass.constants.has(name) : false;
  }
  public getConstant(name: string): any {
    return this.phpClass ? this.phpClass.constants.get(name) : undefined;
  }
  public getConstants(): Record<string, any> {
    if (!this.phpClass) return {};
    return Object.fromEntries(this.phpClass.constants);
  }

  public async newInstance(ctx: PHPContext, ...args: any[]): Promise<PHPObject> {
    return await ctx.createObject(this.name, args);
  }
  public async newInstanceArgs(ctx: PHPContext, args: any[] = []): Promise<PHPObject> {
    return await ctx.createObject(this.name, args);
  }
  public async newInstanceWithoutConstructor(ctx: PHPContext): Promise<PHPObject> {
    const cls = this.phpClass || new PHPClass(this.name);
    return new PHPObject(cls);
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
