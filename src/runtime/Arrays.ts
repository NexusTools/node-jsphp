import { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";
import { PHPFatalError } from "./PHPError";

export class ArrayRuntime {
  public static count(arrayOrCountable: any): number {
    if (!arrayOrCountable) return 0;
    if (Array.isArray(arrayOrCountable)) return arrayOrCountable.length;
    if (typeof arrayOrCountable === "object") return Object.keys(arrayOrCountable).length;
    return 1;
  }

  public static array_keys(input: any): any[] {
    if (!input || typeof input !== "object") return [];
    if (Array.isArray(input)) return input.map((_, i) => i);
    return Object.keys(input);
  }

  public static array_values(input: any): any[] {
    if (!input || typeof input !== "object") return [];
    if (Array.isArray(input)) return [...input];
    return Object.values(input);
  }

  public static array_flip(input: any): Record<string, any> {
    const res: Record<string, any> = {};
    if (!input || typeof input !== "object") return res;
    for (const [k, v] of Object.entries(input)) {
      res[String(v)] = k;
    }
    return res;
  }

  public static array_reverse(array: any[]): any[] {
    if (!Array.isArray(array)) return [];
    return [...array].reverse();
  }

  public static in_array(needle: any, haystack: any, strict = false): boolean {
    if (!haystack) return false;
    const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
    if (strict) {
      return values.includes(needle);
    }
    return values.some((v) => v == needle);
  }

  public static array_search(needle: any, haystack: any, strict = false): any | false {
    if (!haystack || typeof haystack !== "object") return false;
    const entries = Array.isArray(haystack)
      ? haystack.map((v, i) => [i, v])
      : Object.entries(haystack);

    for (const [k, v] of entries) {
      if (strict ? v === needle : v == needle) {
        return k;
      }
    }
    return false;
  }

  public static array_key_exists(key: any, search: any): boolean {
    if (!search || typeof search !== "object") return false;
    return key in search;
  }

  public static array_merge(...arrays: any[]): any {
    if (arrays.every((a) => Array.isArray(a))) {
      return ([] as any[]).concat(...arrays);
    }
    const result: Record<string, any> = {};
    for (const arr of arrays) {
      if (arr && typeof arr === "object") {
        Object.assign(result, arr);
      }
    }
    return result;
  }

  public static array_combine(keys: any[], values: any[]): Record<string, any> | false {
    if (!Array.isArray(keys) || !Array.isArray(values) || keys.length !== values.length) {
      return false;
    }
    const res: Record<string, any> = {};
    keys.forEach((k, i) => {
      res[String(k)] = values[i];
    });
    return res;
  }

  public static array_fill(startIndex: number, count: number, value: any): any[] | Record<string, any> {
    if (count < 0) throw new PHPFatalError("array_fill(): Argument #2 ($count) must be greater than or equal to 0");
    if (count === 0 || startIndex === 0) return Array.from({ length: count }, () => value);
    const result: Record<string, any> = {};
    for (let offset = 0; offset < count; offset++) result[startIndex + offset] = value;
    return result;
  }

  public static array_fill_keys(keys: any, value: any): Record<string, any> {
    const result: Record<string, any> = {};
    if (!keys || typeof keys !== "object") return result;
    for (const key of Array.isArray(keys) ? keys : Object.values(keys)) {
      result[String(key)] = value;
    }
    return result;
  }

  public static array_intersect(array: any, ...others: any[]): any {
    if (!array || typeof array !== "object") return [];
    const values = others.map((other) => new Set(Object.values(other || {})));
    if (values.length === 0) return Array.isArray(array) ? [...array] : { ...array };
    const result: any = Array.isArray(array) ? [] : {};
    for (const [key, value] of Object.entries(array)) {
      if (values.every((set) => Array.from(set).some((candidate) => candidate == value))) {
        if (Array.isArray(result)) result.push(value);
        else result[key] = value;
      }
    }
    return result;
  }

  public static array_slice(array: any[], offset: number, length?: number): any[] {
    if (!Array.isArray(array)) return [];
    if (length !== undefined) {
      return array.slice(offset, offset + length);
    }
    return array.slice(offset);
  }

  public static array_push(array: any[], ...varargs: any[]): number {
    if (!Array.isArray(array)) return 0;
    array.push(...varargs);
    return array.length;
  }

  public static array_pop(array: any[]): any {
    if (!Array.isArray(array)) return null;
    return array.pop();
  }

  public static array_shift(array: any[]): any {
    if (!Array.isArray(array)) return null;
    return array.shift();
  }

  public static array_unshift(array: any[], ...varargs: any[]): number {
    if (!Array.isArray(array)) return 0;
    array.unshift(...varargs);
    return array.length;
  }

  public static array_unique(array: any): any {
    if (!array || typeof array !== "object") {
      return Array.isArray(array) ? [] : {};
    }
    if (Array.isArray(array)) {
      return Array.from(new Set(array));
    }
    const res: Record<string, any> = {};
    const seen = new Set<any>();
    for (const [k, v] of Object.entries(array)) {
      if (!seen.has(v)) {
        seen.add(v);
        res[k] = v;
      }
    }
    return res;
  }

  public static array_column(array: any[], columnKey: string | number): any[] {
    if (!Array.isArray(array)) return [];
    return array.map((item) => item?.[columnKey]).filter((v) => v !== undefined);
  }

  public static sort(array: any[]): boolean {
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    return true;
  }

  public static rsort(array: any[]): boolean {
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return true;
  }

  public static ksort(array: any, flags = 0): boolean {
    if (!array || typeof array !== "object") return false;
    const entries = Object.entries(array).sort(([left], [right]) => {
      if (flags === 1) return left.localeCompare(right);
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) return leftNumber - rightNumber;
      return left.localeCompare(right);
    });
    for (const key of Object.keys(array)) delete array[key];
    for (const [key, value] of entries) array[key] = value;
    return true;
  }

  public static async array_map(ctx: PHPContext, callback: any, ...arrays: any[]): Promise<any[]> {
    if (!callback) return arrays[0] || [];
    const arr = arrays[0] || [];
    const keys = Array.isArray(arr) ? arr.map((_, i) => i) : Object.keys(arr);
    const res: any[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const args = arrays.map((a) => (Array.isArray(a) ? a[i] : a[key]));
      let mapped: any;
      if (typeof callback === "function") {
        mapped = await callback.apply(ctx, args);
      } else if (typeof callback === "string") {
        mapped = await ctx.callFunction(callback, args);
      } else if (Array.isArray(callback) && callback.length === 2) {
        mapped = await ctx.callMethod(callback[0], callback[1], args);
      } else {
        mapped = args[0];
      }
      res.push(mapped);
    }
    return res;
  }

  public static async array_filter(ctx: PHPContext, array: any, callback?: any, mode = 0): Promise<any> {
    if (!array || typeof array !== "object") return Array.isArray(array) ? [] : {};
    const isArr = Array.isArray(array);
    const result: any = isArr ? [] : {};

    const entries = isArr ? array.map((v: any, i: number) => [i, v]) : Object.entries(array);

    for (const [k, v] of entries) {
      let keep = false;
      if (!callback) {
        keep = Boolean(v);
      } else {
        const args = mode === 1 ? [k] : mode === 2 ? [v, k] : [v];
        if (typeof callback === "function") {
          keep = Boolean(await callback.apply(ctx, args));
        } else if (typeof callback === "string") {
          keep = Boolean(await ctx.callFunction(callback, args));
        } else if (Array.isArray(callback) && callback.length === 2) {
          keep = Boolean(await ctx.callMethod(callback[0], callback[1], args));
        }
      }
      if (keep) {
        if (isArr) (result as any[]).push(v);
        else (result as Record<string, any>)[String(k)] = v;
      }
    }
    return result;
  }

  public static array_key_first(array: any): any | null {
    if (!array || typeof array !== "object") return null;
    if (Array.isArray(array)) return array.length > 0 ? 0 : null;
    const keys = Object.keys(array);
    return keys.length > 0 ? keys[0] : null;
  }

  public static array_key_last(array: any): any | null {
    if (!array || typeof array !== "object") return null;
    if (Array.isArray(array)) return array.length > 0 ? array.length - 1 : null;
    const keys = Object.keys(array);
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }

  public static register(engine: PHPEngine): void {
  const register = engine.registerFunction.bind(engine);
  register("count", (ctx: PHPContext, value: any) => ArrayRuntime.count(value));
  register("sizeof", (ctx: PHPContext, value: any) => ArrayRuntime.count(value));
  register("array_keys", (ctx: PHPContext, value: any) => ArrayRuntime.array_keys(value));
  register("array_values", (ctx: PHPContext, value: any) => ArrayRuntime.array_values(value));
  register("array_flip", (ctx: PHPContext, value: any) => ArrayRuntime.array_flip(value));
  register("array_reverse", (ctx: PHPContext, value: any) => ArrayRuntime.array_reverse(value));
  register("in_array", (ctx: PHPContext, needle: any, haystack: any, strict = false) => ArrayRuntime.in_array(needle, haystack, strict));
  register("array_search", (ctx: PHPContext, needle: any, haystack: any, strict = false) => ArrayRuntime.array_search(needle, haystack, strict));
  register("array_key_exists", (ctx: PHPContext, key: any, value: any) => ArrayRuntime.array_key_exists(key, value));
  register("key_exists", (ctx: PHPContext, key: any, value: any) => ArrayRuntime.array_key_exists(key, value));
  register("array_merge", (ctx: PHPContext, ...values: any[]) => ArrayRuntime.array_merge(...values));
  register("array_combine", (ctx: PHPContext, keys: any[], values: any[]) => ArrayRuntime.array_combine(keys, values));
  register("array_fill_keys", (ctx: PHPContext, keys: any, value: any) => ArrayRuntime.array_fill_keys(keys, value));
  register("array_fill", (ctx: PHPContext, start: number, count: number, value: any) => ArrayRuntime.array_fill(start, count, value));
  register("array_intersect", (ctx: PHPContext, value: any, ...others: any[]) => ArrayRuntime.array_intersect(value, ...others));
  register("array_slice", (ctx: PHPContext, value: any[], offset: number, length?: number) => ArrayRuntime.array_slice(value, offset, length));
  register("array_push", (ctx: PHPContext, value: any[], ...items: any[]) => ArrayRuntime.array_push(value, ...items));
  register("array_pop", (ctx: PHPContext, value: any[]) => ArrayRuntime.array_pop(value));
  register("array_shift", (ctx: PHPContext, value: any[]) => ArrayRuntime.array_shift(value));
  register("array_unshift", (ctx: PHPContext, value: any[], ...items: any[]) => ArrayRuntime.array_unshift(value, ...items));
  register("array_unique", (ctx: PHPContext, value: any) => ArrayRuntime.array_unique(value));
  register("array_column", (ctx: PHPContext, value: any[], column: any) => ArrayRuntime.array_column(value, column));
  register("sort", (ctx: PHPContext, value: any[]) => ArrayRuntime.sort(value));
  register("rsort", (ctx: PHPContext, value: any[]) => ArrayRuntime.rsort(value));
  register("ksort", (ctx: PHPContext, value: any, flags = 0) => ArrayRuntime.ksort(value, flags));
  register("array_map", async (ctx: PHPContext, callback: any, ...values: any[]) => ArrayRuntime.array_map(ctx, callback, ...values));
  register("array_filter", async (ctx: PHPContext, value: any, callback?: any, mode = 0) => ArrayRuntime.array_filter(ctx, value, callback, mode));
  register("array_key_first", (ctx: PHPContext, value: any) => ArrayRuntime.array_key_first(value));
  register("array_key_last", (ctx: PHPContext, value: any) => ArrayRuntime.array_key_last(value));
    }
  }
