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
    static in_array(needle, haystack, strict = false) {
        if (!haystack)
            return false;
        const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
        if (strict) {
            return values.includes(needle);
        }
        return values.some((v) => v == needle);
    }
}
exports.ArrayRuntime = ArrayRuntime;
//# sourceMappingURL=Arrays.js.map