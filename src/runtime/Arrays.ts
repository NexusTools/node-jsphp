import { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";
import { PHPFatalError, PHPValueError } from "./PHPError.js";
import { PHPVariable, PHPLiteral, PHPReference, PHPArrayOffsetReference } from "./PHPVariable.js";
import { CoreRuntime } from "./CoreRuntime.js";
import { isPlainObject } from "./Variables.js";
import { encodePhpIdentifier, normalizePhpRegistryName } from "./Reflection.js";

async function unwrap(arg: any): Promise<any> {
  return arg instanceof PHPReference ? await arg.get() : arg;
}

function isPureSequentialArray(arr: any): boolean {
  if (!Array.isArray(arr)) return false;
  const keys = Object.keys(arr);
  if (keys.length !== arr.length) return false;
  for (let i = 0; i < arr.length; i++) {
    if (keys[i] !== String(i)) return false;
  }
  return true;
}

export class ArrayRuntime {
  public static async count(ctx: PHPContext, arrayOrCountableArg?: any): Promise<number>{
    const arrayOrCountable = await unwrap(arrayOrCountableArg);
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

  public static async array_keys(ctx: PHPContext, inputArg?: any): Promise<any[]>{
    const input = await unwrap(inputArg);
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

  public static async array_values(ctx: PHPContext, inputArg?: any): Promise<any[]>{
    const input = await unwrap(inputArg);
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

  public static async array_flip(ctx: PHPContext, inputArg?: any): Promise<Record<string, any>>{
    const input = await unwrap(inputArg);
    const res: Record<string, any> = {};
    if (!input || typeof input !== "object") return res;
    for (const [k, v] of Object.entries(input)) {
      res[String(v)] = k;
    }
    return res;
  }

  public static async array_reverse(ctx: PHPContext, arrayArg?: any): Promise<any[]>{
    const array = await unwrap(arrayArg);
    if (!Array.isArray(array)) return [];
    return [...array].reverse();
  }

  public static async in_array(ctx: PHPContext, needleArg?: any, haystackArg?: any, strictArg?: any): Promise<boolean>{
    const needle = await unwrap(needleArg);
    const haystack = await unwrap(haystackArg);
    const strict = Boolean(await unwrap(strictArg));
    if (!haystack) return false;
    const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
    if (strict) {
      return values.includes(needle);
    }
    return values.some((v) => v == needle);
  }

  public static async array_search(ctx: PHPContext, needleArg?: any, haystackArg?: any, strictArg?: any): Promise<any | false>{
    const needle = await unwrap(needleArg);
    const haystack = await unwrap(haystackArg);
    const strict = Boolean(await unwrap(strictArg));
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

  public static async array_key_exists(ctx: PHPContext, keyArg?: any, searchArg?: any): Promise<boolean>{
    const key = await unwrap(keyArg);
    const search = await unwrap(searchArg);
    if (!search || typeof search !== "object") return false;
    return key in search;
  }

  public static async array_merge(ctx: PHPContext, ...arraysArgs: any[]): Promise<any>{
    const arrays = await Promise.all(arraysArgs.map(unwrap));
    let allPure = true;
    for (const arr of arrays) {
      if (!isPureSequentialArray(arr)) {
        allPure = false;
        break;
      }
    }
    if (allPure) {
      return ([] as any[]).concat(...arrays);
    }

    const resultArr: any[] = [];
    const resultObj: Record<string, any> = {};
    let isResultArr = true;

    for (const arr of arrays) {
      if (!arr || typeof arr !== "object") continue;
      if (isPureSequentialArray(arr)) {
        if (isResultArr) {
          for (const item of arr) {
            resultArr.push(item);
          }
        } else {
          for (const item of arr) {
            resultObj[resultArr.length] = item;
            resultArr.push(item);
          }
        }
      } else {
        isResultArr = false;
        for (const [k, v] of Object.entries(arr)) {
          if (/^(0|[1-9]\d*)$/.test(k)) {
            resultObj[resultArr.length] = v;
            resultArr.push(v);
          } else {
            resultObj[k] = v;
          }
        }
      }
    }
    return isResultArr ? resultArr : resultObj;
  }

  public static async array_combine(ctx: PHPContext, keysArg?: any, valuesArg?: any): Promise<Record<string, any> | false>{
    const keys = await unwrap(keysArg);
    const values = await unwrap(valuesArg);
    if (!Array.isArray(keys) || !Array.isArray(values) || keys.length !== values.length) {
      return false;
    }
    const res: Record<string, any> = {};
    keys.forEach((k, i) => {
      res[String(k)] = values[i];
    });
    return res;
  }

  public static async array_fill(ctx: PHPContext, startIndexArg?: PHPReference, countArg?: PHPReference, valueArg?: PHPReference): Promise<any[] | Record<string, any>>{
    const startIndex = Math.floor(Number(await startIndexArg?.get()) || 0);
    const rawCount = Number(await countArg?.get());
    const count = Number.isNaN(rawCount) ? 0 : Math.floor(rawCount);
    const value = await valueArg?.get();
    if (count < 0) throw new PHPValueError("array_fill(): Argument #2 ($count) must be greater than or equal to 0");
    if (count === 0) return [];
    if (startIndex === 0) {
      const arr: any[] = [];
      for (let i = 0; i < count; i++) arr.push(value);
      return arr;
    }
    const result: Record<string, any> = {};
    for (let offset = 0; offset < count; offset++) result[startIndex + offset] = value;
    return result;
  }

  public static async array_fill_keys(ctx: PHPContext, keysArg?: PHPReference, valueArg?: PHPReference): Promise<Record<string, any>>{
    const keys = await keysArg?.get();
    const value = await valueArg?.get();
    const result: Record<string, any> = {};
    if (!keys || typeof keys !== "object") return result;
    for (const key of Array.isArray(keys) ? keys : Object.values(keys)) {
      result[String(key)] = value;
    }
    return result;
  }

  public static async array_intersect(ctx: PHPContext, arrayArg?: PHPReference, ...othersArgs: PHPReference[]): Promise<any>{
    const array = await arrayArg?.get();
    const others = await Promise.all(othersArgs.map((arg) => arg?.get()));
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

  public static async array_diff(ctx: PHPContext, arrayArg?: PHPReference, ...othersArgs: PHPReference[]): Promise<any>{
    const array = await arrayArg?.get();
    const others = await Promise.all(othersArgs.map((arg) => arg?.get()));
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

  public static async array_intersect_key(ctx: PHPContext, arrayArg?: PHPReference, ...othersArgs: PHPReference[]): Promise<any>{
    const array = await arrayArg?.get();
    const others = await Promise.all(othersArgs.map((arg) => arg?.get()));
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

  public static async array_diff_key(ctx: PHPContext, arrayArg?: PHPReference, ...othersArgs: PHPReference[]): Promise<any>{
    const array = await arrayArg?.get();
    const others = await Promise.all(othersArgs.map((arg) => arg?.get()));
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

  public static async array_slice(ctx: PHPContext, arrayArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference, preserveKeysArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
    let offset = Number(await offsetArg?.get()) || 0;
    const lengthValue = await lengthArg?.get();
    const length = lengthValue !== undefined ? Number(lengthValue) : undefined;
    const preserveKeys = Boolean(await preserveKeysArg?.get());
    if (!array || typeof array !== "object") return Array.isArray(array) ? [] : {};
    const keys = Object.keys(array);
    const total = keys.length;
    let start = offset < 0 ? Math.max(0, total + offset) : offset;
    let end = total;
    if (length !== undefined) {
      if (length < 0) end = Math.max(start, total + length);
      else end = Math.min(total, start + length);
    }
    const slicedKeys = keys.slice(start, end);
    if (Array.isArray(array) && !preserveKeys) {
      return slicedKeys.map((k) => (array as any)[k]);
    }
    const res: Record<string, any> = {};
    for (const k of slicedKeys) {
      res[k] = (array as any)[k];
    }
    return res;
  }

  public static async array_change_key_case(ctx: PHPContext, arrayArg?: PHPReference, caseArg?: PHPReference): Promise<Record<string, any> | null>{
    const array = await arrayArg?.get();
    if (!array || typeof array !== "object") return null;
    const toUpper = Number(await caseArg?.get()) === 1;
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(array)) {
      const newKey = toUpper ? String(k).toUpperCase() : String(k).toLowerCase();
      res[newKey] = v;
    }
    return res;
  }

  public static async usort(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: PHPReference): Promise<boolean> {
    const array = await arrayArg?.get();
    const callback = await callbackArg?.get();
    if (!array || typeof array !== "object") return false;
    const isArr = Array.isArray(array);
    const entries = isArr
      ? array.map((v, i) => ({ key: i, val: v }))
      : Object.entries(array).map(([k, v]) => ({ key: k, val: v }));

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const cmp = Number(await CoreRuntime.functions.call_user_func(ctx, new PHPLiteral(callback), new PHPLiteral(entries[i].val), new PHPLiteral(entries[j].val))) || 0;
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
      await arrayArg.set(array);
    }
    return true;
  }

  public static async uasort(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: PHPReference): Promise<boolean> {
    const array = await arrayArg?.get();
    const callback = await callbackArg?.get();
    if (!array || typeof array !== "object") return false;
    const entries = Object.entries(array).map(([k, v]) => ({ key: k, val: v }));

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const cmp = Number(await CoreRuntime.functions.call_user_func(ctx, new PHPLiteral(callback), new PHPLiteral(entries[i].val), new PHPLiteral(entries[j].val))) || 0;
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
      await arrayArg.set(array);
    }
    return true;
  }

  public static async uksort(ctx: PHPContext, arrayArg?: any, callbackArg?: any): Promise<boolean> {
    let array = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    while (array instanceof PHPReference) array = await array.get();
    let callback = callbackArg?.get !== undefined ? await callbackArg.get() : callbackArg;
    while (callback instanceof PHPReference) callback = await callback.get();

    if (!array || typeof array !== "object") return false;
    const entries = Object.entries(array).map(([k, v]) => ({ key: k, val: v }));

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const rawCmp = await CoreRuntime.functions.call_user_func(ctx, new PHPLiteral(callback), new PHPLiteral(entries[i].key), new PHPLiteral(entries[j].key));
        const cmp = Number(rawCmp?.get ? await rawCmp.get() : rawCmp) || 0;
        if (cmp > 0) {
          const temp = entries[i];
          entries[i] = entries[j];
          entries[j] = temp;
        }
      }
    }

    if (Array.isArray(array)) {
      for (const k of Object.keys(array)) delete (array as any)[k];
      entries.forEach((e) => { (array as any)[e.key] = e.val; });
    } else {
      for (const k of Object.keys(array)) delete array[k];
      entries.forEach((e) => { array[e.key] = e.val; });
    }
    return true;
  }

  public static async array_push(ctx: PHPContext, arrayArg?: any, ...varargsArgs: any[]): Promise<number>{
    let array = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    while (array instanceof PHPReference) array = await array.get();
    const varargs = await Promise.all(varargsArgs.map(async (a) => {
      let unwrap = a && typeof a === "object" && typeof a.get === "function" ? await a.get() : a;
      while (unwrap instanceof PHPReference) unwrap = await unwrap.get();
      return unwrap;
    }));
    if (!Array.isArray(array)) return 0;
    for (const item of varargs) {
      array.push(item);
    }
    return array.length;
  }

  public static async array_pop(ctx: PHPContext, arrayArg?: any): Promise<any>{
    let array = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    while (array instanceof PHPReference) array = await array.get();
    if (Array.isArray(array)) return array.pop();
    if (!isPlainObject(array)) return null;
    const keys = Object.keys(array);
    if (keys.length === 0) return null;
    const lastKey = keys[keys.length - 1];
    const value = array[lastKey];
    delete array[lastKey];
    return value;
  }

  public static async array_shift(ctx: PHPContext, arrayArg?: any): Promise<any>{
    let array = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    while (array instanceof PHPReference) array = await array.get();
    if (Array.isArray(array)) return array.shift();
    if (!isPlainObject(array)) return null;
    const keys = Object.keys(array);
    if (keys.length === 0) return null;
    const firstKey = keys[0];
    const value = array[firstKey];
    delete array[firstKey];
    let nextNumericKey = 0;
    for (const key of keys.slice(1)) {
      if (/^(0|[1-9]\d*)$/.test(key)) {
        const entry = array[key];
        delete array[key];
        array[nextNumericKey++] = entry;
      }
    }
    return value;
  }

  public static async array_unshift(ctx: PHPContext, arrayArg?: any, ...varargsArgs: any[]): Promise<number>{
    let array = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    while (array instanceof PHPReference) array = await array.get();
    const varargs = await Promise.all(varargsArgs.map(async (a) => {
      let unwrap = a && typeof a === "object" && typeof a.get === "function" ? await a.get() : a;
      while (unwrap instanceof PHPReference) unwrap = await unwrap.get();
      return unwrap;
    }));
    if (!Array.isArray(array)) return 0;
    array.unshift(...varargs);
    return array.length;
  }

  public static async array_unique(ctx: PHPContext, arrayArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
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

  public static async array_column(ctx: PHPContext, arrayArg?: PHPReference, columnKeyArg?: PHPReference): Promise<any[]> {
    const array = await arrayArg?.get();
    const columnKey = await columnKeyArg?.get();
    if (!Array.isArray(array)) return [];
    return array.map((item) => item?.[columnKey]).filter((v) => v !== undefined);
  }

  public static async sort(ctx: PHPContext, arrayArg?: PHPReference): Promise<boolean> {
    const array = await arrayArg?.get();
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    return true;
  }

  public static async rsort(ctx: PHPContext, arrayArg?: PHPReference): Promise<boolean>{
    const array = await arrayArg?.get();
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return true;
  }

  public static async asort(ctx: PHPContext, arrayArg?: any, flagsArg?: any): Promise<boolean>{
    let array = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    while (array instanceof PHPReference) array = await array.get();
    if (!array || typeof array !== "object") return false;

    let flagsVal = flagsArg?.get !== undefined ? await flagsArg.get() : flagsArg;
    while (flagsVal instanceof PHPReference) flagsVal = await flagsVal.get();

    const entries = await Promise.all(Object.entries(array).map(async ([key, value]) => ({
      key,
      value,
      sortValue: await unwrap(value),
    })));
    entries.sort((a, b) => {
      if (a.sortValue > b.sortValue) return 1;
      if (a.sortValue < b.sortValue) return -1;
      return 0;
    });

    if (Array.isArray(array)) {
      array.length = 0;
      for (const { key, value } of entries) {
        (array as any)[key] = value;
      }
    } else {
      for (const key of Object.keys(array)) delete array[key];
      for (const entry of entries) array[entry.key] = entry.value;
    }
    return true;
  }

  public static async arsort(ctx: PHPContext, arrayArg?: any, flagsArg?: any): Promise<boolean>{
    let array = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    while (array instanceof PHPReference) array = await array.get();
    if (!array || typeof array !== "object") return false;

    let flagsVal = flagsArg?.get !== undefined ? await flagsArg.get() : flagsArg;
    while (flagsVal instanceof PHPReference) flagsVal = await flagsVal.get();

    const entries = await Promise.all(Object.entries(array).map(async ([key, value]) => ({
      key,
      value,
      sortValue: await unwrap(value),
    })));
    entries.sort((a, b) => {
      if (a.sortValue < b.sortValue) return 1;
      if (a.sortValue > b.sortValue) return -1;
      return 0;
    });

    if (Array.isArray(array)) {
      array.length = 0;
      for (const { key, value } of entries) {
        (array as any)[key] = value;
      }
    } else {
      for (const key of Object.keys(array)) delete array[key];
      for (const entry of entries) array[entry.key] = entry.value;
    }
    return true;
  }

  public static async ksort(ctx: PHPContext, arrayArg?: PHPReference, flagsArg?: PHPReference): Promise<boolean>{
    const array = await arrayArg?.get();
    const flags = Number(await flagsArg?.get()) || 0;
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

  public static async krsort(ctx: PHPContext, arrayArg?: PHPReference, flagsArg?: PHPReference): Promise<boolean>{
    const array = await arrayArg?.get();
    const flags = Number(await flagsArg?.get()) || 0;
    if (!array || typeof array !== "object") return false;
    const entries = Object.entries(array).sort(([left], [right]) => {
      if (flags === 1) return right.localeCompare(left);
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) return rightNumber - leftNumber;
      return right.localeCompare(left);
    });
    for (const key of Object.keys(array)) delete array[key];
    for (const [key, value] of entries) array[key] = value;
    return true;
  }

  public static async array_map(ctx: PHPContext, callbackArg?: PHPReference, ...arraysArgs: PHPReference[]): Promise<any> {
    const callback = await callbackArg?.get();
    const arrays = await Promise.all(arraysArgs.map((arg) => arg?.get()));
    if (!callback) return arrays[0] || [];
    const arr = arrays[0] || [];
    const isArr = Array.isArray(arr);
    const keys = isArr ? arr.map((_, i) => i) : Object.keys(arr);
    const res: any = isArr ? [] : {};

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const args = arrays.map((a) => (Array.isArray(a) ? a[i] : a[key]));
      const wrapArgs = args.map((a) => (a instanceof PHPReference ? a : new PHPLiteral(a)));
      let mapped: any;
      if (typeof callback === "function") {
        mapped = await callback.apply(ctx, [ctx, ...wrapArgs]);
      } else if (typeof callback === "string") {
        const fn = ctx.functions[normalizePhpRegistryName(callback)] || ctx.functionMissing(callback);
        mapped = await fn(ctx, ...wrapArgs);
      } else if (Array.isArray(callback) && callback.length === 2) {
        const obj = callback[0] instanceof PHPReference ? await callback[0].get() : callback[0];
        const m = String(callback[1] instanceof PHPReference ? await callback[1].get() : callback[1]).toLowerCase();
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

  public static async array_replace(ctx: PHPContext, ...arraysArgs: any[]): Promise<any>{
    const arrays = await Promise.all(arraysArgs.map(unwrap));

    const first = arrays[0];
    if (!first || typeof first !== "object") return {};

    const isArr = Array.isArray(first);
    const result: any = isArr ? [...first] : { ...first };

    for (let i = 1; i < arrays.length; i++) {
      const current = arrays[i];
      if (!current || typeof current !== "object") continue;
      for (const [k, v] of Object.entries(current)) {
        result[k] = v;
      }
    }
    return result;
  }

  public static async array_replace_recursive(ctx: PHPContext, ...arraysArgs: any[]): Promise<any>{
    const mergeRecursive = async (target: any, source: any): Promise<any> => {
      if (!source || typeof source !== "object") return source;
      if (!target || typeof target !== "object") target = Array.isArray(source) ? [] : {};

      const isArr = Array.isArray(target);
      const res: any = isArr ? [...target] : { ...target };

      for (const [k, v] of Object.entries(source)) {
        const targetVal = res[k];
        const sourceVal = await unwrap(v);
        if (targetVal && typeof targetVal === "object" && sourceVal && typeof sourceVal === "object" && !Array.isArray(sourceVal)) {
          res[k] = await mergeRecursive(targetVal, sourceVal);
        } else {
          res[k] = sourceVal;
        }
      }
      return res;
    };

    const arrays = await Promise.all(arraysArgs.map(unwrap));

    let res = arrays[0] || {};
    for (let i = 1; i < arrays.length; i++) {
      res = await mergeRecursive(res, arrays[i]);
    }
    return res;
  }

  public static async array_filter(ctx: PHPContext, arrayArg?: any, callbackArg?: any, modeArg?: any): Promise<any> {
    let array = arrayArg?.get !== undefined ? await arrayArg.get() : arrayArg;
    while (array instanceof PHPReference) array = await array.get();

    let callback = callbackArg?.get !== undefined ? await callbackArg.get() : callbackArg;
    while (callback instanceof PHPReference) callback = await callback.get();

    let modeVal = modeArg?.get !== undefined ? await modeArg.get() : modeArg;
    while (modeVal instanceof PHPReference) modeVal = await modeVal.get();
    const mode = Number(modeVal) || 0;

    if (!array || typeof array !== "object") return Array.isArray(array) ? [] : {};
    const isArr = Array.isArray(array);
    const result: any = isArr ? [] : {};

    let entries: Array<[any, any]> = [];
    if (isArr) {
      entries = array.map((v: any, i: number) => [i, v]);
    } else if (typeof array === "object" && array !== null) {
      entries = Object.entries(array);
    }

    if (!Array.isArray(entries)) return result;

    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const k = entry[0];
      const v = entry[1];
      let val = v instanceof PHPReference ? await v.get() : v;
      let keep = false;
      if (!callback) {
        keep = Boolean(val);
      } else {
        const args = mode === 1 ? [new PHPLiteral(k)] : mode === 2 ? [new PHPLiteral(val), new PHPLiteral(k)] : [new PHPLiteral(val)];
        if (typeof callback === "function") {
          keep = Boolean(await callback.apply(ctx, [ctx, ...args]));
        } else if (typeof callback === "string") {
          const fn = ctx.functions[normalizePhpRegistryName(callback)] || ctx.functionMissing(callback);
          keep = Boolean(await fn(ctx, ...args));
        } else if (Array.isArray(callback) && callback.length === 2) {
          const obj = callback[0] instanceof PHPReference ? await callback[0].get() : callback[0];
          const m = String(callback[1] instanceof PHPReference ? await callback[1].get() : callback[1]).toLowerCase();
          if (obj && typeof obj[m] === "function") {
            keep = Boolean(await obj[m](ctx, ...args));
          }
        }
      }
      if (keep) {
        if (isArr) (result as any[]).push(val);
        else (result as Record<string, any>)[String(k)] = val;
      }
    }
    return result;
  }

  public static async array_all(ctx: PHPContext, arrayArg?: any, callbackArg?: any): Promise<boolean> {
    const array = await ctx.toVal(arrayArg);
    const callback = await ctx.toVal(callbackArg);

    if (!array || typeof array !== "object") return true;

    const entries = Array.isArray(array) ? array.map((v, i) => [i, v]) : Object.entries(array);

    for (const [k, v] of entries) {
      const val = await ctx.toVal(v);
      let rawRes: any = false;
      const args = [new PHPLiteral(val), new PHPLiteral(k)];
      if (typeof callback === "function") {
        rawRes = await callback.apply(ctx, [ctx, ...args]);
      } else if (typeof callback === "string") {
        const fn = ctx.functions[normalizePhpRegistryName(callback)] || ctx.functionMissing(callback);
        rawRes = await fn(ctx, ...args);
      } else if (Array.isArray(callback) && callback.length === 2) {
        const obj = await ctx.toVal(callback[0]);
        const m = String(await ctx.toVal(callback[1])).toLowerCase();
        if (obj && typeof obj[m] === "function") {
          rawRes = await obj[m](ctx, ...args);
        }
      }
      if (!(await ctx.isTruthy(rawRes))) return false;
    }
    return true;
  }

  public static async iterator_to_array(ctx: PHPContext, iteratorArg?: any, preserveKeysArg?: any): Promise<any> {
    const iterator = await ctx.toVal(iteratorArg);
    const preserveKeys = preserveKeysArg === undefined || (await ctx.isTruthy(preserveKeysArg));

    if (Array.isArray(iterator)) {
      return preserveKeys ? iterator.slice() : Promise.all(iterator.map((value) => ctx.toVal(value)));
    }
    if (!iterator || typeof iterator !== "object") return [];

    const entries = Object.entries(iterator);
    if (!preserveKeys) return Promise.all(entries.map(([, value]) => ctx.toVal(value)));
    return Object.fromEntries(entries);
  }

  public static async array_any(ctx: PHPContext, arrayArg?: any, callbackArg?: any): Promise<boolean> {
    const array = await ctx.toVal(arrayArg);
    const callback = await ctx.toVal(callbackArg);

    if (!array || typeof array !== "object") return false;

    const entries = Array.isArray(array) ? array.map((v, i) => [i, v]) : Object.entries(array);

    for (const [k, v] of entries) {
      const val = await ctx.toVal(v);
      let rawRes: any = false;
      const args = [new PHPLiteral(val), new PHPLiteral(k)];
      if (typeof callback === "function") {
        rawRes = await callback.apply(ctx, [ctx, ...args]);
      } else if (typeof callback === "string") {
        const fn = ctx.functions[normalizePhpRegistryName(callback)] || ctx.functionMissing(callback);
        rawRes = await fn(ctx, ...args);
      } else if (Array.isArray(callback) && callback.length === 2) {
        const obj = await ctx.toVal(callback[0]);
        const m = String(await ctx.toVal(callback[1])).toLowerCase();
        if (obj && typeof obj[m] === "function") {
          rawRes = await obj[m](ctx, ...args);
        }
      }
      if (await ctx.isTruthy(rawRes)) return true;
    }
    return false;
  }

  public static async array_reduce(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: PHPReference, initialArg?: PHPReference): Promise<any> {
    const array = await arrayArg?.get();
    const callback = await callbackArg?.get();
    let carry = await initialArg?.get();

    if (!array || typeof array !== "object") return null;
    const values = Array.isArray(array) ? array : Object.values(array);

    const cb = callback;

    for (const item of values) {
      if (typeof cb === "string") {
        const fn = ctx.functions[normalizePhpRegistryName(cb)] || ctx.functionMissing(cb);
        carry = await fn(ctx, new PHPLiteral(carry), new PHPLiteral(item));
      } else if (Array.isArray(cb) && cb.length === 2) {
        const target0 = await ctx.toVal(cb[0]);
        const mName = String(await ctx.toVal(cb[1])).toLowerCase();
        if (typeof target0 === "string") {
          const clsName = normalizePhpRegistryName(target0);
          const cls = ctx.classes[clsName] || ctx.engine.classes[clsName] || (await ctx.resolveClass(clsName, target0));
          if (cls && typeof cls[mName] === "function") {
            carry = await cls[mName](ctx, new PHPLiteral(carry), new PHPLiteral(item));
          }
        } else if (target0 && typeof target0 === "object") {
          if (typeof target0[mName] === "function") {
            carry = await target0[mName](ctx, new PHPLiteral(carry), new PHPLiteral(item));
          }
        }
      } else if (typeof cb === "function") {
        carry = await cb.apply(ctx, [ctx, new PHPLiteral(carry), new PHPLiteral(item)]);
      } else if (cb && typeof cb === "object" && typeof cb.__invoke === "function") {
        carry = await cb.__invoke(ctx, new PHPLiteral(carry), new PHPLiteral(item));
      }
    }

    return carry;
  }

  public static async array_key_first(ctx: PHPContext, arrayArg?: PHPReference): Promise<any | null>{
    const array = await arrayArg?.get();
    if (!array || typeof array !== "object") return null;
    if (Array.isArray(array)) return array.length > 0 ? 0 : null;
    const keys = Object.keys(array);
    return keys.length > 0 ? keys[0] : null;
  }

  public static async array_key_last(ctx: PHPContext, arrayArg?: PHPReference): Promise<any | null>{
    const array = await arrayArg?.get();
    if (!array || typeof array !== "object") return null;
    if (Array.isArray(array)) return array.length > 0 ? array.length - 1 : null;
    const keys = Object.keys(array);
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }

  private static getEntries(array: any): [any, any][] {
    if (!array || (typeof array !== "object" && typeof array !== "function")) return [];
    return Object.entries(array).map(([k, v]) => [(!isNaN(Number(k)) && String(Number(k)) === String(k)) ? Number(k) : k, v]);
  }

  public static async reset(ctx: PHPContext, arrayArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    if (typeof array === "object" && array !== null) Object.defineProperty(array, "__ptr", { value: 0, writable: true, configurable: true, enumerable: false });
    return entries[0][1];
  }

  public static async current(ctx: PHPContext, arrayArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const ptr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    if (ptr < 0 || ptr >= entries.length) return false;
    return entries[ptr][1];
  }

  public static async next(ctx: PHPContext, arrayArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    const nextPtr = currentPtr + 1;
    if (array && typeof array === "object") Object.defineProperty(array, "__ptr", { value: nextPtr, writable: true, configurable: true, enumerable: false });
    if (nextPtr >= entries.length) return false;
    return entries[nextPtr][1];
  }

  public static async prev(ctx: PHPContext, arrayArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    const prevPtr = currentPtr - 1;
    if (array && typeof array === "object") Object.defineProperty(array, "__ptr", { value: prevPtr, writable: true, configurable: true, enumerable: false });
    if (prevPtr < 0 || prevPtr >= entries.length) return false;
    return entries[prevPtr][1];
  }

  public static async end(ctx: PHPContext, arrayArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const lastPtr = entries.length - 1;
    if (array && typeof array === "object") Object.defineProperty(array, "__ptr", { value: lastPtr, writable: true, configurable: true, enumerable: false });
    return entries[lastPtr][1];
  }

  public static async key(ctx: PHPContext, arrayArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return null;
    const ptr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    if (ptr < 0 || ptr >= entries.length) return null;
    return entries[ptr][0];
  }

  public static async each(ctx: PHPContext, arrayArg?: PHPReference): Promise<any>{
    const array = await arrayArg?.get();
    const entries = ArrayRuntime.getEntries(array);
    if (!entries.length) return false;
    const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? (array as any).__ptr : 0;
    if (currentPtr < 0 || currentPtr >= entries.length) return false;
    const [k, v] = entries[currentPtr];
    if (array && typeof array === "object") Object.defineProperty(array, "__ptr", { value: currentPtr + 1, writable: true, configurable: true, enumerable: false });
    return { 1: v, value: v, 0: k, key: k };
  }

  public static async array_walk(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: any, userdataArg?: any): Promise<boolean> {
    const target = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    if (!target || typeof target !== "object") return false;
    const cb = callbackArg?.get ? await callbackArg.get() : callbackArg;
    const userdata = userdataArg?.get ? await userdataArg.get() : userdataArg;

    const entries = Array.isArray(target) ? Array.from(target.entries()) : Object.entries(target);
    for (const [k, v] of entries) {
      const valRef = new PHPArrayOffsetReference(target, k);
      const keyLit = new PHPLiteral(k);
      const userLit = new PHPLiteral(userdata);
      await CoreRuntime.functions.call_user_func(ctx, new PHPLiteral(cb), valRef, keyLit, userLit);
    }
    return true;
  }

  public static async array_walk_recursive(ctx: PHPContext, arrayArg?: PHPReference, callbackArg?: any, userdataArg?: any): Promise<boolean> {
    const walk = async (target: any) => {
      if (!target || typeof target !== "object") return;
      const entries = Array.isArray(target) ? Array.from(target.entries()) : Object.entries(target);
      for (const [k, v] of entries) {
        const item = v instanceof PHPReference ? await v.get() : v;
        if (item && typeof item === "object") {
          await walk(item);
        } else {
          const valRef = new PHPArrayOffsetReference(target, k);
          const keyLit = new PHPLiteral(k);
          const userLit = new PHPLiteral(userdataArg?.get ? await userdataArg.get() : userdataArg);
          const cb = callbackArg?.get ? await callbackArg.get() : callbackArg;
          await CoreRuntime.functions.call_user_func(ctx, new PHPLiteral(cb), valRef, keyLit, userLit);
        }
      }
    };

    const targetArr = arrayArg instanceof PHPReference ? await arrayArg.get() : arrayArg;
    await walk(targetArr);
    return true;
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
    "array_replace": ArrayRuntime.array_replace,
    "array_replace_recursive": ArrayRuntime.array_replace_recursive,
    "array_combine": ArrayRuntime.array_combine,
    "array_walk": ArrayRuntime.array_walk,
    "array_walk_recursive": ArrayRuntime.array_walk_recursive,
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
    "asort": ArrayRuntime.asort,
    "arsort": ArrayRuntime.arsort,
    "ksort": ArrayRuntime.ksort,
    "krsort": ArrayRuntime.krsort,
    "rsort": ArrayRuntime.rsort,
    "array_map": ArrayRuntime.array_map,
    "array_filter": ArrayRuntime.array_filter,
    "array_all": ArrayRuntime.array_all,
    "array_any": ArrayRuntime.array_any,
    "iterator_to_array": ArrayRuntime.iterator_to_array,
    "array_reduce": ArrayRuntime.array_reduce,
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
