import * as crypto from "crypto";
import { serialize as serializePHP } from "php-serialize";
import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";

import { PHPError, PHPTypeError } from "./PHPError.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable.js";
import { SYMBOL_PHP_CLASS, SYMBOL_PHP_NAME, SYMBOL_PHP_PARENT, SYMBOL_PHP_PROPERTIES, decodePhpPropertyName } from "./Reflection.js";

export function isPlainObject(value: any): boolean {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) return true;
  return !value[SYMBOL_PHP_NAME]
    && Object.prototype.toString.call(value) === "[object Object]"
    && prototype.constructor?.name === "Object";
}

export class VariablesRuntime {
  /**
   * Serializes a value into a PHP-compatible serialized string representation.
   */
  public static async serialize(ctx: PHPContext | null, valueArg?: PHPReference): Promise<string>{
    const value = await valueArg?.get();
    const scope: Record<string, any> = Object.create(null);
    const active = new WeakSet<object>();
    const prepare = async (input: any): Promise<any> => {
      if (typeof input === "function") throw new PHPTypeError("Serialization of 'Closure' is not allowed");
      if (input === null || input === undefined) return null;
      if (typeof input !== "object") return input;
      if (input.isResource) return 0;
      if (active.has(input)) throw new PHPTypeError("Recursive serialization is not supported");
      active.add(input);
      try {
        if (input && typeof input === "object") {
          const isPhpObject = Boolean((input as any)[SYMBOL_PHP_NAME] || (input.constructor && input.constructor !== Object && input.constructor !== Array && (input.constructor as any)[SYMBOL_PHP_NAME]));
          if (isPhpObject) {
            const name = (input as any)[SYMBOL_PHP_NAME] || (input.constructor as any)[SYMBOL_PHP_NAME] || "stdClass";
            scope[name] ||= class {};
            const result = new scope[name]();
            for (const [property, entry] of Object.entries(input)) {
              if (property.startsWith("__")) continue;
              const cleanProp = property.startsWith("$") ? property.slice(1) : property;
              result[cleanProp] = await prepare(entry instanceof PHPReference ? await entry.get() : entry);
            }
            return result;
          }
          if (Array.isArray(input)) {
            return Promise.all(input.map(prepare));
          }
          const result: Record<string, any> = {};
          for (const [key, entry] of Object.entries(input)) {
            if (key.startsWith("__")) continue;
            const cleanKey = key.startsWith("$") ? key.slice(1) : key;
            result[cleanKey] = await prepare(entry instanceof PHPReference ? await entry.get() : entry);
          }
          return result;
        }
      } finally {
        active.delete(input);
      }
    };
    return serializePHP(await prepare(value), scope);
  }

  /**
   * Dumps information about one or more variables.
   */
  public static async var_dump(ctx: any, ...args: PHPReference[]): Promise<void>{
    for (const arg of args) {
      const val = await arg?.get();
      if (val === null || val === undefined) {
        await ctx.echo("NULL\n");
      } else if (typeof val === "boolean") {
        await ctx.echo(`bool(${val})\n`);
      } else if (typeof val === "number") {
        if (Number.isInteger(val)) await ctx.echo(`int(${val})\n`);
        else await ctx.echo(`float(${val})\n`);
      } else if (typeof val === "string") {
        await ctx.echo(`string(${val.length}) "${val}"\n`);
      } else if (Array.isArray(val)) {
        await ctx.echo(`array(${val.length}) {\n`);
        for (let index = 0; index < val.length; index++) {
          await ctx.echo(`  [${index}]=>\n  ${String(await ctx.toVal(val[index]))}\n`);
        }
        await ctx.echo("}\n");
      } else if (val && typeof val === "object" && val.constructor !== Object && val.constructor !== Array) {
        await ctx.echo(`object(${(val as any)[SYMBOL_PHP_NAME] || val.constructor?.[SYMBOL_PHP_NAME] || val.constructor?.name || "stdClass"})#${Math.floor(Math.random() * 1000)} (${Object.keys(val).length}) {\n`);
        for (const [key, entry] of Object.entries(val)) {
          await ctx.echo(`  ["${key}"]=>\n  ${String(await ctx.toVal(entry))}\n`);
        }
        await ctx.echo("}\n");
      } else {
        await ctx.echo(String(val) + "\n");
      }
    }
  }

  /**
   * Prints human-readable information about a variable.
   */
  public static async print_r(ctx: any, valArg?: PHPReference, returnValArg?: PHPReference): Promise<string | true>{
    const val = await valArg?.get();
    const returnVal = Boolean(await returnValArg?.get());
    let str = "";
    if (val === null || val === undefined) str = "";
    else if (typeof val === "boolean") str = val ? "1" : "";
    else if (typeof val === "object" || Array.isArray(val)) {
      str = JSON.stringify(val, null, 4);
    } else {
      str = String(val);
    }

    if (returnVal) return str;
    await ctx.echo(str);
    return true;
  }

  private static async unwrapValue(valArg: any): Promise<any> {
    let val = valArg instanceof PHPReference ? await valArg.get() : valArg;
    while (val instanceof PHPReference) val = await val.get();
    return val;
  }

  /** Finds whether a variable is an array. */
  public static async is_array(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return Array.isArray(val) || isPlainObject(val);
  }
  /** Finds whether a variable is a boolean. */
  public static async is_bool(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return typeof val === "boolean";
  }
  /** Finds whether a variable is a float. */
  public static async is_float(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return typeof val === "number" && !Number.isInteger(val);
  }
  /** Finds whether a variable is an integer. */
  public static async is_int(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return typeof val === "number" && Number.isInteger(val);
  }
  /** Finds whether a variable is NULL. */
  public static async is_null(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return val === null || val === undefined;
  }
  /** Finds whether a variable is a number or a numeric string. */
  public static async is_numeric(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    if (typeof val === "number") return !Number.isNaN(val);
    if (typeof val !== "string") return false;
    return !Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val));
  }
  /** Finds whether a variable is an object. */
  public static async is_object(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return typeof val === "function" || (typeof val === "object" && val !== null && !Array.isArray(val) && !isPlainObject(val));
  }
  /** Gets the properties of the given object. */
  public static async get_object_vars(ctx: PHPContext | null, valueArg?: any): Promise<Record<string, any>>{
    const value = await VariablesRuntime.unwrapValue(valueArg);
    if (typeof value === "function") return {};
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new PHPTypeError("get_object_vars(): Argument #1 ($object) must be of type object");
    }

    if (value.constructor === Object) {
      const cleanObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (k.startsWith("__")) continue;
        const cleanKey = k.startsWith("$") ? k.slice(1) : k;
        cleanObj[cleanKey] = await VariablesRuntime.unwrapValue(v);
      }
      return cleanObj;
    }

    if (value instanceof PHPError) {
      const properties: Record<string, any> = (value as any).phpClass?.properties || {};
      return Object.fromEntries(Object.entries(properties)
        .filter(([, metadata]) => metadata.visibility === "public" && !metadata.isStatic)
        .map(([name]) => [name, (value as any)[name]]));
    }

    let propMetaMap: Record<string, { visibility: string; isStatic: boolean; name?: string; encodedName?: string }> | null = null;
    let cls = value[SYMBOL_PHP_CLASS] || value.constructor;
    while (cls && cls !== Function.prototype) {
      const properties = cls[SYMBOL_PHP_PROPERTIES];
      if (properties && typeof properties === "object") {
        propMetaMap ||= Object.create(null);
        for (const [k, v] of Object.entries(properties) as [string, { visibility: string; isStatic: boolean; name?: string; encodedName?: string }][]) {
          if (!Object.hasOwn(propMetaMap, k)) {
            propMetaMap[k] = v;
          }
        }
      }
      cls = cls[SYMBOL_PHP_PARENT] || Object.getPrototypeOf(cls);
    }

    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith("__")) continue;
      const cleanKey = k.startsWith("$") ? decodePhpPropertyName(k) : k;
      if (propMetaMap) {
        const meta = propMetaMap[cleanKey];
        if (meta) {
          if (meta.visibility !== "public" || meta.isStatic) continue;
        }
      }
      result[cleanKey] = await VariablesRuntime.unwrapValue(v);
    }
    return result;
  }
  /** Finds whether a variable is a scalar. */
  public static async is_scalar(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    const t = typeof val;
    return t === "string" || t === "number" || t === "boolean";
  }
  /** Finds whether a variable is a string. */
  public static async is_string(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return typeof val === "string";
  }
  /** Verify that the contents of a variable is an iterable value. */
  public static async is_iterable(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return Array.isArray(val) || (val && typeof val === "object");
  }
  /** Verify that the contents of a variable is a countable value. */
  public static async is_countable(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return Array.isArray(val) || typeof val === "string";
  }
  /** Finds whether a variable is a resource. */
  public static async is_resource(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return val && typeof val === "object" && Boolean(val.isResource);
  }
  /** Get the type of a variable. */
  public static async gettype(ctx: PHPContext | null, valArg?: any): Promise<string>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "number") return Number.isInteger(val) ? "integer" : "double";
    if (typeof val === "string") return "string";
    if (Array.isArray(val)) return "array";
    if (val && typeof val === "object" && val.constructor !== Object && val.constructor !== Array) return "object";
    return "object";
  }
  /** Returns the name of the class of an object. */
  public static async get_class(ctx: PHPContext | null, valArg?: any): Promise<string | false>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    if (!val || typeof val !== "object") return false;
    if ((val as any)[SYMBOL_PHP_NAME]) return (val as any)[SYMBOL_PHP_NAME];
    if (val.constructor && (val.constructor as any)[SYMBOL_PHP_NAME]) {
      return (val.constructor as any)[SYMBOL_PHP_NAME];
    }
    const name = val.constructor?.name || "";
    return name.startsWith("__cls_") ? name.slice(6) : name || "stdClass";
  }
  /** Gets a prefixed unique identifier based on the current time in microseconds. */
  public static async uniqid(ctx: PHPContext | null, prefixArg?: any, moreEntropyArg?: any): Promise<string>{
    const prefix = String(await VariablesRuntime.unwrapValue(prefixArg) ?? "");
    const moreEntropy = Boolean(await VariablesRuntime.unwrapValue(moreEntropyArg));
    const timestamp = Date.now().toString(16);
    const entropy = crypto.randomBytes(moreEntropy ? 8 : 4).toString("hex");
    return `${prefix}${timestamp}${entropy}`;
  }
  /** Get the integer value of a variable. */
  public static async intval(ctx: PHPContext | null, valArg?: any, baseArg?: any): Promise<number>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    const base = Number(await VariablesRuntime.unwrapValue(baseArg)) || 10;
    const p = parseInt(String(val ?? 0), base);
    return Number.isNaN(p) ? 0 : p;
  }
  /** Get float value of a variable. */
  public static async floatval(ctx: PHPContext | null, valArg?: any): Promise<number>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    const f = parseFloat(String(val ?? 0));
    return Number.isNaN(f) ? 0 : f;
  }
  /** Get string value of a variable. */
  public static async strval(ctx: PHPContext | null, valArg?: any): Promise<string>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return String(val ?? "");
  }
  /** Get the boolean value of a variable. */
  public static async boolval(ctx: PHPContext | null, valArg?: any): Promise<boolean>{
    const val = await VariablesRuntime.unwrapValue(valArg);
    return Boolean(val);
  }

  public static async getenv(ctx: PHPContext, varnameArg?: any): Promise<string | false | Record<string, string>>{
    const varname = await VariablesRuntime.unwrapValue(varnameArg);
    if (varname === undefined || varname === null) {
      return ctx.env || process.env;
    }
    const name = String(varname);
    const val = (ctx.env && ctx.env[name]) ?? (ctx.env && ctx.env[name.toUpperCase()]) ?? process.env[name] ?? process.env[name.toUpperCase()];
    return val !== undefined ? val : false;
  }

  public static async compact(ctx: PHPContext, ...args: PHPReference[]): Promise<Record<string, any>>{
    const result: Record<string, any> = {};
    const processName = async (name: string) => {
      const val = await ctx.getVar(name);
      if (val !== undefined) {
        result[name] = val;
      }
    };
    for (const arg of args) {
      const val = await arg?.get();
      if (typeof val === "string") {
        await processName(val);
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "string") await processName(item);
        }
      }
    }
    return result;
  }

  public static async extract(ctx: PHPContext, arrayArg?: PHPReference): Promise<number>{
    const array = await arrayArg?.get();
    if (!array || typeof array !== "object") return 0;
    let count = 0;
    for (const [k, v] of Object.entries(array)) {
      await ctx.setVar(k, v);
      count++;
    }
    return count;
  }

  public static async var_export(ctx: PHPContext, valArg?: any, returnArg?: any, ...args: any[]): Promise<string | true>{
    const depth = typeof args[0] === "number" ? args[0] : 0;
    if (depth > 5) return "'...'";
    const val = await VariablesRuntime.unwrapValue(valArg);
    const returnVal = await VariablesRuntime.unwrapValue(returnArg);
    const isReturn = Boolean(returnVal);
    let str = "";
    if (val === null || val === undefined) str = "NULL";
    else if (typeof val === "boolean") str = val ? "true" : "false";
    else if (typeof val === "number") str = String(val);
    else if (typeof val === "string") str = "'" + val.replace(/'/g, "\\'") + "'";
    else if (Array.isArray(val)) {
      const keys = Object.keys(val);
      const isPureIndexed = keys.length === val.length && keys.every((k, i) => k === String(i));
      if (isPureIndexed) {
        const items: string[] = [];
        for (let i = 0; i < val.length; i++) {
          items.push(`${i} => ${await VariablesRuntime.var_export(ctx, new PHPLiteral(val[i]), new PHPLiteral(true), depth + 1)}`);
        }
        str = "array (\n  " + items.join(",\n  ") + ",\n)";
      } else {
        const items: string[] = [];
        for (const k of keys) {
          const formattedKey = /^(0|[1-9]\d*)$/.test(k) ? k : `'${k}'`;
          items.push(`${formattedKey} => ${await VariablesRuntime.var_export(ctx, new PHPLiteral(val[k]), new PHPLiteral(true), depth + 1)}`);
        }
        str = "array (\n  " + items.join(",\n  ") + "\n)";
      }
    } else if (val && typeof val === "object") {
      const className = (val as any)[SYMBOL_PHP_NAME] || (val as any).constructor?.[SYMBOL_PHP_NAME] || (val as any).constructor?.name || "stdClass";
      const items: string[] = [];
      for (const [k, v] of Object.entries(val)) {
        if (!k.startsWith("__")) {
          const entry = await VariablesRuntime.unwrapValue(v);
          items.push(`'${k}' => ${await VariablesRuntime.var_export(ctx, new PHPLiteral(entry), new PHPLiteral(true), depth + 1)}`);
        }
      }
      str = `${className}::__set_state(array(\n  ` + items.join(",\n  ") + "\n))";
    } else {
      str = String(val);
    }
    if (returnVal) return str;
    await ctx.echo(str);
    return true;
  }

  static functions = {
    "var_dump": VariablesRuntime.var_dump,
    "print_r": VariablesRuntime.print_r,
    "var_export": VariablesRuntime.var_export,
    "is_array": VariablesRuntime.is_array,
    "is_bool": VariablesRuntime.is_bool,
    "is_float": VariablesRuntime.is_float,
    "is_int": VariablesRuntime.is_int,
    "is_null": VariablesRuntime.is_null,
    "is_numeric": VariablesRuntime.is_numeric,
    "is_object": VariablesRuntime.is_object,
    "is_scalar": VariablesRuntime.is_scalar,
    "is_string": VariablesRuntime.is_string,
    "is_iterable": VariablesRuntime.is_iterable,
    "is_countable": VariablesRuntime.is_countable,
    "is_resource": VariablesRuntime.is_resource,
    "gettype": VariablesRuntime.gettype,
    "get_class": VariablesRuntime.get_class,
    "get_object_vars": VariablesRuntime.get_object_vars,
    "serialize": VariablesRuntime.serialize,
    "uniqid": VariablesRuntime.uniqid,
    "intval": VariablesRuntime.intval,
    "floatval": VariablesRuntime.floatval,
    "strval": VariablesRuntime.strval,
    "boolval": VariablesRuntime.boolval,
    "getenv": VariablesRuntime.getenv,
    "compact": VariablesRuntime.compact,
    "extract": VariablesRuntime.extract,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(VariablesRuntime.functions);
  }
}
