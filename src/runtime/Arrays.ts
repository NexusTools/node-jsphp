import { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";
import { PHPFatalError } from "./PHPError";

export class ArrayRuntime {
  public static count(ctx: PHPContext, arrayOrCountable: any): number {
    if (!arrayOrCountable) return 0;
    if (Array.isArray(arrayOrCountable)) return arrayOrCountable.length;
    if (typeof arrayOrCountable === "object") return Object.keys(arrayOrCountable).length;
    return 1;
  }

  public static array_keys(ctx: PHPContext, input: any): any[] {
    if (!input || typeof input !== "object") return [];
    if (Array.isArray(input)) return input.map((_, i) => i);
    return Object.keys(input);
  }

  public static array_values(ctx: PHPContext, input: any): any[] {
    if (!input || typeof input !== "object") return [];
    if (Array.isArray(input)) return [...input];
    return Object.values(input);
  }

  public static array_flip(ctx: PHPContext, input: any): Record<string, any> {
    const res: Record<string, any> = {};
    if (!input || typeof input !== "object") return res;
    for (const [k, v] of Object.entries(input)) {
      res[String(v)] = k;
    }
    return res;
  }

  public static array_reverse(ctx: PHPContext, array: any[]): any[] {
    if (!Array.isArray(array)) return [];
    return [...array].reverse();
  }

  public static in_array(ctx: PHPContext, needle: any, haystack: any, strict = false): boolean {
    if (!haystack) return false;
    const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
    if (strict) {
      return values.includes(needle);
    }
    return values.some((v) => v == needle);
  }

  public static array_search(ctx: PHPContext, needle: any, haystack: any, strict = false): any | false {
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

  public static array_key_exists(ctx: PHPContext, key: any, search: any): boolean {
    if (!search || typeof search !== "object") return false;
    return key in search;
  }

  public static array_merge(ctx: PHPContext, ...arrays: any[]): any {
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

  public static array_combine(ctx: PHPContext, keys: any[], values: any[]): Record<string, any> | false {
    if (!Array.isArray(keys) || !Array.isArray(values) || keys.length !== values.length) {
      return false;
    }
    const res: Record<string, any> = {};
    keys.forEach((k, i) => {
      res[String(k)] = values[i];
    });
    return res;
  }

  public static array_fill(ctx: PHPContext, startIndex: number, count: number, value: any): any[] | Record<string, any> {
    if (count < 0) throw new PHPFatalError("array_fill(): Argument #2 ($count) must be greater than or equal to 0");
    if (count === 0 || startIndex === 0) return Array.from({ length: count }, () => value);
    const result: Record<string, any> = {};
    for (let offset = 0; offset < count; offset++) result[startIndex + offset] = value;
    return result;
  }

  public static array_fill_keys(ctx: PHPContext, keys: any, value: any): Record<string, any> {
    const result: Record<string, any> = {};
    if (!keys || typeof keys !== "object") return result;
    for (const key of Array.isArray(keys) ? keys : Object.values(keys)) {
      result[String(key)] = value;
    }
    return result;
  }

  public static array_intersect(ctx: PHPContext, array: any, ...others: any[]): any {
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

  public static array_slice(ctx: PHPContext, array: any[], offset: number, length?: number): any[] {
    if (!Array.isArray(array)) return [];
    if (length !== undefined) {
      return array.slice(offset, offset + length);
    }
    return array.slice(offset);
  }

  public static array_push(ctx: PHPContext, array: any[], ...varargs: any[]): number {
    if (!Array.isArray(array)) return 0;
    array.push(...varargs);
    return array.length;
  }

  public static array_pop(ctx: PHPContext, array: any[]): any {
    if (!Array.isArray(array)) return null;
    return array.pop();
  }

  public static array_shift(ctx: PHPContext, array: any[]): any {
    if (!Array.isArray(array)) return null;
    return array.shift();
  }

  public static array_unshift(ctx: PHPContext, array: any[], ...varargs: any[]): number {
    if (!Array.isArray(array)) return 0;
    array.unshift(...varargs);
    return array.length;
  }

  public static array_unique(ctx: PHPContext, array: any): any {
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

  public static array_column(ctx: PHPContext, array: any[], columnKey: string | number): any[] {
    if (!Array.isArray(array)) return [];
    return array.map((item) => item?.[columnKey]).filter((v) => v !== undefined);
  }

  public static sort(ctx: PHPContext, array: any[]): boolean {
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    return true;
  }

  public static rsort(ctx: PHPContext, array: any[]): boolean {
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return true;
  }

  public static ksort(ctx: PHPContext, array: any, flags = 0): boolean {
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

  public static array_key_first(ctx: PHPContext, array: any): any | null {
    if (!array || typeof array !== "object") return null;
    if (Array.isArray(array)) return array.length > 0 ? 0 : null;
    const keys = Object.keys(array);
    return keys.length > 0 ? keys[0] : null;
  }

  public static array_key_last(ctx: PHPContext, array: any): any | null {
    if (!array || typeof array !== "object") return null;
    if (Array.isArray(array)) return array.length > 0 ? array.length - 1 : null;
    const keys = Object.keys(array);
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }

  static functions = {
    "count": ArrayRuntime.count,
    "sizeof": ArrayRuntime.count,
    "array_keys": ArrayRuntime.array_keys,
    "array_values": ArrayRuntime.array_values,
    "array_flip": ArrayRuntime.array_flip,
    "array_reverse": ArrayRuntime.array_reverse,
    "in_array": ArrayRuntime.in_array,
    "array_search": ArrayRuntime.array_search,
    "array_key_exists": ArrayRuntime.array_key_exists,
    "key_exists": ArrayRuntime.array_key_exists,
    "array_merge": ArrayRuntime.array_merge,
    "array_combine": ArrayRuntime.array_combine,
    "array_fill_keys": ArrayRuntime.array_fill_keys,
    "array_fill": ArrayRuntime.array_fill,
    "array_intersect": ArrayRuntime.array_intersect,
    "array_slice": ArrayRuntime.array_slice,
    "array_push": ArrayRuntime.array_push,
    "array_pop": ArrayRuntime.array_pop,
    "array_shift": ArrayRuntime.array_shift,
    "array_unshift": ArrayRuntime.array_unshift,
    "array_unique": ArrayRuntime.array_unique,
    "array_column": ArrayRuntime.array_column,
    "sort": ArrayRuntime.sort,
    "rsort": ArrayRuntime.rsort,
    "ksort": ArrayRuntime.ksort,
    "array_map": ArrayRuntime.array_map,
    "array_filter": ArrayRuntime.array_filter,
    "array_key_first": ArrayRuntime.array_key_first,
    "array_key_last": ArrayRuntime.array_key_last,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(ArrayRuntime.functions);
  }
}
