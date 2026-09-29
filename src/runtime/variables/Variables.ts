import { PHPObject } from "../objects/PHPObject";

export class VariablesRuntime {
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
  public static is_object(val: any): boolean { return val instanceof PHPObject || (typeof val === "object" && val !== null && !Array.isArray(val)); }
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
