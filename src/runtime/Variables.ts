import * as crypto from "crypto";
import { serialize as serializePHP } from "php-serialize";
import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
import { PHPObject } from "./PHPObject";
import { PHPError, PHPTypeError } from "./PHPError";

export class VariablesRuntime {
  public static register(engine: PHPEngine): void {
    const register = engine.registerFunction.bind(engine);
    register("var_dump", (ctx: PHPContext, ...args: any[]) => VariablesRuntime.var_dump(ctx, ...args));
    register("print_r", (ctx: PHPContext, value: any, returnValue = false) => VariablesRuntime.print_r(ctx, value, returnValue));
    register("is_array", (ctx: PHPContext, value: any) => VariablesRuntime.is_array(value));
    register("is_bool", (ctx: PHPContext, value: any) => VariablesRuntime.is_bool(value));
    register("is_float", (ctx: PHPContext, value: any) => VariablesRuntime.is_float(value));
    register("is_int", (ctx: PHPContext, value: any) => VariablesRuntime.is_int(value));
    register("is_null", (ctx: PHPContext, value: any) => VariablesRuntime.is_null(value));
    register("is_numeric", (ctx: PHPContext, value: any) => VariablesRuntime.is_numeric(value));
    register("is_object", (ctx: PHPContext, value: any) => VariablesRuntime.is_object(value));
    register("is_scalar", (ctx: PHPContext, value: any) => VariablesRuntime.is_scalar(value));
    register("is_string", (ctx: PHPContext, value: any) => VariablesRuntime.is_string(value));
    register("is_iterable", (ctx: PHPContext, value: any) => Array.isArray(value) || (value && typeof value === "object"));
    register("is_countable", (ctx: PHPContext, value: any) => Array.isArray(value) || typeof value === "string");
    register("is_resource", (ctx: PHPContext, value: any) => value && typeof value === "object" && Boolean(value.isResource));
    register("gettype", (ctx: PHPContext, value: any) => VariablesRuntime.gettype(value));
    register("get_class", (ctx: PHPContext, value: any) => value?.phpClass?.name || value?.constructor?.name || false);
    register("get_object_vars", (ctx: PHPContext, value: any) => VariablesRuntime.get_object_vars(value));
    register("serialize", (ctx: PHPContext, value: any) => VariablesRuntime.serialize(value));
    register("uniqid", (ctx: PHPContext, prefix = "", moreEntropy = false) => {
      const timestamp = Date.now().toString(16);
      const entropy = crypto.randomBytes(moreEntropy ? 8 : 4).toString("hex");
      return `${prefix}${timestamp}${entropy}`;
    });
    register("intval", (ctx: PHPContext, value: any, base = 10) => VariablesRuntime.intval(value, base));
    register("floatval", (ctx: PHPContext, value: any) => VariablesRuntime.floatval(value));
    register("strval", (ctx: PHPContext, value: any) => VariablesRuntime.strval(value));
    register("boolval", (ctx: PHPContext, value: any) => VariablesRuntime.boolval(value));
  }

  public static serialize(value: any): string {
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

  public static is_array(val: any): boolean { return Array.isArray(val); }
  public static is_bool(val: any): boolean { return typeof val === "boolean"; }
  public static is_float(val: any): boolean { return typeof val === "number" && !Number.isInteger(val); }
  public static is_int(val: any): boolean { return typeof val === "number" && Number.isInteger(val); }
  public static is_null(val: any): boolean { return val === null || val === undefined; }
  public static is_numeric(val: any): boolean {
    if (typeof val === "number") return !Number.isNaN(val);
    if (typeof val !== "string") return false;
    return !Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val));
  }
  public static is_object(val: any): boolean { return typeof val === "function" || val instanceof PHPObject || (typeof val === "object" && val !== null && !Array.isArray(val)); }
  public static get_object_vars(value: any): Record<string, any> {
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
  public static is_scalar(val: any): boolean {
    const t = typeof val;
    return t === "string" || t === "number" || t === "boolean";
  }
  public static is_string(val: any): boolean { return typeof val === "string"; }
  public static gettype(val: any): string {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "number") return Number.isInteger(val) ? "integer" : "double";
    if (typeof val === "string") return "string";
    if (Array.isArray(val)) return "array";
    if (val instanceof PHPObject) return "object";
    return "object";
  }
  public static intval(val: any, base = 10): number {
    const p = parseInt(String(val), base);
    return Number.isNaN(p) ? 0 : p;
  }
  public static floatval(val: any): number {
    const f = parseFloat(String(val));
    return Number.isNaN(f) ? 0 : f;
  }
  public static strval(val: any): string { return String(val ?? ""); }
  public static boolval(val: any): boolean { return Boolean(val); }
}
