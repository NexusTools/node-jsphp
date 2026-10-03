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
const PHPVariable_1 = require("./PHPVariable");
class VariablesRuntime {
    /**
     * Serializes a value into a PHP-compatible serialized string representation.
     */
    static serialize(ctx, valueArg) {
        const value = valueArg?.get();
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
    /**
     * Dumps information about one or more variables.
     */
    static var_dump(ctx, ...args) {
        for (const arg of args) {
            const val = arg?.get();
            if (val === null || val === undefined) {
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
    /**
     * Prints human-readable information about a variable.
     */
    static print_r(ctx, valArg, returnValArg) {
        const val = valArg?.get();
        const returnVal = Boolean(returnValArg?.get());
        let str = "";
        if (val === null || val === undefined)
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
    /** Finds whether a variable is an array. */
    static is_array(ctx, valArg) { return Array.isArray(valArg?.get()); }
    /** Finds whether a variable is a boolean. */
    static is_bool(ctx, valArg) { return typeof valArg?.get() === "boolean"; }
    /** Finds whether a variable is a float. */
    static is_float(ctx, valArg) {
        const val = valArg?.get();
        return typeof val === "number" && !Number.isInteger(val);
    }
    /** Finds whether a variable is an integer. */
    static is_int(ctx, valArg) {
        const val = valArg?.get();
        return typeof val === "number" && Number.isInteger(val);
    }
    /** Finds whether a variable is NULL. */
    static is_null(ctx, valArg) {
        const val = valArg?.get();
        return val === null || val === undefined;
    }
    /** Finds whether a variable is a number or a numeric string. */
    static is_numeric(ctx, valArg) {
        const val = valArg?.get();
        if (typeof val === "number")
            return !Number.isNaN(val);
        if (typeof val !== "string")
            return false;
        return !Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val));
    }
    /** Finds whether a variable is an object. */
    static is_object(ctx, valArg) {
        const val = valArg?.get();
        return typeof val === "function" || val instanceof PHPObject_1.PHPObject || (typeof val === "object" && val !== null && !Array.isArray(val));
    }
    /** Gets the properties of the given object. */
    static get_object_vars(ctx, valueArg) {
        const value = valueArg?.get();
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
    /** Finds whether a variable is a scalar. */
    static is_scalar(ctx, valArg) {
        const val = valArg?.get();
        const t = typeof val;
        return t === "string" || t === "number" || t === "boolean";
    }
    /** Finds whether a variable is a string. */
    static is_string(ctx, valArg) { return typeof valArg?.get() === "string"; }
    /** Verify that the contents of a variable is an iterable value. */
    static is_iterable(ctx, valArg) {
        const val = valArg?.get();
        return Array.isArray(val) || (val && typeof val === "object");
    }
    /** Verify that the contents of a variable is a countable value. */
    static is_countable(ctx, valArg) {
        const val = valArg?.get();
        return Array.isArray(val) || typeof val === "string";
    }
    /** Finds whether a variable is a resource. */
    static is_resource(ctx, valArg) {
        const val = valArg?.get();
        return val && typeof val === "object" && Boolean(val.isResource);
    }
    /** Get the type of a variable. */
    static gettype(ctx, valArg) {
        const val = valArg?.get();
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
    /** Returns the name of the class of an object. */
    static get_class(ctx, valArg) {
        const val = valArg?.get();
        return val?.phpClass?.name || val?.constructor?.name || false;
    }
    /** Gets a prefixed unique identifier based on the current time in microseconds. */
    static uniqid(ctx, prefixArg, moreEntropyArg) {
        const prefix = String(prefixArg?.get() ?? "");
        const moreEntropy = Boolean(moreEntropyArg?.get());
        const timestamp = Date.now().toString(16);
        const entropy = crypto.randomBytes(moreEntropy ? 8 : 4).toString("hex");
        return `${prefix}${timestamp}${entropy}`;
    }
    /** Get the integer value of a variable. */
    static intval(ctx, valArg, baseArg) {
        const val = valArg?.get();
        const base = Number(baseArg?.get()) || 10;
        const p = parseInt(String(val ?? 0), base);
        return Number.isNaN(p) ? 0 : p;
    }
    /** Get float value of a variable. */
    static floatval(ctx, valArg) {
        const f = parseFloat(String(valArg?.get() ?? 0));
        return Number.isNaN(f) ? 0 : f;
    }
    /** Get string value of a variable. */
    static strval(ctx, valArg) {
        return String(valArg?.get() ?? "");
    }
    /** Get the boolean value of a variable. */
    static boolval(ctx, valArg) {
        return Boolean(valArg?.get());
    }
    static compact(ctx, ...args) {
        const result = {};
        const processName = (name) => {
            const val = ctx.getVar(name);
            if (val !== undefined) {
                result[name] = val;
            }
        };
        for (const arg of args) {
            const val = arg?.get();
            if (typeof val === "string") {
                processName(val);
            }
            else if (Array.isArray(val)) {
                for (const item of val) {
                    if (typeof item === "string")
                        processName(item);
                }
            }
        }
        return result;
    }
    static extract(ctx, arrayArg) {
        const array = arrayArg?.get();
        if (!array || typeof array !== "object")
            return 0;
        let count = 0;
        for (const [k, v] of Object.entries(array)) {
            ctx.setVar(k, v);
            count++;
        }
        return count;
    }
    static var_export(ctx, valArg, returnArg) {
        const val = valArg?.get();
        const returnVal = Boolean(returnArg?.get());
        let str = "";
        if (val === null || val === undefined)
            str = "NULL";
        else if (typeof val === "boolean")
            str = val ? "true" : "false";
        else if (typeof val === "number")
            str = String(val);
        else if (typeof val === "string")
            str = "'" + val.replace(/'/g, "\\'") + "'";
        else if (Array.isArray(val)) {
            const items = val.map((v, i) => `${i} => ${VariablesRuntime.var_export(ctx, new PHPVariable_1.PHPLiteral(v), new PHPVariable_1.PHPLiteral(true))}`);
            str = "array (\n  " + items.join(",\n  ") + ",\n)";
        }
        else if (val instanceof PHPObject_1.PHPObject) {
            const items = Array.from(val.properties.entries()).map(([k, v]) => `'${k}' => ${VariablesRuntime.var_export(ctx, new PHPVariable_1.PHPLiteral(v), new PHPVariable_1.PHPLiteral(true))}`);
            str = `${val.phpClass.name}::__set_state(array(\n  ` + items.join(",\n  ") + "\n))";
        }
        else if (typeof val === "object") {
            const items = Object.entries(val).map(([k, v]) => `'${k}' => ${VariablesRuntime.var_export(ctx, new PHPVariable_1.PHPLiteral(v), new PHPVariable_1.PHPLiteral(true))}`);
            str = "array (\n  " + items.join(",\n  ") + ",\n)";
        }
        else {
            str = String(val);
        }
        if (returnVal)
            return str;
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
    static register(engine) {
        engine.registerFunctions(VariablesRuntime.functions);
    }
}
exports.VariablesRuntime = VariablesRuntime;
//# sourceMappingURL=Variables.js.map