import { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";
import { PHPFatalError } from "./PHPError.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable.js";

export class ArrayRuntime {
  public static count(ctx: PHPContext, arrayOrCountableArg?: PHPReference): number {
    const arrayOrCountable = arrayOrCountableArg?.get();
    if (!arrayOrCountable) return 0;
    if (Array.isArray(arrayOrCountable)) {
      const keys = Object.keys(arrayOrCountable);
      if (keys.length === arrayOrCountable.length && keys.every((k, i) => k === String(i))) {
        return arrayOrCountable.length;
      }
      return keys.length;
    }
    if (typeof arrayOrCountable === "object") return Object.keys(arrayOrCountable).length;
    return 1;
  }

  public static array_keys(ctx: PHPContext, inputArg?: PHPReference): any[] {
    const input = inputArg?.get();
    if (!input || typeof input !== "object") return [];
    if (Array.isArray(input)) {
      const keys = Object.keys(input);
      if (keys.length === input.length && keys.every((k, i) => k === String(i))) {
        return input.map((_, i) => i);
      }
      return keys.map((k) => (/^(0|[1-9]\d*)$/.test(k) ? Number(k) : k));
    }
    return Object.keys(input).map((k) => (/^(0|[1-9]\d*)$/.test(k) ? Number(k) : k));
  }

  public static array_values(ctx: PHPContext, inputArg?: PHPReference): any[] {
    const input = inputArg?.get();
    if (!input || typeof input !== "object") return [];
    if (Array.isArray(input)) {
      const keys = Object.keys(input);
      if (keys.length === input.length && keys.every((k, i) => k === String(i))) {
        return [...input];
      }
      return keys.map((k) => (input as any)[k]);
    }
    return Object.values(input);
  }

  public static array_flip(ctx: PHPContext, inputArg?: PHPReference): Record<string, any> {
    const input = inputArg?.get();
    const res: Record<string, any> = {};
    if (!input || typeof input !== "object") return res;
    for (const [k, v] of Object.entries(input)) {
      res[String(v)] = k;
    }
    return res;
  }

  public static array_reverse(ctx: PHPContext, arrayArg?: PHPReference): any[] {
    const array = arrayArg?.get();
    if (!Array.isArray(array)) return [];
    return [...array].reverse();
  }

  public static in_array(ctx: PHPContext, needleArg?: PHPReference, haystackArg?: PHPReference, strictArg?: PHPReference): boolean {
    const needle = needleArg?.get();
    const haystack = haystackArg?.get();
    const strict = Boolean(strictArg?.get());
    if (!haystack) return false;
    const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
    if (strict) {
      return values.includes(needle);
    }
    return values.some((v) => v == needle);
  }

  public static array_search(ctx: PHPContext, needleArg?: PHPReference, haystackArg?: PHPReference, strictArg?: PHPReference): any | false {
    const needle = needleArg?.get();
    const haystack = haystackArg?.get();
    const strict = Boolean(strictArg?.get());
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

  public static array_key_exists(ctx: PHPContext, keyArg?: PHPReference, searchArg?: PHPReference): boolean {
    const key = keyArg?.get();
    const search = searchArg?.get();
    if (!search || typeof search !== "object") return false;
    return key in search;
  }

  public static array_merge(ctx: PHPContext, ...arraysArgs: PHPReference[]): any {
    const arrays = arraysArgs.map((a) => a?.get());
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

  public static array_combine(ctx: PHPContext, keysArg?: PHPReference, valuesArg?: PHPReference): Record<string, any> | false {
    const keys = keysArg?.get();
    const values = valuesArg?.get();
    if (!Array.isArray(keys) || !Array.isArray(values) || keys.length !== values.length) {
      return false;
    }
    const res: Record<string, any> = {};
    keys.forEach((k, i) => {
      res[String(k)] = values[i];
    });
    return res;
  }

  public static array_fill(ctx: PHPContext, startIndexArg?: PHPReference, countArg?: PHPReference, valueArg?: PHPReference): any[] | Record<string, any> {
    const startIndex = Number(startIndexArg?.get()) || 0;
    const count = Number(countArg?.get()) || 0;
    const value = valueArg?.get();
    if (count < 0) throw new PHPFatalError("array_fill(): Argument #2 ($count) must be greater than or equal to 0");
    if (count === 0 || startIndex === 0) return Array.from({ length: count }, () => value);
    const result: Record<string, any> = {};
    for (let offset = 0; offset < count; offset++) result[startIndex + offset] = value;
    return result;
  }

  public static array_fill_keys(ctx: PHPContext, keysArg?: PHPReference, valueArg?: PHPReference): Record<string, any> {
    const keys = keysArg?.get();
    const value = valueArg?.get();
    const result: Record<string, any> = {};
    if (!keys || typeof keys !== "object") return result;
    for (const key of Array.isArray(keys) ? keys : Object.values(keys)) {
      result[String(key)] = value;
    }
    return result;
  }

  public static array_intersect(ctx: PHPContext, arrayArg?: PHPReference, ...othersArgs: PHPReference[]): any {
    const array = arrayArg?.get();
    const others = othersArgs.map((a) => a?.get());
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

  public static array_diff(ctx: PHPContext, arrayArg?: PHPReference, ...othersArgs: PHPReference[]): any {
    const array = arrayArg?.get();
    const others = othersArgs.map((a) => a?.get());
    if (!array || typeof array !== "object") return Array.isArray(array) ? [] : {};
    const values = others.map((other) => {
      const vals = Array.isArray(other)
        ? other
        : (typeof other === "object" && other !== null)
        ? Object.values(other)
        : [other];
      return new Set(vals.map(String));
    });
    const isArr = Array.isArray(array);
    const result: any = isArr ? [] : {};
    for (const [key, value] of Object.entries(array)) {
      if (!values.some((set) => set.has(String(value)))) {
        if (isArr) (result as any[]).push(value);
        else (result as Record<string, any>)[key] = value;
      }
    }
    return result;
  }

  public static array_intersect_key(ctx: PHPContext, arrayArg?: PHPReference, ...othersArgs: PHPReference[]): any {
    const array = arrayArg?.get();
    const others = othersArgs.map((a) => a?.get());
    if (!array || typeof array !== "object") return Array.isArray(array) ? [] : {};
    const keySets = others.map((other) => new Set(Object.keys(other || {}).map(String)));
    const isArr = Array.isArray(array);
    const result: any = isArr ? [] : {};
    for (const [k, v] of Object.entries(array)) {
      if (keySets.every((set) => set.has(String(k)))) {
        if (isArr) (result as any[]).push(v);
        else (result as Record<string, any>)[String(k)] = v;
      }
    }
    return result;
  }

  public static array_diff_key(ctx: PHPContext, arrayArg?: PHPReference, ...othersArgs: PHPReference[]): any {
    const array = arrayArg?.get();
    const others = othersArgs.map((a) => a?.get());
    if (!array || typeof array !== "object") return Array.isArray(array) ? [] : {};
    const keySets = others.map((other) => new Set(Object.keys(other || {}).map(String)));
    const isArr = Array.isArray(array);
    const result: any = isArr ? [] : {};
    for (const [k, v] of Object.entries(array)) {
      if (!keySets.some((set) => set.has(String(k)))) {
        if (isArr) (result as any[]).push(v);
        else (result as Record<string, any>)[String(k)] = v;
      }
    }
    return result;
  }

  public static array_slice(ctx: PHPContext, arrayArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): any[] {
    const array = arrayArg?.get();
    const offset = Number(offsetArg?.get()) || 0;
    const length = lengthArg?.get() !== undefined ? Number(lengthArg.get()) : undefined;
    if (!Array.isArray(array)) return [];
    if (length !== undefined) {
      return array.slice(offset, offset + length);
    }
    return array.slice(offset);
  }

  public static array_change_key_case(ctx: PHPContext, arrayArg?: PHPReference, caseArg?: PHPReference): Record<string, any> | null {
    const array = arrayArg?.get();
    if (!array || typeof array !== "object") return null;
    const toUpper = Number(caseArg?.get()) === 1;
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(array)) {
      const newKey = toUpper ? String(k).toUpperCase() : String(k).toLowerCase();
      res[newKey] = v;
    }
    return res;
  }

  public static async usort(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: PHPReference): Promise<boolean> {
    const array = arrayArg?.get();
    const callback = callbackArg?.get();
    if (!array || typeof array !== "object") return false;
    const isArr = Array.isArray(array);
    const entries = isArr
      ? array.map((v, i) => ({ key: i, val: v }))
      : Object.entries(array).map(([k, v]) => ({ key: k, val: v }));

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        let cmp = 0;
        if (typeof callback === "function") {
          cmp = Number(await callback(ctx, entries[i].val, entries[j].val)) || 0;
        } else if (typeof callback === "string") {
          const fn = ctx.functions[callback.toLowerCase()] || ctx.functionMissing(callback);
          cmp = Number(await fn(ctx, entries[i].val, entries[j].val)) || 0;
        } else if (Array.isArray(callback) && callback.length === 2) {
          const obj = callback[0] && typeof callback[0] === "object" && typeof callback[0].get === "function" ? callback[0].get() : callback[0];
          const m = String(callback[1] && typeof callback[1] === "object" && typeof callback[1].get === "function" ? callback[1].get() : callback[1]).toLowerCase();
          cmp = Number(await obj[m](ctx, entries[i].val, entries[j].val)) || 0;
        }
        if (cmp > 0) {
          const temp = entries[i];
          entries[i] = entries[j];
          entries[j] = temp;
        }
      }
    }

    if (isArr) {
      array.length = 0;
      entries.forEach((e) => array.push(e.val));
    } else {
      for (const k of Object.keys(array)) delete array[k];
      entries.forEach((e, idx) => { array[idx] = e.val; });
    }
    if (arrayArg && typeof arrayArg.set === "function") {
      arrayArg.set(array);
    }
    return true;
  }

  public static async uasort(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: PHPReference): Promise<boolean> {
    const array = arrayArg?.get();
    const callback = callbackArg?.get();
    if (!array || typeof array !== "object") return false;
    const entries = Object.entries(array).map(([k, v]) => ({ key: k, val: v }));

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        let cmp = 0;
        if (typeof callback === "function") {
          cmp = Number(await callback(ctx, entries[i].val, entries[j].val)) || 0;
        } else if (typeof callback === "string") {
          const fn = ctx.functions[callback.toLowerCase()] || ctx.functionMissing(callback);
          cmp = Number(await fn(ctx, entries[i].val, entries[j].val)) || 0;
        } else if (Array.isArray(callback) && callback.length === 2) {
          const obj = callback[0] && typeof callback[0] === "object" && typeof callback[0].get === "function" ? callback[0].get() : callback[0];
          const m = String(callback[1] && typeof callback[1] === "object" && typeof callback[1].get === "function" ? callback[1].get() : callback[1]).toLowerCase();
          cmp = Number(await obj[m](ctx, entries[i].val, entries[j].val)) || 0;
        }
        if (cmp > 0) {
          const temp = entries[i];
          entries[i] = entries[j];
          entries[j] = temp;
        }
      }
    }

    if (Array.isArray(array)) {
      array.length = 0;
      entries.forEach((e) => { (array as any)[e.key] = e.val; });
    } else {
      for (const k of Object.keys(array)) delete array[k];
      entries.forEach((e) => { array[e.key] = e.val; });
    }
    if (arrayArg && typeof arrayArg.set === "function") {
      arrayArg.set(array);
    }
    return true;
  }

  public static async uksort(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: PHPReference): Promise<boolean> {
    const array = arrayArg?.get();
    const callback = callbackArg?.get();
    if (!array || typeof array !== "object") return false;
    const entries = Object.entries(array).map(([k, v]) => ({ key: k, val: v }));

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        let cmp = 0;
        if (typeof callback === "function") {
          cmp = Number(await callback(ctx, entries[i].key, entries[j].key)) || 0;
        } else if (typeof callback === "string") {
          const fn = ctx.functions[callback.toLowerCase()] || ctx.functionMissing(callback);
          cmp = Number(await fn(ctx, entries[i].key, entries[j].key)) || 0;
        } else if (Array.isArray(callback) && callback.length === 2) {
          const obj = callback[0] && typeof callback[0] === "object" && typeof callback[0].get === "function" ? callback[0].get() : callback[0];
          const m = String(callback[1] && typeof callback[1] === "object" && typeof callback[1].get === "function" ? callback[1].get() : callback[1]).toLowerCase();
          cmp = Number(await obj[m](ctx, entries[i].key, entries[j].key)) || 0;
        }
        if (cmp > 0) {
          const temp = entries[i];
          entries[i] = entries[j];
          entries[j] = temp;
        }
      }
    }

    if (Array.isArray(array)) {
      array.length = 0;
      entries.forEach((e) => { (array as any)[e.key] = e.val; });
    } else {
      for (const k of Object.keys(array)) delete array[k];
      entries.forEach((e) => { array[e.key] = e.val; });
    }
    if (arrayArg && typeof arrayArg.set === "function") {
      arrayArg.set(array);
    }
    return true;
  }

  public static array_push(ctx: PHPContext, arrayArg?: PHPReference, ...varargsArgs: PHPReference[]): number {
    const array = arrayArg?.get();
    const varargs = varargsArgs.map((a) => a?.get());
    if (!Array.isArray(array)) return 0;
    array.push(...varargs);
    return array.length;
  }

  public static array_pop(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    if (!Array.isArray(array)) return null;
    return array.pop();
  }

  public static array_shift(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    if (!Array.isArray(array)) return null;
    return array.shift();
  }

  public static array_unshift(ctx: PHPContext, arrayArg?: PHPReference, ...varargsArgs: PHPReference[]): number {
    const array = arrayArg?.get();
    const varargs = varargsArgs.map((a) => a?.get());
    if (!Array.isArray(array)) return 0;
    array.unshift(...varargs);
    return array.length;
  }

  public static array_unique(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
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

  public static array_column(ctx: PHPContext, arrayArg?: PHPReference, columnKeyArg?: PHPReference): any[] {
    const array = arrayArg?.get();
    const columnKey = columnKeyArg?.get();
    if (!Array.isArray(array)) return [];
    return array.map((item) => item?.[columnKey]).filter((v) => v !== undefined);
  }

  public static sort(ctx: PHPContext, arrayArg?: PHPReference): boolean {
    const array = arrayArg?.get();
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    return true;
  }

  public static rsort(ctx: PHPContext, arrayArg?: PHPReference): boolean {
    const array = arrayArg?.get();
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return true;
  }

  public static ksort(ctx: PHPContext, arrayArg?: PHPReference, flagsArg?: PHPReference): boolean {
    const array = arrayArg?.get();
    const flags = Number(flagsArg?.get()) || 0;
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

  public static async array_map(ctx: PHPContext, callbackArg?: PHPReference, ...arraysArgs: PHPReference[]): Promise<any> {
    const callback = callbackArg?.get();
    const arrays = arraysArgs.map((a) => a?.get());
    if (!callback) return arrays[0] || [];
    const arr = arrays[0] || [];
    const isArr = Array.isArray(arr);
    const keys = isArr ? arr.map((_, i) => i) : Object.keys(arr);
    const res: any = isArr ? [] : {};

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const args = arrays.map((a) => (Array.isArray(a) ? a[i] : a[key]));
      const wrapArgs = args.map((a) => (a && typeof a === "object" && typeof (a as any).get === "function" ? a : new PHPLiteral(a)));
      let mapped: any;
      if (typeof callback === "function") {
        mapped = await callback.apply(ctx, [ctx, ...wrapArgs]);
      } else if (typeof callback === "string") {
        const fn = ctx.functions[callback.toLowerCase()] || ctx.functionMissing(callback);
        mapped = await fn(ctx, ...wrapArgs);
      } else if (Array.isArray(callback) && callback.length === 2) {
        const obj = callback[0] && typeof callback[0] === "object" && typeof callback[0].get === "function" ? callback[0].get() : callback[0];
        const m = String(callback[1] && typeof callback[1] === "object" && typeof callback[1].get === "function" ? callback[1].get() : callback[1]).toLowerCase();
        mapped = await obj[m](ctx, ...wrapArgs);
      } else {
        mapped = args[0];
      }
      if (isArr) {
        (res as any[]).push(mapped);
      } else {
        (res as Record<string, any>)[String(key)] = mapped;
      }
    }
    return res;
  }

  public static async array_filter(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: PHPReference, modeArg?: PHPReference): Promise<any> {
    const array = arrayArg?.get();
    const callback = callbackArg?.get();
    const mode = Number(modeArg?.get()) || 0;
    if (!array || typeof array !== "object") return Array.isArray(array) ? [] : {};
    const isArr = Array.isArray(array);
    const result: any = isArr ? [] : {};

    const entries = isArr ? array.map((v: any, i: number) => [i, v]) : Object.entries(array);

    for (const [k, v] of entries) {
      let keep = false;
      if (!callback) {
        keep = Boolean(v);
      } else {
        const args = mode === 1 ? [new PHPLiteral(k)] : mode === 2 ? [new PHPLiteral(v), new PHPLiteral(k)] : [new PHPLiteral(v)];
        if (typeof callback === "function") {
          keep = Boolean(await callback.apply(ctx, [ctx, ...args]));
        } else if (typeof callback === "string") {
          const fn = ctx.functions[callback.toLowerCase()] || ctx.functionMissing(callback);
          keep = Boolean(await fn(ctx, ...args));
        } else if (Array.isArray(callback) && callback.length === 2) {
          const obj = callback[0] && typeof callback[0] === "object" && typeof callback[0].get === "function" ? callback[0].get() : callback[0];
          const m = String(callback[1] && typeof callback[1] === "object" && typeof callback[1].get === "function" ? callback[1].get() : callback[1]).toLowerCase();
          keep = Boolean(await obj[m](ctx, ...args));
        }
      }
      if (keep) {
        if (isArr) (result as any[]).push(v);
        else (result as Record<string, any>)[String(k)] = v;
      }
    }
    return result;
  }

  public static array_key_first(ctx: PHPContext, arrayArg?: PHPReference): any | null {
    const array = arrayArg?.get();
    if (!array || typeof array !== "object") return null;
    if (Array.isArray(array)) return array.length > 0 ? 0 : null;
    const keys = Object.keys(array);
    return keys.length > 0 ? keys[0] : null;
  }

  public static array_key_last(ctx: PHPContext, arrayArg?: PHPReference): any | null {
    const array = arrayArg?.get();
    if (!array || typeof array !== "object") return null;
    if (Array.isArray(array)) return array.length > 0 ? array.length - 1 : null;
    const keys = Object.keys(array);
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }

  private static getEntries(array: any): [any, any][] {
    if (!array || (typeof array !== "object" && typeof array !== "function")) return [];
    return Object.entries(array).map(([k, v]) => [(!isNaN(Number(k)) && String(Number(k)) === String(k)) ? Number(k) : k, v]);
  }

  public static reset(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    if (typeof array === "object" && array !== null) Object.defineProperty(array, "__ptr", { value: 0, writable: true, configurable: true, enumerable: false });
    return entries[0][1];
  }

  public static current(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const ptr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    if (ptr < 0 || ptr >= entries.length) return false;
    return entries[ptr][1];
  }

  public static next(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    const nextPtr = currentPtr + 1;
    if (array && typeof array === "object") Object.defineProperty(array, "__ptr", { value: nextPtr, writable: true, configurable: true, enumerable: false });
    if (nextPtr >= entries.length) return false;
    return entries[nextPtr][1];
  }

  public static prev(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    const prevPtr = currentPtr - 1;
    if (array && typeof array === "object") Object.defineProperty(array, "__ptr", { value: prevPtr, writable: true, configurable: true, enumerable: false });
    if (prevPtr < 0 || prevPtr >= entries.length) return false;
    return entries[prevPtr][1];
  }

  public static end(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const lastPtr = entries.length - 1;
    if (array && typeof array === "object") Object.defineProperty(array, "__ptr", { value: lastPtr, writable: true, configurable: true, enumerable: false });
    return entries[lastPtr][1];
  }

  public static key(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return null;
    const ptr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    if (ptr < 0 || ptr >= entries.length) return null;
    return entries[ptr][0];
  }

  public static each(ctx: PHPContext, arrayArg?: PHPReference): any {
    const array = arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    if (currentPtr < 0 || currentPtr >= entries.length) return false;
    const [k, v] = entries[currentPtr];
    if (array && typeof array === "object") Object.defineProperty(array, "__ptr", { value: currentPtr + 1, writable: true, configurable: true, enumerable: false });
    return { 1: v, value: v, 0: k, key: k };
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
    "array_diff": ArrayRuntime.array_diff,
    "array_intersect_key": ArrayRuntime.array_intersect_key,
    "array_diff_key": ArrayRuntime.array_diff_key,
    "usort": ArrayRuntime.usort,
    "uasort": ArrayRuntime.uasort,
    "uksort": ArrayRuntime.uksort,
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
    "array_change_key_case": ArrayRuntime.array_change_key_case,
    "array_key_last": ArrayRuntime.array_key_last,
    "current": ArrayRuntime.current,
    "pos": ArrayRuntime.current,
    "reset": ArrayRuntime.reset,
    "end": ArrayRuntime.end,
    "key": ArrayRuntime.key,
    "next": ArrayRuntime.next,
    "prev": ArrayRuntime.prev,
    "each": ArrayRuntime.each,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(ArrayRuntime.functions);
  }
}
