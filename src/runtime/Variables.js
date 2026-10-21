import * as crypto from "crypto";
import { serialize as serializePHP } from "php-serialize";
import { PHPError, PHPTypeError } from "./PHPError.js";
import { PHPLiteral, PHPReference } from "./PHPVariable.js";
import { SYMBOL_PHP_CLASS, SYMBOL_PHP_NAME, SYMBOL_PHP_PARENT, SYMBOL_PHP_PROPERTIES, decodePhpPropertyName } from "./Reflection.js";
export function isPlainObject(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null)
        return true;
    return !value[SYMBOL_PHP_NAME]
        && Object.prototype.toString.call(value) === "[object Object]"
        && prototype.constructor?.name === "Object";
}
export class VariablesRuntime {
    /**
     * Serializes a value into a PHP-compatible serialized string representation.
     */
    static async serialize(ctx, valueArg) {
        const value = await valueArg?.get();
        const scope = Object.create(null);
        const active = new WeakSet();
        const prepare = async (input) => {
            if (typeof input === "function")
                throw new PHPTypeError("Serialization of 'Closure' is not allowed");
            if (input === null || input === undefined)
                return null;
            if (typeof input !== "object")
                return input;
            if (input.isResource)
                return 0;
            if (active.has(input))
                throw new PHPTypeError("Recursive serialization is not supported");
            active.add(input);
            try {
                if (input && typeof input === "object") {
                    const isPhpObject = Boolean(input[SYMBOL_PHP_NAME] || (input.constructor && input.constructor !== Object && input.constructor !== Array && input.constructor[SYMBOL_PHP_NAME]));
                    if (isPhpObject) {
                        const name = input[SYMBOL_PHP_NAME] || input.constructor[SYMBOL_PHP_NAME] || "stdClass";
                        scope[name] ||= class {
                        };
                        const result = new scope[name]();
                        for (const [property, entry] of Object.entries(input)) {
                            if (property.startsWith("__"))
                                continue;
                            const cleanProp = property.startsWith("$") ? property.slice(1) : property;
                            result[cleanProp] = await prepare(entry instanceof PHPReference ? await entry.get() : entry);
                        }
                        return result;
                    }
                    if (Array.isArray(input)) {
                        return Promise.all(input.map(prepare));
                    }
                    const result = {};
                    for (const [key, entry] of Object.entries(input)) {
                        if (key.startsWith("__"))
                            continue;
                        const cleanKey = key.startsWith("$") ? key.slice(1) : key;
                        result[cleanKey] = await prepare(entry instanceof PHPReference ? await entry.get() : entry);
                    }
                    return result;
                }
            }
            finally {
                active.delete(input);
            }
        };
        return serializePHP(await prepare(value), scope);
    }
    /**
     * Dumps information about one or more variables.
     */
    static async var_dump(ctx, ...args) {
        for (const arg of args) {
            const val = await arg?.get();
            if (val === null || val === undefined) {
                await ctx.echo("NULL\n");
            }
            else if (typeof val === "boolean") {
                await ctx.echo(`bool(${val})\n`);
            }
            else if (typeof val === "number") {
                if (Number.isInteger(val))
                    await ctx.echo(`int(${val})\n`);
                else
                    await ctx.echo(`float(${val})\n`);
            }
            else if (typeof val === "string") {
                await ctx.echo(`string(${val.length}) "${val}"\n`);
            }
            else if (Array.isArray(val)) {
                await ctx.echo(`array(${val.length}) {\n`);
                for (let index = 0; index < val.length; index++) {
                    await ctx.echo(`  [${index}]=>\n  ${String(await ctx.toVal(val[index]))}\n`);
                }
                await ctx.echo("}\n");
            }
            else if (val && typeof val === "object" && val.constructor !== Object && val.constructor !== Array) {
                await ctx.echo(`object(${val[SYMBOL_PHP_NAME] || val.constructor?.[SYMBOL_PHP_NAME] || val.constructor?.name || "stdClass"})#${Math.floor(Math.random() * 1000)} (${Object.keys(val).length}) {\n`);
                for (const [key, entry] of Object.entries(val)) {
                    await ctx.echo(`  ["${key}"]=>\n  ${String(await ctx.toVal(entry))}\n`);
                }
                await ctx.echo("}\n");
            }
            else {
                await ctx.echo(String(val) + "\n");
            }
        }
    }
    /**
     * Prints human-readable information about a variable.
     */
    static async print_r(ctx, valArg, returnValArg) {
        const val = await valArg?.get();
        const returnVal = Boolean(await returnValArg?.get());
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
        await ctx.echo(str);
        return true;
    }
    static async unwrapValue(valArg) {
        let val = valArg instanceof PHPReference ? await valArg.get() : valArg;
        while (val instanceof PHPReference)
            val = await val.get();
        return val;
    }
    /** Finds whether a variable is an array. */
    static async is_array(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return Array.isArray(val) || isPlainObject(val);
    }
    /** Finds whether a variable is a boolean. */
    static async is_bool(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return typeof val === "boolean";
    }
    /** Finds whether a variable is a float. */
    static async is_float(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return typeof val === "number" && !Number.isInteger(val);
    }
    /** Finds whether a variable is an integer. */
    static async is_int(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return typeof val === "number" && Number.isInteger(val);
    }
    /** Finds whether a variable is NULL. */
    static async is_null(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return val === null || val === undefined;
    }
    /** Finds whether a variable is a number or a numeric string. */
    static async is_numeric(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        if (typeof val === "number")
            return !Number.isNaN(val);
        if (typeof val !== "string")
            return false;
        return !Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val));
    }
    /** Finds whether a variable is an object. */
    static async is_object(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return typeof val === "function" || (typeof val === "object" && val !== null && !Array.isArray(val) && !isPlainObject(val));
    }
    /** Gets the properties of the given object. */
    static async get_object_vars(ctx, valueArg) {
        const value = await VariablesRuntime.unwrapValue(valueArg);
        if (typeof value === "function")
            return {};
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new PHPTypeError("get_object_vars(): Argument #1 ($object) must be of type object");
        }
        if (value.constructor === Object) {
            const cleanObj = {};
            for (const [k, v] of Object.entries(value)) {
                if (k.startsWith("__"))
                    continue;
                const cleanKey = k.startsWith("$") ? k.slice(1) : k;
                cleanObj[cleanKey] = await VariablesRuntime.unwrapValue(v);
            }
            return cleanObj;
        }
        if (value instanceof PHPError) {
            const properties = value.phpClass?.properties || {};
            return Object.fromEntries(Object.entries(properties)
                .filter(([, metadata]) => metadata.visibility === "public" && !metadata.isStatic)
                .map(([name]) => [name, value[name]]));
        }
        let propMetaMap = null;
        let cls = value[SYMBOL_PHP_CLASS] || value.constructor;
        while (cls && cls !== Function.prototype) {
            const properties = cls[SYMBOL_PHP_PROPERTIES];
            if (properties && typeof properties === "object") {
                propMetaMap ||= Object.create(null);
                for (const [k, v] of Object.entries(properties)) {
                    if (!Object.hasOwn(propMetaMap, k)) {
                        propMetaMap[k] = v;
                    }
                }
            }
            cls = cls[SYMBOL_PHP_PARENT] || Object.getPrototypeOf(cls);
        }
        const result = {};
        for (const [k, v] of Object.entries(value)) {
            if (k.startsWith("__"))
                continue;
            const cleanKey = k.startsWith("$") ? decodePhpPropertyName(k) : k;
            if (propMetaMap) {
                const meta = propMetaMap[cleanKey];
                if (meta) {
                    if (meta.visibility !== "public" || meta.isStatic)
                        continue;
                }
            }
            result[cleanKey] = await VariablesRuntime.unwrapValue(v);
        }
        return result;
    }
    /** Finds whether a variable is a scalar. */
    static async is_scalar(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        const t = typeof val;
        return t === "string" || t === "number" || t === "boolean";
    }
    /** Finds whether a variable is a string. */
    static async is_string(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return typeof val === "string";
    }
    /** Verify that the contents of a variable is an iterable value. */
    static async is_iterable(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return Array.isArray(val) || (val && typeof val === "object");
    }
    /** Verify that the contents of a variable is a countable value. */
    static async is_countable(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return Array.isArray(val) || typeof val === "string";
    }
    /** Finds whether a variable is a resource. */
    static async is_resource(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return val && typeof val === "object" && Boolean(val.isResource);
    }
    /** Get the type of a variable. */
    static async gettype(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
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
        if (val && typeof val === "object" && val.constructor !== Object && val.constructor !== Array)
            return "object";
        return "object";
    }
    /** Returns the name of the class of an object. */
    static async get_class(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        if (!val || typeof val !== "object")
            return false;
        if (val[SYMBOL_PHP_NAME])
            return val[SYMBOL_PHP_NAME];
        if (val.constructor && val.constructor[SYMBOL_PHP_NAME]) {
            return val.constructor[SYMBOL_PHP_NAME];
        }
        const name = val.constructor?.name || "";
        return name.startsWith("__cls_") ? name.slice(6) : name || "stdClass";
    }
    /** Gets a prefixed unique identifier based on the current time in microseconds. */
    static async uniqid(ctx, prefixArg, moreEntropyArg) {
        const prefix = String(await VariablesRuntime.unwrapValue(prefixArg) ?? "");
        const moreEntropy = Boolean(await VariablesRuntime.unwrapValue(moreEntropyArg));
        const timestamp = Date.now().toString(16);
        const entropy = crypto.randomBytes(moreEntropy ? 8 : 4).toString("hex");
        return `${prefix}${timestamp}${entropy}`;
    }
    /** Get the integer value of a variable. */
    static async intval(ctx, valArg, baseArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        const base = Number(await VariablesRuntime.unwrapValue(baseArg)) || 10;
        const p = parseInt(String(val ?? 0), base);
        return Number.isNaN(p) ? 0 : p;
    }
    /** Get float value of a variable. */
    static async floatval(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        const f = parseFloat(String(val ?? 0));
        return Number.isNaN(f) ? 0 : f;
    }
    /** Get string value of a variable. */
    static async strval(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return String(val ?? "");
    }
    /** Get the boolean value of a variable. */
    static async boolval(ctx, valArg) {
        const val = await VariablesRuntime.unwrapValue(valArg);
        return Boolean(val);
    }
    static async getenv(ctx, varnameArg) {
        const varname = await VariablesRuntime.unwrapValue(varnameArg);
        if (varname === undefined || varname === null) {
            return ctx.env || process.env;
        }
        const name = String(varname);
        const val = (ctx.env && ctx.env[name]) ?? (ctx.env && ctx.env[name.toUpperCase()]) ?? process.env[name] ?? process.env[name.toUpperCase()];
        return val !== undefined ? val : false;
    }
    static async compact(ctx, ...args) {
        const result = {};
        const processName = async (name) => {
            const val = await ctx.getVar(name);
            if (val !== undefined) {
                result[name] = val;
            }
        };
        for (const arg of args) {
            const val = await arg?.get();
            if (typeof val === "string") {
                await processName(val);
            }
            else if (Array.isArray(val)) {
                for (const item of val) {
                    if (typeof item === "string")
                        await processName(item);
                }
            }
        }
        return result;
    }
    static async extract(ctx, arrayArg) {
        const array = await arrayArg?.get();
        if (!array || typeof array !== "object")
            return 0;
        let count = 0;
        for (const [k, v] of Object.entries(array)) {
            await ctx.setVar(k, v);
            count++;
        }
        return count;
    }
    static async var_export(ctx, valArg, returnArg, ...args) {
        const depth = typeof args[0] === "number" ? args[0] : 0;
        if (depth > 5)
            return "'...'";
        const val = await VariablesRuntime.unwrapValue(valArg);
        const returnVal = await VariablesRuntime.unwrapValue(returnArg);
        const isReturn = Boolean(returnVal);
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
            const keys = Object.keys(val);
            const isPureIndexed = keys.length === val.length && keys.every((k, i) => k === String(i));
            if (isPureIndexed) {
                const items = [];
                for (let i = 0; i < val.length; i++) {
                    items.push(`${i} => ${await VariablesRuntime.var_export(ctx, new PHPLiteral(val[i]), new PHPLiteral(true), depth + 1)}`);
                }
                str = "array (\n  " + items.join(",\n  ") + ",\n)";
            }
            else {
                const items = [];
                for (const k of keys) {
                    const formattedKey = /^(0|[1-9]\d*)$/.test(k) ? k : `'${k}'`;
                    items.push(`${formattedKey} => ${await VariablesRuntime.var_export(ctx, new PHPLiteral(val[k]), new PHPLiteral(true), depth + 1)}`);
                }
                str = "array (\n  " + items.join(",\n  ") + "\n)";
            }
        }
        else if (val && typeof val === "object") {
            const className = val[SYMBOL_PHP_NAME] || val.constructor?.[SYMBOL_PHP_NAME] || val.constructor?.name || "stdClass";
            const items = [];
            for (const [k, v] of Object.entries(val)) {
                if (!k.startsWith("__")) {
                    const entry = await VariablesRuntime.unwrapValue(v);
                    items.push(`'${k}' => ${await VariablesRuntime.var_export(ctx, new PHPLiteral(entry), new PHPLiteral(true), depth + 1)}`);
                }
            }
            str = `${className}::__set_state(array(\n  ` + items.join(",\n  ") + "\n))";
        }
        else {
            str = String(val);
        }
        if (returnVal)
            return str;
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
    static register(engine) {
        engine.registerFunctions(VariablesRuntime.functions);
    }
}
//# sourceMappingURL=Variables.js.map