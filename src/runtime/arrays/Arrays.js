"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrayRuntime = void 0;
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
        if (!Array.isArray(array))
            return [];
        return Array.from(new Set(array));
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
}
exports.ArrayRuntime = ArrayRuntime;
//# sourceMappingURL=Arrays.js.map