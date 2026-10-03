import type { PHPContext } from "../PHPContext";
import { PHPFatalError } from "./PHPError";

export interface PHPReference {
  get(): any;
  set(val: any): any;
  bindRef?(target: PHPReference): void;
  unbindRef?(): void;
  isReference?(): boolean;
  call?(ctx: PHPContext, method: string, args: any[]): Promise<any>;
}

export class PHPLiteral implements PHPReference {
  private readonly value: any;

  constructor(value: any) {
    this.value = value && typeof value === "object" && typeof (value as any).get === "function"
      ? (value as any).get()
      : value;
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
}

export class PHPVariable implements PHPReference {
  private value: any;
  private refTarget?: PHPReference;

  constructor(initialValue: any = undefined) {
    if (initialValue && typeof initialValue === "object" && typeof (initialValue as any).get === "function") {
      const ref = initialValue as PHPReference;
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
    const unwrapped = val && typeof val === "object" && typeof (val as any).get === "function" ? (val as any).get() : val;
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
    const callArgs = args.map((arg) => (arg && typeof arg === "object" && typeof (arg as any).get === "function" ? arg : new PHPLiteral(arg)));

    if (typeof obj.callMethod === "function") {
      let res = await obj.callMethod(ctx, method, callArgs);
      if (res && typeof res === "object" && typeof res.get === "function") res = res.get();
      return res;
    }

    const metadata = obj?.phpClass?.methods?.get ? (obj.phpClass.methods.get(method) || obj.phpClass.methods.get(lowerMethod)) : (obj?.phpClass?.methods?.[method] || obj?.phpClass?.methods?.[lowerMethod]);
    if (metadata?.fn) {
      let res = await metadata.fn.apply(obj, [ctx, ...callArgs]);
      if (res && typeof res === "object" && typeof res.get === "function") res = res.get();
      return res;
    }

    if (typeof obj[method] === "function") {
      let res = await obj[method].apply(obj, [ctx, ...callArgs]);
      if (res && typeof res === "object" && typeof res.get === "function") res = res.get();
      return res;
    }

    if (typeof obj[lowerMethod] === "function") {
      let res = await obj[lowerMethod].apply(obj, [ctx, ...callArgs]);
      if (res && typeof res === "object" && typeof res.get === "function") res = res.get();
      return res;
    }

    let target = obj;
    while (target && target !== Object.prototype) {
      for (const propName of Object.getOwnPropertyNames(target)) {
        if (propName.toLowerCase() === lowerMethod && typeof obj[propName] === "function") {
          let res = await obj[propName].apply(obj, [ctx, ...callArgs]);
          if (res && typeof res === "object" && typeof res.get === "function") res = res.get();
          return res;
        }
      }
      target = Object.getPrototypeOf(target);
    }

    throw new PHPFatalError(`Call to undefined method ${obj?.constructor?.name || "object"}::${method}()`);
  }
}
