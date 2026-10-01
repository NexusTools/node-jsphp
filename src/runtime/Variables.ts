import * as crypto from "crypto";
import { serialize as serializePHP } from "php-serialize";
import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
import { PHPObject } from "./PHPObject";
import { PHPError, PHPTypeError } from "./PHPError";

export class VariablesRuntime {
  /**
   * Serializes a value into a PHP-compatible serialized string representation.
   */
  public static serialize(ctx: PHPContext | null, value: any): string {
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
        if (input instanceof PHPObject) {
          const name = input.phpClass.name;
          scope[name] ||= class {};
          const result = new scope[name]();
          for (const [property, entry] of input.properties) {
            const visibility = input.phpClass.properties.get(property)?.visibility;
            const key = visibility === "private" ? `\0${name}\0${property}` : visibility === "protected" ? `\0*\0${property}` : property;
            result[key] = prepare(entry);
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
  public static var_dump(ctx: any, ...args: any[]): void {
    for (const val of args) {
      if (val === null) {
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
      } else if (val instanceof PHPObject) {
        ctx.echo(`object(${val.phpClass.name})#${Math.floor(Math.random() * 1000)} (${val.properties.size}) {\n`);
        val.properties.forEach((v, k) => {
          ctx.echo(`  ["${k}"]=>\n  ${String(v)}\n`);
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
  public static print_r(ctx: any, val: any, returnVal = false): string | true {
    let str = "";
    if (val === null) str = "";
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
  public static is_array(ctx: PHPContext | null, val: any): boolean { return Array.isArray(val); }
  /** Finds whether a variable is a boolean. */
  public static is_bool(ctx: PHPContext | null, val: any): boolean { return typeof val === "boolean"; }
  /** Finds whether a variable is a float. */
  public static is_float(ctx: PHPContext | null, val: any): boolean { return typeof val === "number" && !Number.isInteger(val); }
  /** Finds whether a variable is an integer. */
  public static is_int(ctx: PHPContext | null, val: any): boolean { return typeof val === "number" && Number.isInteger(val); }
  /** Finds whether a variable is NULL. */
  public static is_null(ctx: PHPContext | null, val: any): boolean { return val === null || val === undefined; }
  /** Finds whether a variable is a number or a numeric string. */
  public static is_numeric(ctx: PHPContext | null, val: any): boolean {
    if (typeof val === "number") return !Number.isNaN(val);
    if (typeof val !== "string") return false;
    return !Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val));
  }
  /** Finds whether a variable is an object. */
  public static is_object(ctx: PHPContext | null, val: any): boolean { return typeof val === "function" || val instanceof PHPObject || (typeof val === "object" && val !== null && !Array.isArray(val)); }
  /** Gets the properties of the given object. */
  public static get_object_vars(ctx: PHPContext | null, value: any): Record<string, any> {
    if (value instanceof PHPObject) {
      return Object.fromEntries([...value.properties].filter(([name]) => {
        const metadata = value.phpClass.properties.get(name);
        return !metadata || metadata.visibility === "public";
      }));
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
  public static is_scalar(ctx: PHPContext | null, val: any): boolean {
    const t = typeof val;
    return t === "string" || t === "number" || t === "boolean";
  }
  /** Finds whether a variable is a string. */
  public static is_string(ctx: PHPContext | null, val: any): boolean { return typeof val === "string"; }
  /** Verify that the contents of a variable is an iterable value. */
  public static is_iterable(ctx: PHPContext | null, val: any): boolean { return Array.isArray(val) || (val && typeof val === "object"); }
  /** Verify that the contents of a variable is a countable value. */
  public static is_countable(ctx: PHPContext | null, val: any): boolean { return Array.isArray(val) || typeof val === "string"; }
  /** Finds whether a variable is a resource. */
  public static is_resource(ctx: PHPContext | null, val: any): boolean { return val && typeof val === "object" && Boolean(val.isResource); }
  /** Get the type of a variable. */
  public static gettype(ctx: PHPContext | null, val: any): string {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "number") return Number.isInteger(val) ? "integer" : "double";
    if (typeof val === "string") return "string";
    if (Array.isArray(val)) return "array";
    if (val instanceof PHPObject) return "object";
    return "object";
  }
  /** Returns the name of the class of an object. */
  public static get_class(ctx: PHPContext | null, val: any): string | false {
    return val?.phpClass?.name || val?.constructor?.name || false;
  }
  /** Gets a prefixed unique identifier based on the current time in microseconds. */
  public static uniqid(ctx: PHPContext | null, prefix = "", moreEntropy = false): string {
    const timestamp = Date.now().toString(16);
    const entropy = crypto.randomBytes(moreEntropy ? 8 : 4).toString("hex");
    return `${prefix}${timestamp}${entropy}`;
  }
  /** Get the integer value of a variable. */
  public static intval(ctx: PHPContext | null, val: any, base = 10): number {
    const p = parseInt(String(val), base);
    return Number.isNaN(p) ? 0 : p;
  }
  /** Get float value of a variable. */
  public static floatval(ctx: PHPContext | null, val: any): number {
    const f = parseFloat(String(val));
    return Number.isNaN(f) ? 0 : f;
  }
  /** Get string value of a variable. */
  public static strval(ctx: PHPContext | null, val: any): string { return String(val ?? ""); }
  /** Get the boolean value of a variable. */
  public static boolval(ctx: PHPContext | null, val: any): boolean { return Boolean(val); }

  static functions = {
    "var_dump": VariablesRuntime.var_dump,
    "print_r": VariablesRuntime.print_r,
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
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(VariablesRuntime.functions);
  }
}
