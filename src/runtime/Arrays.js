"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrayRuntime = void 0;
const PHPError_1 = require("./PHPError");
class ArrayRuntime {
    static count(arrayOrCountable) {
        if (!arrayOrCountable)
            return 0;
        if (Array.isArray(arrayOrCountable))
            return arrayOrCountable.length;
        if (typeof arrayOrCountable === "object")
            return Object.keys(arrayOrCountable).length;
        return 1;
    }
    static array_keys(input) {
        if (!input || typeof input !== "object")
            return [];
        if (Array.isArray(input))
            return input.map((_, i) => i);
        return Object.keys(input);
    }
    static array_values(input) {
        if (!input || typeof input !== "object")
            return [];
        if (Array.isArray(input))
            return [...input];
        return Object.values(input);
    }
    static array_flip(input) {
        const res = {};
        if (!input || typeof input !== "object")
            return res;
        for (const [k, v] of Object.entries(input)) {
            res[String(v)] = k;
        }
        return res;
    }
    static array_reverse(array) {
        if (!Array.isArray(array))
            return [];
        return [...array].reverse();
    }
    static in_array(needle, haystack, strict = false) {
        if (!haystack)
            return false;
        const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
        if (strict) {
            return values.includes(needle);
        }
        return values.some((v) => v == needle);
    }
    static array_search(needle, haystack, strict = false) {
        if (!haystack || typeof haystack !== "object")
            return false;
        const entries = Array.isArray(haystack)
            ? haystack.map((v, i) => [i, v])
            : Object.entries(haystack);
        for (const [k, v] of entries) {
            if (strict ? v === needle : v == needle) {
                return k;
            }
        }
        return false;
    }
    static array_key_exists(key, search) {
        if (!search || typeof search !== "object")
            return false;
        return key in search;
    }
    static array_merge(...arrays) {
        if (arrays.every((a) => Array.isArray(a))) {
            return [].concat(...arrays);
        }
        const result = {};
        for (const arr of arrays) {
            if (arr && typeof arr === "object") {
                Object.assign(result, arr);
            }
        }
        return result;
    }
    static array_combine(keys, values) {
        if (!Array.isArray(keys) || !Array.isArray(values) || keys.length !== values.length) {
            return false;
        }
        const res = {};
        keys.forEach((k, i) => {
            res[String(k)] = values[i];
        });
        return res;
    }
    static array_fill(startIndex, count, value) {
        if (count < 0)
            throw new PHPError_1.PHPFatalError("array_fill(): Argument #2 ($count) must be greater than or equal to 0");
        if (count === 0 || startIndex === 0)
            return Array.from({ length: count }, () => value);
        const result = {};
        for (let offset = 0; offset < count; offset++)
            result[startIndex + offset] = value;
        return result;
    }
    static array_fill_keys(keys, value) {
        const result = {};
        if (!keys || typeof keys !== "object")
            return result;
        for (const key of Array.isArray(keys) ? keys : Object.values(keys)) {
            result[String(key)] = value;
        }
        return result;
    }
    static array_intersect(array, ...others) {
        if (!array || typeof array !== "object")
            return [];
        const values = others.map((other) => new Set(Object.values(other || {})));
        if (values.length === 0)
            return Array.isArray(array) ? [...array] : { ...array };
        const result = Array.isArray(array) ? [] : {};
        for (const [key, value] of Object.entries(array)) {
            if (values.every((set) => Array.from(set).some((candidate) => candidate == value))) {
                if (Array.isArray(result))
                    result.push(value);
                else
                    result[key] = value;
            }
        }
        return result;
    }
    static array_slice(array, offset, length) {
        if (!Array.isArray(array))
            return [];
        if (length !== undefined) {
            return array.slice(offset, offset + length);
        }
        return array.slice(offset);
    }
    static array_push(array, ...varargs) {
        if (!Array.isArray(array))
            return 0;
        array.push(...varargs);
        return array.length;
    }
    static array_pop(array) {
        if (!Array.isArray(array))
            return null;
        return array.pop();
    }
    static array_shift(array) {
        if (!Array.isArray(array))
            return null;
        return array.shift();
    }
    static array_unshift(array, ...varargs) {
        if (!Array.isArray(array))
            return 0;
        array.unshift(...varargs);
        return array.length;
    }
    static array_unique(array) {
        if (!array || typeof array !== "object") {
            return Array.isArray(array) ? [] : {};
        }
        if (Array.isArray(array)) {
            return Array.from(new Set(array));
        }
        const res = {};
        const seen = new Set();
        for (const [k, v] of Object.entries(array)) {
            if (!seen.has(v)) {
                seen.add(v);
                res[k] = v;
            }
        }
        return res;
    }
    static array_column(array, columnKey) {
        if (!Array.isArray(array))
            return [];
        return array.map((item) => item?.[columnKey]).filter((v) => v !== undefined);
    }
    static sort(array) {
        if (!Array.isArray(array))
            return false;
        array.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
        return true;
    }
    static rsort(array) {
        if (!Array.isArray(array))
            return false;
        array.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
        return true;
    }
    static ksort(array, flags = 0) {
        if (!array || typeof array !== "object")
            return false;
        const entries = Object.entries(array).sort(([left], [right]) => {
            if (flags === 1)
                return left.localeCompare(right);
            const leftNumber = Number(left);
            const rightNumber = Number(right);
            if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber))
                return leftNumber - rightNumber;
            return left.localeCompare(right);
        });
        for (const key of Object.keys(array))
            delete array[key];
        for (const [key, value] of entries)
            array[key] = value;
        return true;
    }
    static async array_map(ctx, callback, ...arrays) {
        if (!callback)
            return arrays[0] || [];
        const arr = arrays[0] || [];
        const keys = Array.isArray(arr) ? arr.map((_, i) => i) : Object.keys(arr);
        const res = [];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const args = arrays.map((a) => (Array.isArray(a) ? a[i] : a[key]));
            let mapped;
            if (typeof callback === "function") {
                mapped = await callback.apply(ctx, args);
            }
            else if (typeof callback === "string") {
                mapped = await ctx.callFunction(callback, args);
            }
            else if (Array.isArray(callback) && callback.length === 2) {
                mapped = await ctx.callMethod(callback[0], callback[1], args);
            }
            else {
                mapped = args[0];
            }
            res.push(mapped);
        }
        return res;
    }
    static async array_filter(ctx, array, callback, mode = 0) {
        if (!array || typeof array !== "object")
            return Array.isArray(array) ? [] : {};
        const isArr = Array.isArray(array);
        const result = isArr ? [] : {};
        const entries = isArr ? array.map((v, i) => [i, v]) : Object.entries(array);
        for (const [k, v] of entries) {
            let keep = false;
            if (!callback) {
                keep = Boolean(v);
            }
            else {
                const args = mode === 1 ? [k] : mode === 2 ? [v, k] : [v];
                if (typeof callback === "function") {
                    keep = Boolean(await callback.apply(ctx, args));
                }
                else if (typeof callback === "string") {
                    keep = Boolean(await ctx.callFunction(callback, args));
                }
                else if (Array.isArray(callback) && callback.length === 2) {
                    keep = Boolean(await ctx.callMethod(callback[0], callback[1], args));
                }
            }
            if (keep) {
                if (isArr)
                    result.push(v);
                else
                    result[String(k)] = v;
            }
        }
        return result;
    }
    static array_key_first(array) {
        if (!array || typeof array !== "object")
            return null;
        if (Array.isArray(array))
            return array.length > 0 ? 0 : null;
        const keys = Object.keys(array);
        return keys.length > 0 ? keys[0] : null;
    }
    static array_key_last(array) {
        if (!array || typeof array !== "object")
            return null;
        if (Array.isArray(array))
            return array.length > 0 ? array.length - 1 : null;
        const keys = Object.keys(array);
        return keys.length > 0 ? keys[keys.length - 1] : null;
    }
    static register(engine) {
        const register = engine.registerFunction.bind(engine);
        register("count", (ctx, value) => ArrayRuntime.count(value));
        register("sizeof", (ctx, value) => ArrayRuntime.count(value));
        register("array_keys", (ctx, value) => ArrayRuntime.array_keys(value));
        register("array_values", (ctx, value) => ArrayRuntime.array_values(value));
        register("array_flip", (ctx, value) => ArrayRuntime.array_flip(value));
        register("array_reverse", (ctx, value) => ArrayRuntime.array_reverse(value));
        register("in_array", (ctx, needle, haystack, strict = false) => ArrayRuntime.in_array(needle, haystack, strict));
        register("array_search", (ctx, needle, haystack, strict = false) => ArrayRuntime.array_search(needle, haystack, strict));
        register("array_key_exists", (ctx, key, value) => ArrayRuntime.array_key_exists(key, value));
        register("key_exists", (ctx, key, value) => ArrayRuntime.array_key_exists(key, value));
        register("array_merge", (ctx, ...values) => ArrayRuntime.array_merge(...values));
        register("array_combine", (ctx, keys, values) => ArrayRuntime.array_combine(keys, values));
        register("array_fill_keys", (ctx, keys, value) => ArrayRuntime.array_fill_keys(keys, value));
        register("array_fill", (ctx, start, count, value) => ArrayRuntime.array_fill(start, count, value));
        register("array_intersect", (ctx, value, ...others) => ArrayRuntime.array_intersect(value, ...others));
        register("array_slice", (ctx, value, offset, length) => ArrayRuntime.array_slice(value, offset, length));
        register("array_push", (ctx, value, ...items) => ArrayRuntime.array_push(value, ...items));
        register("array_pop", (ctx, value) => ArrayRuntime.array_pop(value));
        register("array_shift", (ctx, value) => ArrayRuntime.array_shift(value));
        register("array_unshift", (ctx, value, ...items) => ArrayRuntime.array_unshift(value, ...items));
        register("array_unique", (ctx, value) => ArrayRuntime.array_unique(value));
        register("array_column", (ctx, value, column) => ArrayRuntime.array_column(value, column));
        register("sort", (ctx, value) => ArrayRuntime.sort(value));
        register("rsort", (ctx, value) => ArrayRuntime.rsort(value));
        register("ksort", (ctx, value, flags = 0) => ArrayRuntime.ksort(value, flags));
        register("array_map", async (ctx, callback, ...values) => ArrayRuntime.array_map(ctx, callback, ...values));
        register("array_filter", async (ctx, value, callback, mode = 0) => ArrayRuntime.array_filter(ctx, value, callback, mode));
        register("array_key_first", (ctx, value) => ArrayRuntime.array_key_first(value));
        register("array_key_last", (ctx, value) => ArrayRuntime.array_key_last(value));
    }
}
exports.ArrayRuntime = ArrayRuntime;
//# sourceMappingURL=Arrays.js.map