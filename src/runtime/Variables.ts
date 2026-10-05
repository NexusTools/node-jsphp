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
        if (input && typeof input === "object" && input.constructor !== Object && input.constructor !== Array) {
          const name = (input as any)[SYMBOL_PHP_NAME] || input.constructor?.[SYMBOL_PHP_NAME] || input.constructor?.name || "stdClass";
          scope[name] ||= class {};
          const result = new scope[name]();
          for (const [property, entry] of Object.entries(input)) {
            result[property] = prepare(entry instanceof PHPVariable ? entry.get() : entry);
          }
          return result;
        }
        if (Array.isArray(input) && Object.keys(input).every((key, index) => key === String(index))) {
          return input.map(prepare);
        }
        return Object.fromEntries(Object.entries(input).map(([key, entry]) => [key, prepare(entry)]));
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
  public static is_array(ctx: PHPContext | null, valArg?: PHPReference): boolean { return Array.isArray(valArg?.get()); }
  /** Finds whether a variable is a boolean. */
  public static is_bool(ctx: PHPContext | null, valArg?: PHPReference): boolean { return typeof valArg?.get() === "boolean"; }
  /** Finds whether a variable is a float. */
  public static is_float(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    return typeof val === "number" && !Number.isInteger(val);
  }
  /** Finds whether a variable is an integer. */
  public static is_int(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    return typeof val === "number" && Number.isInteger(val);
  }
  /** Finds whether a variable is NULL. */
  public static is_null(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    return val === null || val === undefined;
  }
  /** Finds whether a variable is a number or a numeric string. */
  public static is_numeric(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    if (typeof val === "number") return !Number.isNaN(val);
    if (typeof val !== "string") return false;
    return !Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val));
  }
  /** Finds whether a variable is an object. */
  public static is_object(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    return typeof val === "function" || (typeof val === "object" && val !== null && !Array.isArray(val) && val.constructor !== Object);
  }
  /** Gets the properties of the given object. */
  public static get_object_vars(ctx: PHPContext | null, valueArg?: PHPReference): Record<string, any> {
    const value = valueArg?.get();
    if (value && typeof value === "object" && value.constructor !== Object && value.constructor !== Array && !(value instanceof PHPError)) {
      return Object.fromEntries(Object.entries(value).filter(([k, v]) => v instanceof PHPVariable).map(([k, v]) => [k, (v as any).get()]));
    }
    if (value instanceof PHPError) {
      const properties: Map<string, any> = (value as any).phpClass?.properties || new Map();
      return Object.fromEntries([...properties]
        .filter(([, metadata]) => metadata.visibility === "public" && !metadata.isStatic)
        .map(([name]) => [name, (value as any)[name]]));
    }
    if (typeof value === "function") return {};
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new PHPTypeError("get_object_vars(): Argument #1 ($object) must be of type object");
    }
    return { ...value };
  }
  /** Finds whether a variable is a scalar. */
  public static is_scalar(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    const t = typeof val;
    return t === "string" || t === "number" || t === "boolean";
  }
  /** Finds whether a variable is a string. */
  public static is_string(ctx: PHPContext | null, valArg?: PHPReference): boolean { return typeof valArg?.get() === "string"; }
  /** Verify that the contents of a variable is an iterable value. */
  public static is_iterable(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    return Array.isArray(val) || (val && typeof val === "object");
  }
  /** Verify that the contents of a variable is a countable value. */
  public static is_countable(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    return Array.isArray(val) || typeof val === "string";
  }
  /** Finds whether a variable is a resource. */
  public static is_resource(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    const val = valArg?.get();
    return val && typeof val === "object" && Boolean(val.isResource);
  }
  /** Get the type of a variable. */
  public static gettype(ctx: PHPContext | null, valArg?: PHPReference): string {
    const val = valArg?.get();
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "number") return Number.isInteger(val) ? "integer" : "double";
    if (typeof val === "string") return "string";
    if (Array.isArray(val)) return "array";
    if (val && typeof val === "object" && val.constructor !== Object && val.constructor !== Array) return "object";
    return "object";
  }
  /** Returns the name of the class of an object. */
  public static get_class(ctx: PHPContext | null, valArg?: PHPReference): string | false {
    const val = valArg?.get();
    if (!val || typeof val !== "object") return false;
    if ((val as any).__php_name) return (val as any).__php_name;
    if (val.constructor && (val.constructor as any).__php_name) {
      return (val.constructor as any).__php_name;
    }
    const name = val.constructor?.name || "";
    return name.startsWith("__cls_") ? name.slice(6) : name || "stdClass";
  }
  /** Gets a prefixed unique identifier based on the current time in microseconds. */
  public static uniqid(ctx: PHPContext | null, prefixArg?: PHPReference, moreEntropyArg?: PHPReference): string {
    const prefix = String(prefixArg?.get() ?? "");
    const moreEntropy = Boolean(moreEntropyArg?.get());
    const timestamp = Date.now().toString(16);
    const entropy = crypto.randomBytes(moreEntropy ? 8 : 4).toString("hex");
    return `${prefix}${timestamp}${entropy}`;
  }
  /** Get the integer value of a variable. */
  public static intval(ctx: PHPContext | null, valArg?: PHPReference, baseArg?: PHPReference): number {
    const val = valArg?.get();
    const base = Number(baseArg?.get()) || 10;
    const p = parseInt(String(val ?? 0), base);
    return Number.isNaN(p) ? 0 : p;
  }
  /** Get float value of a variable. */
  public static floatval(ctx: PHPContext | null, valArg?: PHPReference): number {
    const f = parseFloat(String(valArg?.get() ?? 0));
    return Number.isNaN(f) ? 0 : f;
  }
  /** Get string value of a variable. */
  public static strval(ctx: PHPContext | null, valArg?: PHPReference): string {
    return String(valArg?.get() ?? "");
  }
  /** Get the boolean value of a variable. */
  public static boolval(ctx: PHPContext | null, valArg?: PHPReference): boolean {
    return Boolean(valArg?.get());
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

  public static var_export(ctx: PHPContext, valArg?: PHPReference, returnArg?: PHPReference): string | true {
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
        const items = val.map((v, i) => `${i} => ${VariablesRuntime.var_export(ctx, new PHPLiteral(v), new PHPLiteral(true))}`);
        str = "array (\n  " + items.join(",\n  ") + ",\n)";
      } else {
        const items = keys.map((k) => {
          const formattedKey = /^(0|[1-9]\d*)$/.test(k) ? k : `'${k}'`;
          return `${formattedKey} => ${VariablesRuntime.var_export(ctx, new PHPLiteral(val[k]), new PHPLiteral(true))}`;
        });
        str = "array (\n  " + items.join(",\n  ") + "\n)";
      }
    } else if (val && typeof val === "object" && val.constructor !== Object && val.constructor !== Array) {
      const items = Array.from(val.properties.entries()).map(([k, v]) => `'${k}' => ${VariablesRuntime.var_export(ctx, new PHPLiteral(v), new PHPLiteral(true))}`);
      str = `${val.phpClass.name}::__set_state(array(\n  ` + items.join(",\n  ") + "\n))";
    } else if (typeof val === "object") {
      const items = Object.entries(val).map(([k, v]) => `'${k}' => ${VariablesRuntime.var_export(ctx, new PHPLiteral(v), new PHPLiteral(true))}`);
      str = "array (\n  " + items.join(",\n  ") + ",\n)";
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
    "compact": VariablesRuntime.compact,
    "extract": VariablesRuntime.extract,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(VariablesRuntime.functions);
  }
}
