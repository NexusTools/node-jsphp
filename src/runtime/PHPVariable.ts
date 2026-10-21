import type { PHPContext } from "../PHPContext.js";
import { PHPFatalError } from "./PHPError.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";

export const SYMBOL_PHP_REFERENCE = Symbol.for("php.reference");
export const SYMBOL_PHP_VARIABLE = Symbol.for("php.variable");

export abstract class PHPReference {
  public static [Symbol.hasInstance](value: unknown): boolean {
    if (Function.prototype[Symbol.hasInstance].call(this, value)) return true;
    return this === PHPReference
      && value !== null
      && (typeof value === "object" || typeof value === "function")
      && (value as Record<symbol, unknown>)[SYMBOL_PHP_REFERENCE] === true;
  }

  public abstract get(): Promise<any>;
  public abstract set(value: any): Promise<any>;

  public async setFrom(otherref: PHPReference): Promise<any> {
    return await this.set(await otherref.get());
  }

  public async isset(): Promise<boolean> {
    const value = await this.get();
    return value !== null && value !== undefined;
  }

  public async unset(): Promise<void> {
    await this.set(undefined);
  }
}

export function isPHPReference(value: any): value is PHPReference {
  return value instanceof PHPReference
    || (value !== null && (typeof value === "object" || typeof value === "function") && value[SYMBOL_PHP_REFERENCE] === true);
}

export function isPHPVariable(value: any): boolean {
  return value instanceof PHPVariable
    || (value !== null && (typeof value === "object" || typeof value === "function") && value[SYMBOL_PHP_VARIABLE] === true);
}

export class PHPLiteral extends PHPReference {
  private readonly value: any;

  constructor(value: any) {
    super();
    this.value = value;
  }

  public async get(): Promise<any> {
    return this.value;
  }

  public async set(_value: any): Promise<never> {
    throw new PHPFatalError("Literals cannot be changed");
  }

  public toString(): string {
    return this.value === null || this.value === undefined ? "" : String(this.value);
  }

  public valueOf(): any {
    return this.value;
  }

  public [Symbol.toPrimitive](hint: string): any {
    if (hint === "number") return Number(this.value) || 0;
    if (hint === "string") return this.value === null || this.value === undefined ? "" : String(this.value);
    return this.value;
  }
}

export class PHPPropertyReference extends PHPReference {
  constructor(
    private readonly ctx: PHPContext,
    private readonly obj: any,
    private readonly prop: string,
    private readonly phpName = prop.startsWith("$") ? prop.slice(1) : prop
  ) {
    super();
  }

  public async get(): Promise<any> {
    const target = isPHPReference(this.obj) ? await this.obj.get() : this.obj;
    if (target === null || target === undefined) {
      return this.ctx.getProperty(target, this.prop);
    }

    const direct = target[this.prop];
    if (direct !== undefined) {
      return isPHPReference(direct) ? await direct.get() : direct;
    }

    if (typeof target.__get === "function") {
      return await target.__get(this.ctx, new PHPLiteral(this.phpName));
    }

    return await this.ctx.getProperty(target, this.prop);
  }

  public async set(value: any): Promise<any> {
    const target = isPHPReference(this.obj) ? await this.obj.get() : this.obj;
    if (target === null || target === undefined) {
      return this.ctx.setProperty(target, this.prop, value);
    }

    const direct = target[this.prop];
    if (isPHPReference(direct)) return await direct.set(value);
    if (direct !== undefined) {
      target[this.prop] = value;
      return value;
    }

    if (typeof target.__set === "function") {
      return await target.__set(this.ctx, new PHPLiteral(this.phpName), new PHPLiteral(value));
    }

    return await this.ctx.setProperty(target, this.prop, value);
  }

  public async isset(): Promise<boolean> {
    const target = isPHPReference(this.obj) ? await this.obj.get() : this.obj;
    if (target === null || target === undefined) return false;

    const direct = target[this.prop];
    if (direct !== undefined) {
      const value = isPHPReference(direct) ? await direct.get() : direct;
      return value !== null && value !== undefined;
    }

    if (typeof target.__isset === "function") {
      const result = await target.__isset(this.ctx, new PHPLiteral(this.phpName));
      return this.ctx.isTruthy(isPHPReference(result) ? await result.get() : result);
    }

    return false;
  }

  public async unset(): Promise<void> {
    const target = isPHPReference(this.obj) ? await this.obj.get() : this.obj;
    if (target === null || target === undefined) return;

    if (target[this.prop] === undefined && typeof target.__unset === "function") {
      await target.__unset(this.ctx, new PHPLiteral(this.phpName));
      return;
    }

    delete target[this.prop];
  }
}

export class PHPArrayOffsetReference extends PHPReference {
  constructor(
    private readonly container: any,
    private readonly key: any
  ) {
    super();
  }

  public async get(): Promise<any> {
    const target = isPHPReference(this.container) ? await this.container.get() : this.container;
    if (target === null || (typeof target !== "object" && typeof target !== "function")) return undefined;

    const value = target[this.key];
    return isPHPReference(value) ? await value.get() : value;
  }

  public async set(value: any): Promise<any> {
    const target = isPHPReference(this.container) ? await this.container.get() : this.container;
    const actual = isPHPReference(value) ? await value.get() : value;
    if (target !== null && (typeof target === "object" || typeof target === "function")) {
      target[this.key] = actual;
    }
    return actual;
  }
}

export class PHPVariable extends PHPReference {
  private value: any;

  constructor(initialValue: any = undefined) {
    super();
    this.value = initialValue;
  }

  public async get(): Promise<any> {
    return this.value;
  }

  public async set(value: any): Promise<any> {
    const actual = isPHPReference(value) ? await value.get() : value;
    if (Array.isArray(actual)) {
      const copy = [...actual];
      for (const key of Object.keys(actual)) {
        if (isNaN(Number(key))) (copy as any)[key] = actual[key];
      }
      delete (copy as any).__ptr;
      this.value = copy;
      return copy;
    }

    if (typeof actual === "object" && actual !== null && !actual[SYMBOL_PHP_NAME] && actual.constructor === Object) {
      const copy = { ...actual };
      delete (copy as any).__ptr;
      this.value = copy;
      return copy;
    }

    this.value = actual;
    return actual;
  }

  public setFrom(otherref: PHPReference): Promise<any> {
    if (otherref instanceof PHPVariable) return this.set(otherref.value);
    return super.setFrom(otherref);
  }

  public toString(): string {
    return this.value === null || this.value === undefined ? "" : String(this.value);
  }

  public valueOf(): any {
    return this.value;
  }

  public [Symbol.toPrimitive](hint: string): any {
    if (hint === "number") return Number(this.value) || 0;
    if (hint === "string") return this.value === null || this.value === undefined ? "" : String(this.value);
    return this.value;
  }
}

Object.defineProperties(PHPReference.prototype, {
  [SYMBOL_PHP_REFERENCE]: { value: true },
});
Object.defineProperties(PHPVariable.prototype, {
  [SYMBOL_PHP_VARIABLE]: { value: true },
});
