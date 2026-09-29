import type { PHPContext } from "../../PHPContext";
import { PHPFatalError } from "../errors/PHPError";

export interface PHPParameterMetadata {
  name: string;
  position: number;
  isOptional: boolean;
  hasDefault: boolean;
  defaultValue?: any;
  type?: string;
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
  public readonly interfaces: PHPClass[] = [];
  public readonly traits: any[] = [];
  public constants: Map<string, any> = new Map();
  public staticProperties: Map<string, any> = new Map();
  public properties: Map<string, PHPPropertyMetadata> = new Map();
  public methods: Map<string, PHPMethodMetadata> = new Map();
  public isAbstract: boolean = false;
  public isFinal: boolean = false;

  constructor(name: string, parentClass?: PHPClass) {
    this.name = name;
    this.parentClass = parentClass;
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

  constructor(phpClass: PHPClass) {
    this.phpClass = phpClass;
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
    if (__setMeta?.fn) {
      await __setMeta.fn.call(this, ctx, name, value);
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
