"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariablesRuntime = void 0;
const PHPObject_1 = require("../objects/PHPObject");
class VariablesRuntime {
    static var_dump(ctx, ...args) {
        for (const val of args) {
            if (val === null) {
                ctx.echo("NULL\n");
            }
            else if (typeof val === "boolean") {
                ctx.echo(`bool(${val})\n`);
            }
            else if (typeof val === "number") {
                if (Number.isInteger(val))
                    ctx.echo(`int(${val})\n`);
                else
                    ctx.echo(`float(${val})\n`);
            }
            else if (typeof val === "string") {
                ctx.echo(`string(${val.length}) "${val}"\n`);
            }
            else if (Array.isArray(val)) {
                ctx.echo(`array(${val.length}) {\n`);
                val.forEach((item, idx) => {
                    ctx.echo(`  [${idx}]=>\n  ${String(item)}\n`);
                });
                ctx.echo("}\n");
            }
            else if (val instanceof PHPObject_1.PHPObject) {
                ctx.echo(`object(${val.phpClass.name})#${Math.floor(Math.random() * 1000)} (${val.properties.size}) {\n`);
                val.properties.forEach((v, k) => {
                    ctx.echo(`  ["${k}"]=>\n  ${String(v)}\n`);
                });
                ctx.echo("}\n");
            }
            else {
                ctx.echo(String(val) + "\n");
            }
        }
    }
    static print_r(ctx, val, returnVal = false) {
        let str = "";
        if (val === null)
            str = "";
        else if (typeof val === "boolean")
            str = val ? "1" : "";
        else if (typeof val === "object" || Array.isArray(val)) {
            str = JSON.stringify(val, null, 4);
        }
        else {
            str = String(val);
        }
        if (returnVal)
            return str;
        ctx.echo(str);
        return true;
    }
    static is_array(val) { return Array.isArray(val); }
    static is_bool(val) { return typeof val === "boolean"; }
    static is_float(val) { return typeof val === "number" && !Number.isInteger(val); }
    static is_int(val) { return typeof val === "number" && Number.isInteger(val); }
    static is_null(val) { return val === null || val === undefined; }
    static is_numeric(val) {
        if (typeof val === "number")
            return !Number.isNaN(val);
        if (typeof val !== "string")
            return false;
        return !Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val));
    }
    static is_object(val) { return val instanceof PHPObject_1.PHPObject || (typeof val === "object" && val !== null && !Array.isArray(val)); }
    static is_scalar(val) {
        const t = typeof val;
        return t === "string" || t === "number" || t === "boolean";
    }
    static is_string(val) { return typeof val === "string"; }
    static gettype(val) {
        if (val === null || val === undefined)
            return "NULL";
        if (typeof val === "boolean")
            return "boolean";
        if (typeof val === "number")
            return Number.isInteger(val) ? "integer" : "double";
        if (typeof val === "string")
            return "string";
        if (Array.isArray(val))
            return "array";
        if (val instanceof PHPObject_1.PHPObject)
            return "object";
        return "object";
    }
    static intval(val, base = 10) {
        const p = parseInt(String(val), base);
        return Number.isNaN(p) ? 0 : p;
    }
    static floatval(val) {
        const f = parseFloat(String(val));
        return Number.isNaN(f) ? 0 : f;
    }
    static strval(val) { return String(val ?? ""); }
    static boolval(val) { return Boolean(val); }
}
exports.VariablesRuntime = VariablesRuntime;
//# sourceMappingURL=Variables.js.map