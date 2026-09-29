import type { PHPContext } from "../../PHPContext";

export class PHPClass {
  public readonly name: string;
  public readonly parentClass?: PHPClass;
  public readonly interfaces: PHPClass[] = [];
  public readonly traits: any[] = [];
  public constants: Map<string, any> = new Map();
  public staticProperties: Map<string, any> = new Map();
  public methods: Map<string, Function> = new Map();
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
    const __get = this.phpClass.methods.get("__get");
    if (__get) {
      return await __get.call(this, ctx, name);
    }
    return undefined;
  }

  public async setProperty(ctx: PHPContext, name: string, value: any): Promise<void> {
    const __set = this.phpClass.methods.get("__set");
    if (__set) {
      await __set.call(this, ctx, name, value);
    } else {
      this.properties.set(name, value);
    }
  }

  public async callMethod(ctx: PHPContext, name: string, args: any[]): Promise<any> {
    const method = this.phpClass.methods.get(name.toLowerCase());
    if (method) {
      return await method.apply(this, [ctx, ...args]);
    }
    const __call = this.phpClass.methods.get("__call");
    if (__call) {
      return await __call.call(this, ctx, name, args);
    }
    throw new Error(`Call to undefined method ${this.phpClass.name}::${name}()`);
  }

  public async toString(ctx: PHPContext): Promise<string> {
    const __toString = this.phpClass.methods.get("__tostring");
    if (__toString) {
      return String(await __toString.call(this, ctx));
    }
    return `Object(${this.phpClass.name})`;
  }
}
