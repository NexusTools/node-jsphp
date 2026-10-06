import type { PHPContext } from "../PHPContext.js";
import { PHPFatalError } from "./PHPError.js";

export abstract class PHPReference {
  public abstract get(): any;
  public abstract set(val: any): any;
  public bindRef?(target: PHPReference): void;
  public unbindRef?(): void;
  public isReference?(): boolean;
  public call?(ctx: PHPContext, method: string, args: any[]): Promise<any>;
}

export class PHPLiteral extends PHPReference {
  private readonly value: any;

  constructor(value: any) {
    super();
    this.value = value;
  }

  public get(): any {
    return this.value;
  }

  public set(val: any): any {
    throw new PHPFatalError(`Literals cannot be changed`);
  }

  public bindRef(target: PHPReference): void {
    // Literal variables do not bind references
  }

  public unbindRef(): void {
    // N/A
  }

  public isReference(): boolean {
    return false;
  }

  public async call(ctx: PHPContext, method: string, args: any[] = []): Promise<any> {
    throw new PHPFatalError(`Call to a member function ${method}() on a non-object`);
  }

  public toString(): string {
    const val = this.get();
    return val === null || val === undefined ? "" : String(val);
  }

  public valueOf(): any {
    return this.get();
  }

  public [Symbol.toPrimitive](hint: string): any {
    const val = this.get();
    if (hint === "number") return Number(val) || 0;
    if (hint === "string") return val === null || val === undefined ? "" : String(val);
    return val;
  }
}

export class PHPPropertyReference extends PHPReference {
  private ctx: PHPContext;
  private obj: any;
  private prop: string;

  constructor(ctx: PHPContext, obj: any, prop: string) {
    super();
    this.ctx = ctx;
    this.obj = obj;
    this.prop = prop;
  }

  public get(): any {
    const p = this.prop.startsWith("$") ? this.prop : "$" + this.prop;
    const nop = this.prop.startsWith("$") ? this.prop.slice(1) : this.prop;
    if (this.obj && typeof this.obj === "object") {
      if (p in this.obj) {
        const val = this.obj[p];
        return val instanceof PHPReference ? val.get() : val;
      }
      if (nop in this.obj && typeof this.obj[nop] !== "function") {
        const val = this.obj[nop];
        return val instanceof PHPReference ? val.get() : val;
      }
    }
    return undefined;
  }

  public set(val: any): any {
    return this.ctx.setProperty(this.obj, this.prop, val);
  }
}

export class PHPArrayOffsetReference extends PHPReference {
  private container: any;
  private key: any;

  constructor(container: any, key: any) {
    super();
    this.container = container;
    this.key = key;
  }

  public get(): any {
    const obj = this.container instanceof PHPReference ? this.container.get() : this.container;
    if (obj && typeof obj === "object") {
      const val = obj[this.key];
      return val instanceof PHPReference ? val.get() : val;
    }
    return undefined;
  }

  public set(val: any): any {
    const obj = this.container instanceof PHPReference ? this.container.get() : this.container;
    const unwrapped = val instanceof PHPReference ? val.get() : val;
    if (obj && typeof obj === "object") {
      obj[this.key] = unwrapped;
    }
    return unwrapped;
  }
}

export class PHPVariable extends PHPReference {
  private value: any;
  private refTarget?: PHPReference;

  constructor(initialValue: any = undefined) {
    super();
    if (initialValue instanceof PHPReference) {
      const ref = initialValue;
      if ((ref as any).refTarget) {
        let rootTarget = (ref as any).refTarget;
        while ((rootTarget as any).refTarget) {
          rootTarget = (rootTarget as any).refTarget;
        }
        this.refTarget = rootTarget;
      } else {
        this.value = ref.get();
      }
    } else {
      this.value = initialValue;
    }
  }

  public get(): any {
    if (this.refTarget) return this.refTarget.get();
    return this.value;
  }

  public set(val: any): any {
    if (this.refTarget) return this.refTarget.set(val);
    const unwrapped = val instanceof PHPReference ? val.get() : val;
    if (Array.isArray(unwrapped)) {
      const copy = [...unwrapped];
      for (const k of Object.keys(unwrapped)) {
        if (isNaN(Number(k))) (copy as any)[k] = (unwrapped as any)[k];
      }
      delete (copy as any).__ptr;
      this.value = copy;
      return copy;
    }
    this.value = unwrapped;
    return unwrapped;
  }

  public bindRef(target: PHPReference): void {
    let actualTarget = target;
    while ((actualTarget as any).refTarget) {
      actualTarget = (actualTarget as any).refTarget;
    }
    this.refTarget = actualTarget;
  }

  public unbindRef(): void {
    if (this.refTarget) {
      this.value = this.refTarget.get();
      this.refTarget = undefined;
    }
  }

  public isReference(): boolean {
    return Boolean(this.refTarget);
  }

  public async call(ctx: PHPContext, method: string, args: any[] = []): Promise<any> {
    const obj = this.get();
    if (!obj || (typeof obj !== "object" && typeof obj !== "function")) {
      throw new PHPFatalError(`Call to a member function ${method}() on a non-object`);
    }

    const lowerMethod = method.toLowerCase();
    const callArgs = args.map((arg) => (arg instanceof PHPReference ? arg : new PHPLiteral(arg)));

    if (typeof obj.callMethod === "function") {
      let res = await obj.callMethod(ctx, method, callArgs);
      if (res instanceof PHPReference) res = res.get();
      return res;
    }

    const metadata = obj?.phpClass?.methods?.get ? (obj.phpClass.methods.get(method) || obj.phpClass.methods.get(lowerMethod)) : (obj?.phpClass?.methods?.[method] || obj?.phpClass?.methods?.[lowerMethod]);
    if (metadata?.fn) {
      let res = await metadata.fn.apply(obj, [ctx, ...callArgs]);
      if (res instanceof PHPReference) res = res.get();
      return res;
    }

    if (typeof obj[method] === "function") {
      let res = await obj[method].apply(obj, [ctx, ...callArgs]);
      if (res instanceof PHPReference) res = res.get();
      return res;
    }

    if (typeof obj[lowerMethod] === "function") {
      let res = await obj[lowerMethod].apply(obj, [ctx, ...callArgs]);
      if (res instanceof PHPReference) res = res.get();
      return res;
    }

    throw new PHPFatalError(`Call to undefined method ${obj?.constructor?.name}::${method}()`);
  }

  public toString(): string {
    const val = this.get();
    return val === null || val === undefined ? "" : String(val);
  }

  public valueOf(): any {
    return this.get();
  }

  public [Symbol.toPrimitive](hint: string): any {
    const val = this.get();
    if (hint === "number") return Number(val) || 0;
    if (hint === "string") return val === null || val === undefined ? "" : String(val);
    return val;
  }
}
