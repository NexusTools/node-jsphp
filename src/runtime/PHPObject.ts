import type { PHPContext } from "../PHPContext";
import { PHPFatalError } from "./PHPError";

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
  fn: Function;
}

export class PHPClass {
  public readonly name: string;
  public readonly parentClass?: PHPClass;
  public nativeConstructor?: Function;
  public readonly interfaces: PHPClass[] = [];
  public readonly traits: any[] = [];
  public constants: Map<string, any> = new Map();
  public staticProperties: Map<string, any> = new Map();
  public properties: Map<string, PHPPropertyMetadata> = new Map();
  public methods: Map<string, PHPMethodMetadata> = new Map();
  public isAbstract: boolean = false;
  public isFinal: boolean = false;

  constructor(name: string, parentClass?: PHPClass | Function) {
    this.name = name;
    if (typeof parentClass === "function") {
      const nativeParent = new PHPClass((parentClass as any).phpName || parentClass.name);
      nativeParent.nativeConstructor = parentClass;
      parentClass = nativeParent;
    }
    this.parentClass = parentClass;
    if (parentClass instanceof PHPClass) {
      this.nativeConstructor = parentClass.nativeConstructor;
      this.properties = new Map(parentClass.properties);
      this.methods = new Map(parentClass.methods);
      this.constants = new Map(parentClass.constants);
    }
  }

  public isSubclassOf(className: string): boolean {
    if (this.name.toLowerCase() === className.toLowerCase()) return true;
    if (this.parentClass && this.parentClass.isSubclassOf(className)) return true;
    return this.interfaces.some((iface) => iface.isSubclassOf(className));
  }
}

export class PHPObject {
  public readonly phpClass: PHPClass;
  public properties: Map<string, any> = new Map();
  private settingProperties: Set<string> = new Set();
  private proxy: any;

  constructor(phpClass: PHPClass) {
    this.phpClass = phpClass;
    for (const [name, metadata] of phpClass.properties) {
      if (metadata.isStatic) continue;
      const value = metadata.defaultValue;
      this.properties.set(name, Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value);
    }
  }

  public asProxy(ctx: PHPContext): any {
    if (this.proxy) return this.proxy;
    const target = this;
    this.proxy = new Proxy(target, {
      get(object, property, receiver) {
        if (property === "then") return undefined;
        if (typeof property !== "string") return Reflect.get(object, property, receiver);
        if (property in object) return Reflect.get(object, property, receiver);
        if (object.properties.has(property)) return object.properties.get(property);
        if (object.phpClass.methods.has("__get")) return object.getProperty(ctx, property);
        if (object.phpClass.methods.has("__call")) return (...args: any[]) => object.callMethod(ctx, property, args);
        return undefined;
      },
      set(object, property, value) {
        if (typeof property !== "string" || property in object) return Reflect.set(object, property, value);
        void object.setProperty(ctx, property, value);
        return true;
      },
    });
    return this.proxy;
  }

  public async getProperty(ctx: PHPContext, name: string): Promise<any> {
    if (this.properties.has(name)) {
      return this.properties.get(name);
    }
    const __getMeta = this.phpClass.methods.get("__get");
    if (__getMeta?.fn) {
      return await __getMeta.fn.call(this, ctx, name);
    }
    return undefined;
  }

  public async setProperty(ctx: PHPContext, name: string, value: any): Promise<void> {
    const __setMeta = this.phpClass.methods.get("__set");
    if (__setMeta?.fn && !this.settingProperties.has(name)) {
      this.settingProperties.add(name);
      try {
      await __setMeta.fn.call(this, ctx, name, value);
      } finally {
        this.settingProperties.delete(name);
      }
    } else {
      this.properties.set(name, value);
    }
  }

  public async callMethod(ctx: PHPContext, name: string, args: any[]): Promise<any> {
    const methodMeta = this.phpClass.methods.get(name.toLowerCase());
    if (methodMeta?.fn) {
      return await methodMeta.fn.apply(this, [ctx, ...args]);
    }
    const __callMeta = this.phpClass.methods.get("__call");
    if (__callMeta?.fn) {
      return await __callMeta.fn.call(this, ctx, name, args);
    }
    throw new PHPFatalError(`Call to undefined method ${this.phpClass.name}::${name}()`);
  }

  public async toString(ctx: PHPContext): Promise<string> {
    const __toStringMeta = this.phpClass.methods.get("__tostring");
    if (__toStringMeta?.fn) {
      return String(await __toStringMeta.fn.call(this, ctx));
    }
    return `Object(${this.phpClass.name})`;
  }
}
