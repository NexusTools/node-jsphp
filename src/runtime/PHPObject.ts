import type { PHPContext } from "../PHPContext.js";
import { PHPFatalError } from "./PHPError.js";
import { PHPReference } from "./PHPVariable.js";
import { normalizePhpRegistryName } from "./Reflection.js";

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
  public constants: Record<string, any> = Object.create(null);
  public staticProperties: Record<string, any> = Object.create(null);
  public properties: Record<string, PHPPropertyMetadata> = Object.create(null);
  public methods: Record<string, PHPMethodMetadata> = Object.create(null);
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
      this.properties = Object.assign(Object.create(null), parentClass.properties);
      this.methods = Object.assign(Object.create(null), parentClass.methods);
      this.constants = Object.assign(Object.create(null), parentClass.constants);
    }
  }

  public isSubclassOf(className: string): boolean {
    if (normalizePhpRegistryName(this.name) === normalizePhpRegistryName(className)) return true;
    if (this.parentClass && this.parentClass.isSubclassOf(className)) return true;
    return this.interfaces.some((iface) => iface.isSubclassOf(className));
  }
}

export class PHPObject {
  public readonly phpClass: PHPClass;
  public properties: Record<string, any> = Object.create(null);
  private settingProperties: Set<string> = new Set();
  private gettingProperties: Set<string> = new Set();

  constructor(phpClass: PHPClass) {
    this.phpClass = phpClass;
    for (const [name, metadata] of Object.entries(phpClass.properties)) {
      if (metadata.isStatic) continue;
      const value = metadata.defaultValue;
      this.properties[name] = Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value;
    }
  }

  public async getProperty(ctx: PHPContext, name: string): Promise<any> {
    if (!(this.gettingProperties instanceof Set)) {
      this.gettingProperties = new Set();
    }
    if (Object.hasOwn(this.properties, name)) {
      return this.properties[name];
    }
    const __getMeta = this.phpClass.methods["__get"];
    if (__getMeta?.fn && !this.gettingProperties.has(name)) {
      this.gettingProperties.add(name);
      try {
        return await __getMeta.fn.call(this, ctx, name);
      } finally {
        this.gettingProperties.delete(name);
      }
    }
    return undefined;
  }

  public async setProperty(ctx: PHPContext, name: string, value: any): Promise<void> {
    if (!(this.settingProperties instanceof Set)) {
      this.settingProperties = new Set();
    }
    const __setMeta = this.phpClass.methods["__set"];
    if (__setMeta?.fn && !this.settingProperties.has(name)) {
      this.settingProperties.add(name);
      try {
        await __setMeta.fn.call(this, ctx, name, value);
      } finally {
        this.settingProperties.delete(name);
      }
    } else {
      this.properties[name] = value;
    }
  }

  public async callMethod(ctx: PHPContext, name: string, args: any[]): Promise<any> {
    const lowerName = name.toLowerCase();
    ctx.currentClassStack.push(this.phpClass);
    try {
      let cls: PHPClass | undefined = this.phpClass;
      while (cls) {
        const methodMeta = cls.methods[lowerName];
        if (methodMeta?.fn) {
          let res = await methodMeta.fn.apply(this, [ctx, ...args]);
          if (res && typeof res === "object" && typeof (res as any).get === "function") res = await (res as any).get();
          return res;
        }
        cls = cls.parentClass;
      }
      cls = this.phpClass;
      while (cls) {
        const __callMeta = cls.methods["__call"];
        if (__callMeta?.fn) {
          let res = await __callMeta.fn.call(this, ctx, name, args);
          if (res instanceof PHPReference) res = await res.get();
          return res;
        }
        cls = cls.parentClass;
      }
      let target: any = this;
      while (target && target !== Object.prototype) {
        for (const propName of Object.getOwnPropertyNames(target)) {
          if (propName.toLowerCase() === lowerName && typeof (this as any)[propName] === "function") {
            let res = await (this as any)[propName].apply(this, args);
            if (res instanceof PHPReference) res = await res.get();
            return res;
          }
        }
        target = Object.getPrototypeOf(target);
      }
      throw new PHPFatalError(`Call to undefined method ${this.phpClass.name}::${name}()`);
    } finally {
      ctx.currentClassStack.pop();
    }
  }

  public async toString(ctx: PHPContext): Promise<string> {
    const __toStringMeta = this.phpClass.methods["__tostring"];
    if (__toStringMeta?.fn) {
      return String(await __toStringMeta.fn.call(this, ctx));
    }
    return `Object(${this.phpClass.name})`;
  }
}
