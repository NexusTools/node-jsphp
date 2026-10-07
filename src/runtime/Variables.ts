import * as crypto from "crypto";
import { serialize as serializePHP } from "php-serialize";
import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";

import { PHPError, PHPTypeError } from "./PHPError.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";

export class VariablesRuntime {
  /**
   * Serializes a value into a PHP-compatible serialized string representation.
   */
  public static serialize(ctx: PHPContext | null, valueArg?: PHPReference): string {
    const value = valueArg?.get();
    const scope: Record<string, any> = Object.create(null);
    const active = new WeakSet<object>();
    const prepare = (input: any): any => {
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
              result[cleanProp] = prepare(entry instanceof PHPVariable ? entry.get() : entry);
            }
            return result;
          }
          if (Array.isArray(input)) {
            return input.map(prepare);
          }
          const result: Record<string, any> = {};
          for (const [key, entry] of Object.entries(input)) {
            if (key.startsWith("__")) continue;
            const cleanKey = key.startsWith("$") ? key.slice(1) : key;
            result[cleanKey] = prepare(entry instanceof PHPVariable ? entry.get() : entry);
          }
          return result;
        }
      } finally {
        active.delete(input);
      }
    };
    return serializePHP(prepare(value), scope);
  }

  /**
   * Dumps information about one or more variables.
   */
  public static var_dump(ctx: any, ...args: PHPReference[]): void {
    for (const arg of args) {
      const val = arg?.get();
      if (val === null || val === undefined) {
        ctx.echo("NULL\n");
      } else if (typeof val === "boolean") {
        ctx.echo(`bool(${val})\n`);
      } else if (typeof val === "number") {
        if (Number.isInteger(val)) ctx.echo(`int(${val})\n`);
        else ctx.echo(`float(${val})\n`);
      } else if (typeof val === "string") {
        ctx.echo(`string(${val.length}) "${val}"\n`);
      } else if (Array.isArray(val)) {
        ctx.echo(`array(${val.length}) {\n`);
        val.forEach((item, idx) => {
          ctx.echo(`  [${idx}]=>\n  ${String(item)}\n`);
        });
        ctx.echo("}\n");
      } else if (val && typeof val === "object" && val.constructor !== Object && val.constructor !== Array) {
        ctx.echo(`object(${(val as any)[SYMBOL_PHP_NAME] || val.constructor?.[SYMBOL_PHP_NAME] || val.constructor?.name || "stdClass"})#${Math.floor(Math.random() * 1000)} (${Object.keys(val).length}) {\n`);
        Object.entries(val).forEach(([k, v]) => {
          ctx.echo(`  ["${k}"]=>\n  ${String(v instanceof PHPVariable ? v.get() : v)}\n`);
        });
        ctx.echo("}\n");
      } else {
        ctx.echo(String(val) + "\n");
      }
    }
  }

  /**
   * Prints human-readable information about a variable.
   */
  public static print_r(ctx: any, valArg?: PHPReference, returnValArg?: PHPReference): string | true {
    const val = valArg?.get();
    const returnVal = Boolean(returnValArg?.get());
    let str = "";
    if (val === null || val === undefined) str = "";
    else if (typeof val === "boolean") str = val ? "1" : "";
    else if (typeof val === "object" || Array.isArray(val)) {
      str = JSON.stringify(val, null, 4);
    } else {
      str = String(val);
    }

    if (returnVal) return str;
    ctx.echo(str);
    return true;
  }

  /** Finds whether a variable is an array. */
  public static is_array(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return Array.isArray(val) || (typeof val === "object" && val !== null && val.constructor === Object);
  }
  /** Finds whether a variable is a boolean. */
  public static is_bool(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return typeof val === "boolean";
  }
  /** Finds whether a variable is a float. */
  public static is_float(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return typeof val === "number" && !Number.isInteger(val);
  }
  /** Finds whether a variable is an integer. */
  public static is_int(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return typeof val === "number" && Number.isInteger(val);
  }
  /** Finds whether a variable is NULL. */
  public static is_null(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return val === null || val === undefined;
  }
  /** Finds whether a variable is a number or a numeric string. */
  public static is_numeric(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    if (typeof val === "number") return !Number.isNaN(val);
    if (typeof val !== "string") return false;
    return !Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val));
  }
  /** Finds whether a variable is an object. */
  public static is_object(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return typeof val === "function" || (typeof val === "object" && val !== null && !Array.isArray(val) && val.constructor !== Object);
  }
  /** Gets the properties of the given object. */
  public static async get_object_vars(ctx: PHPContext | null, valueArg?: any): Promise<Record<string, any>> {
    const value = valueArg instanceof PHPReference ? valueArg.get() : valueArg;
    if (typeof value === "function") return {};
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new PHPTypeError("get_object_vars(): Argument #1 ($object) must be of type object");
    }

    if (value instanceof PHPError) {
      const properties: Map<string, any> = (value as any).phpClass?.properties || new Map();
      return Object.fromEntries([...properties]
        .filter(([, metadata]) => metadata.visibility === "public" && !metadata.isStatic)
        .map(([name]) => [name, (value as any)[name]]));
    }

    let propMetaMap: Map<string, { visibility: string; isStatic: boolean }> | null = null;
    let cls = value.constructor;
    while (cls && cls !== Object) {
      if (cls.__php_properties) {
        if (!propMetaMap) propMetaMap = new Map();
        for (const [k, v] of cls.__php_properties.entries()) {
          if (!propMetaMap.has(k)) {
            propMetaMap.set(k, v);
          }
        }
      }
      cls = cls.__php_parent || Object.getPrototypeOf(cls);
    }

    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith("__")) continue;
      const cleanKey = k.startsWith("$") ? k.slice(1) : k;
      if (propMetaMap) {
        const meta = propMetaMap.get(cleanKey);
        if (meta) {
          if (meta.visibility !== "public" || meta.isStatic) continue;
        }
      }
      result[cleanKey] = v instanceof PHPVariable ? v.get() : v;
    }
    return result;
  }
  /** Finds whether a variable is a scalar. */
  public static is_scalar(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    const t = typeof val;
    return t === "string" || t === "number" || t === "boolean";
  }
  /** Finds whether a variable is a string. */
  public static is_string(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return typeof val === "string";
  }
  /** Verify that the contents of a variable is an iterable value. */
  public static is_iterable(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return Array.isArray(val) || (val && typeof val === "object");
  }
  /** Verify that the contents of a variable is a countable value. */
  public static is_countable(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return Array.isArray(val) || typeof val === "string";
  }
  /** Finds whether a variable is a resource. */
  public static is_resource(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return val && typeof val === "object" && Boolean(val.isResource);
  }
  /** Get the type of a variable. */
  public static gettype(ctx: PHPContext | null, valArg?: any): string {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "number") return Number.isInteger(val) ? "integer" : "double";
    if (typeof val === "string") return "string";
    if (Array.isArray(val)) return "array";
    if (val && typeof val === "object" && val.constructor !== Object && val.constructor !== Array) return "object";
    return "object";
  }
  /** Returns the name of the class of an object. */
  public static get_class(ctx: PHPContext | null, valArg?: any): string | false {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    if (!val || typeof val !== "object") return false;
    if ((val as any).__php_name) return (val as any).__php_name;
    if (val.constructor && (val.constructor as any).__php_name) {
      return (val.constructor as any).__php_name;
    }
    const name = val.constructor?.name || "";
    return name.startsWith("__cls_") ? name.slice(6) : name || "stdClass";
  }
  /** Gets a prefixed unique identifier based on the current time in microseconds. */
  public static uniqid(ctx: PHPContext | null, prefixArg?: any, moreEntropyArg?: any): string {
    const prefix = String((prefixArg instanceof PHPReference ? prefixArg.get() : prefixArg) ?? "");
    const moreEntropy = Boolean(moreEntropyArg instanceof PHPReference ? moreEntropyArg.get() : moreEntropyArg);
    const timestamp = Date.now().toString(16);
    const entropy = crypto.randomBytes(moreEntropy ? 8 : 4).toString("hex");
    return `${prefix}${timestamp}${entropy}`;
  }
  /** Get the integer value of a variable. */
  public static intval(ctx: PHPContext | null, valArg?: any, baseArg?: any): number {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    const base = Number(baseArg instanceof PHPReference ? baseArg.get() : baseArg) || 10;
    const p = parseInt(String(val ?? 0), base);
    return Number.isNaN(p) ? 0 : p;
  }
  /** Get float value of a variable. */
  public static floatval(ctx: PHPContext | null, valArg?: any): number {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    const f = parseFloat(String(val ?? 0));
    return Number.isNaN(f) ? 0 : f;
  }
  /** Get string value of a variable. */
  public static strval(ctx: PHPContext | null, valArg?: any): string {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return String(val ?? "");
  }
  /** Get the boolean value of a variable. */
  public static boolval(ctx: PHPContext | null, valArg?: any): boolean {
    const val = valArg instanceof PHPReference ? valArg.get() : valArg;
    return Boolean(val);
  }

  public static getenv(ctx: PHPContext, varnameArg?: any): string | false | Record<string, string> {
    const varname = varnameArg instanceof PHPReference ? varnameArg.get() : varnameArg;
    if (varname === undefined || varname === null) {
      return ctx.env || process.env;
    }
    const name = String(varname);
    const val = (ctx.env && ctx.env[name]) ?? (ctx.env && ctx.env[name.toUpperCase()]) ?? process.env[name] ?? process.env[name.toUpperCase()];
    return val !== undefined ? val : false;
  }

  public static compact(ctx: PHPContext, ...args: PHPReference[]): Record<string, any> {
    const result: Record<string, any> = {};
    const processName = (name: string) => {
      const val = ctx.getVar(name);
      if (val !== undefined) {
        result[name] = val;
      }
    };
    for (const arg of args) {
      const val = arg?.get();
      if (typeof val === "string") {
        processName(val);
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "string") processName(item);
        }
      }
    }
    return result;
  }

  public static extract(ctx: PHPContext, arrayArg?: PHPReference): number {
    const array = arrayArg?.get();
    if (!array || typeof array !== "object") return 0;
    let count = 0;
    for (const [k, v] of Object.entries(array)) {
      ctx.setVar(k, v);
      count++;
    }
    return count;
  }

  public static var_export(ctx: PHPContext, valArg?: PHPReference, returnArg?: PHPReference, ...args: any[]): string | true {
    const depth = typeof args[0] === "number" ? args[0] : 0;
    if (depth > 5) return "'...'";
    const val = valArg?.get();
    const returnVal = Boolean(returnArg?.get());
    let str = "";
    if (val === null || val === undefined) str = "NULL";
    else if (typeof val === "boolean") str = val ? "true" : "false";
    else if (typeof val === "number") str = String(val);
    else if (typeof val === "string") str = "'" + val.replace(/'/g, "\\'") + "'";
    else if (Array.isArray(val)) {
      const keys = Object.keys(val);
      const isPureIndexed = keys.length === val.length && keys.every((k, i) => k === String(i));
      if (isPureIndexed) {
        const items = val.map((v, i) => `${i} => ${VariablesRuntime.var_export(ctx, new PHPLiteral(v), new PHPLiteral(true), depth + 1)}`);
        str = "array (\n  " + items.join(",\n  ") + ",\n)";
      } else {
        const items = keys.map((k) => {
          const formattedKey = /^(0|[1-9]\d*)$/.test(k) ? k : `'${k}'`;
          return `${formattedKey} => ${VariablesRuntime.var_export(ctx, new PHPLiteral(val[k]), new PHPLiteral(true), depth + 1)}`;
        });
        str = "array (\n  " + items.join(",\n  ") + "\n)";
      }
    } else if (val && typeof val === "object") {
      const className = (val as any)[SYMBOL_PHP_NAME] || (val as any).constructor?.[SYMBOL_PHP_NAME] || (val as any).constructor?.name || "stdClass";
      const items = Object.entries(val).filter(([k]) => !k.startsWith("__")).map(([k, v]) => `'${k}' => ${VariablesRuntime.var_export(ctx, new PHPLiteral(v instanceof PHPVariable ? v.get() : v), new PHPLiteral(true), depth + 1)}`);
      str = `${className}::__set_state(array(\n  ` + items.join(",\n  ") + "\n))";
    } else {
      str = String(val);
    }
    if (returnVal) return str;
    ctx.echo(str);
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
