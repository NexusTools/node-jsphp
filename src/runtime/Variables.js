"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariablesRuntime = void 0;
const crypto = __importStar(require("crypto"));
const php_serialize_1 = require("php-serialize");
const PHPObject_1 = require("./PHPObject");
const PHPError_1 = require("./PHPError");
class VariablesRuntime {
    static register(engine) {
        const register = engine.registerFunction.bind(engine);
        register("var_dump", (ctx, ...args) => VariablesRuntime.var_dump(ctx, ...args));
        register("print_r", (ctx, value, returnValue = false) => VariablesRuntime.print_r(ctx, value, returnValue));
        register("is_array", (ctx, value) => VariablesRuntime.is_array(value));
        register("is_bool", (ctx, value) => VariablesRuntime.is_bool(value));
        register("is_float", (ctx, value) => VariablesRuntime.is_float(value));
        register("is_int", (ctx, value) => VariablesRuntime.is_int(value));
        register("is_null", (ctx, value) => VariablesRuntime.is_null(value));
        register("is_numeric", (ctx, value) => VariablesRuntime.is_numeric(value));
        register("is_object", (ctx, value) => VariablesRuntime.is_object(value));
        register("is_scalar", (ctx, value) => VariablesRuntime.is_scalar(value));
        register("is_string", (ctx, value) => VariablesRuntime.is_string(value));
        register("is_iterable", (ctx, value) => Array.isArray(value) || (value && typeof value === "object"));
        register("is_countable", (ctx, value) => Array.isArray(value) || typeof value === "string");
        register("is_resource", (ctx, value) => value && typeof value === "object" && Boolean(value.isResource));
        register("gettype", (ctx, value) => VariablesRuntime.gettype(value));
        register("get_class", (ctx, value) => value?.phpClass?.name || value?.constructor?.name || false);
        register("get_object_vars", (ctx, value) => VariablesRuntime.get_object_vars(value));
        register("serialize", (ctx, value) => VariablesRuntime.serialize(value));
        register("uniqid", (ctx, prefix = "", moreEntropy = false) => {
            const timestamp = Date.now().toString(16);
            const entropy = crypto.randomBytes(moreEntropy ? 8 : 4).toString("hex");
            return `${prefix}${timestamp}${entropy}`;
        });
        register("intval", (ctx, value, base = 10) => VariablesRuntime.intval(value, base));
        register("floatval", (ctx, value) => VariablesRuntime.floatval(value));
        register("strval", (ctx, value) => VariablesRuntime.strval(value));
        register("boolval", (ctx, value) => VariablesRuntime.boolval(value));
    }
    static serialize(value) {
        const scope = Object.create(null);
        const active = new WeakSet();
        const prepare = (input) => {
            if (typeof input === "function")
                throw new PHPError_1.PHPTypeError("Serialization of 'Closure' is not allowed");
            if (input === null || input === undefined)
                return null;
            if (typeof input !== "object")
                return input;
            if (input.isResource)
                return 0;
            if (active.has(input))
                throw new PHPError_1.PHPTypeError("Recursive serialization is not supported");
            active.add(input);
            try {
                if (input instanceof PHPObject_1.PHPObject) {
                    const name = input.phpClass.name;
                    scope[name] ||= class {
                    };
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
            }
            finally {
                active.delete(input);
            }
        };
        return (0, php_serialize_1.serialize)(prepare(value), scope);
    }
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
    static is_object(val) { return typeof val === "function" || val instanceof PHPObject_1.PHPObject || (typeof val === "object" && val !== null && !Array.isArray(val)); }
    static get_object_vars(value) {
        if (value instanceof PHPObject_1.PHPObject) {
            return Object.fromEntries([...value.properties].filter(([name]) => {
                const metadata = value.phpClass.properties.get(name);
                return !metadata || metadata.visibility === "public";
            }));
        }
        if (value instanceof PHPError_1.PHPError) {
            const properties = value.phpClass?.properties || new Map();
            return Object.fromEntries([...properties]
                .filter(([, metadata]) => metadata.visibility === "public" && !metadata.isStatic)
                .map(([name]) => [name, value[name]]));
        }
        if (typeof value === "function")
            return {};
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new PHPError_1.PHPTypeError("get_object_vars(): Argument #1 ($object) must be of type object");
        }
        return { ...value };
    }
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