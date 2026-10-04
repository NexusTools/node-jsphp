import { PHPFatalError } from "./PHPError.js";
import { PHPLiteral } from "./PHPVariable.js";
export class ArrayRuntime {
    static count(ctx, arrayOrCountableArg) {
        const arrayOrCountable = arrayOrCountableArg?.get();
        if (!arrayOrCountable)
            return 0;
        if (Array.isArray(arrayOrCountable))
            return arrayOrCountable.length;
        if (typeof arrayOrCountable === "object")
            return Object.keys(arrayOrCountable).length;
        return 1;
    }
    static array_keys(ctx, inputArg) {
        const input = inputArg?.get();
        if (!input || typeof input !== "object")
            return [];
        if (Array.isArray(input))
            return input.map((_, i) => i);
        return Object.keys(input);
    }
    static array_values(ctx, inputArg) {
        const input = inputArg?.get();
        if (!input || typeof input !== "object")
            return [];
        if (Array.isArray(input))
            return [...input];
        return Object.values(input);
    }
    static array_flip(ctx, inputArg) {
        const input = inputArg?.get();
        const res = {};
        if (!input || typeof input !== "object")
            return res;
        for (const [k, v] of Object.entries(input)) {
            res[String(v)] = k;
        }
        return res;
    }
    static array_reverse(ctx, arrayArg) {
        const array = arrayArg?.get();
        if (!Array.isArray(array))
            return [];
        return [...array].reverse();
    }
    static in_array(ctx, needleArg, haystackArg, strictArg) {
        const needle = needleArg?.get();
        const haystack = haystackArg?.get();
        const strict = Boolean(strictArg?.get());
        if (!haystack)
            return false;
        const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
        if (strict) {
            return values.includes(needle);
        }
        return values.some((v) => v == needle);
    }
    static array_search(ctx, needleArg, haystackArg, strictArg) {
        const needle = needleArg?.get();
        const haystack = haystackArg?.get();
        const strict = Boolean(strictArg?.get());
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
    static array_key_exists(ctx, keyArg, searchArg) {
        const key = keyArg?.get();
        const search = searchArg?.get();
        if (!search || typeof search !== "object")
            return false;
        return key in search;
    }
    static array_merge(ctx, ...arraysArgs) {
        const arrays = arraysArgs.map((a) => a?.get());
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
    static array_combine(ctx, keysArg, valuesArg) {
        const keys = keysArg?.get();
        const values = valuesArg?.get();
        if (!Array.isArray(keys) || !Array.isArray(values) || keys.length !== values.length) {
            return false;
        }
        const res = {};
        keys.forEach((k, i) => {
            res[String(k)] = values[i];
        });
        return res;
    }
    static array_fill(ctx, startIndexArg, countArg, valueArg) {
        const startIndex = Number(startIndexArg?.get()) || 0;
        const count = Number(countArg?.get()) || 0;
        const value = valueArg?.get();
        if (count < 0)
            throw new PHPFatalError("array_fill(): Argument #2 ($count) must be greater than or equal to 0");
        if (count === 0 || startIndex === 0)
            return Array.from({ length: count }, () => value);
        const result = {};
        for (let offset = 0; offset < count; offset++)
            result[startIndex + offset] = value;
        return result;
    }
    static array_fill_keys(ctx, keysArg, valueArg) {
        const keys = keysArg?.get();
        const value = valueArg?.get();
        const result = {};
        if (!keys || typeof keys !== "object")
            return result;
        for (const key of Array.isArray(keys) ? keys : Object.values(keys)) {
            result[String(key)] = value;
        }
        return result;
    }
    static array_intersect(ctx, arrayArg, ...othersArgs) {
        const array = arrayArg?.get();
        const others = othersArgs.map((a) => a?.get());
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
    static array_diff(ctx, arrayArg, ...othersArgs) {
        const array = arrayArg?.get();
        const others = othersArgs.map((a) => a?.get());
        if (!array || typeof array !== "object")
            return Array.isArray(array) ? [] : {};
        const values = others.map((other) => new Set(Object.values(other || {}).map(String)));
        const isArr = Array.isArray(array);
        const result = isArr ? [] : {};
        for (const [key, value] of Object.entries(array)) {
            if (!values.some((set) => set.has(String(value)))) {
                if (isArr)
                    result.push(value);
                else
                    result[key] = value;
            }
        }
        return result;
    }
    static array_intersect_key(ctx, arrayArg, ...othersArgs) {
        const array = arrayArg?.get();
        const others = othersArgs.map((a) => a?.get());
        if (!array || typeof array !== "object")
            return Array.isArray(array) ? [] : {};
        const keySets = others.map((other) => new Set(Object.keys(other || {}).map(String)));
        const isArr = Array.isArray(array);
        const result = isArr ? [] : {};
        for (const [k, v] of Object.entries(array)) {
            if (keySets.every((set) => set.has(String(k)))) {
                if (isArr)
                    result.push(v);
                else
                    result[String(k)] = v;
            }
        }
        return result;
    }
    static array_diff_key(ctx, arrayArg, ...othersArgs) {
        const array = arrayArg?.get();
        const others = othersArgs.map((a) => a?.get());
        if (!array || typeof array !== "object")
            return Array.isArray(array) ? [] : {};
        const keySets = others.map((other) => new Set(Object.keys(other || {}).map(String)));
        const isArr = Array.isArray(array);
        const result = isArr ? [] : {};
        for (const [k, v] of Object.entries(array)) {
            if (!keySets.some((set) => set.has(String(k)))) {
                if (isArr)
                    result.push(v);
                else
                    result[String(k)] = v;
            }
        }
        return result;
    }
    static array_slice(ctx, arrayArg, offsetArg, lengthArg) {
        const array = arrayArg?.get();
        const offset = Number(offsetArg?.get()) || 0;
        const length = lengthArg?.get() !== undefined ? Number(lengthArg.get()) : undefined;
        if (!Array.isArray(array))
            return [];
        if (length !== undefined) {
            return array.slice(offset, offset + length);
        }
        return array.slice(offset);
    }
    static array_change_key_case(ctx, arrayArg, caseArg) {
        const array = arrayArg?.get();
        if (!array || typeof array !== "object")
            return null;
        const toUpper = Number(caseArg?.get()) === 1;
        const res = {};
        for (const [k, v] of Object.entries(array)) {
            const newKey = toUpper ? String(k).toUpperCase() : String(k).toLowerCase();
            res[newKey] = v;
        }
        return res;
    }
    static array_push(ctx, arrayArg, ...varargsArgs) {
        const array = arrayArg?.get();
        const varargs = varargsArgs.map((a) => a?.get());
        if (!Array.isArray(array))
            return 0;
        array.push(...varargs);
        return array.length;
    }
    static array_pop(ctx, arrayArg) {
        const array = arrayArg?.get();
        if (!Array.isArray(array))
            return null;
        return array.pop();
    }
    static array_shift(ctx, arrayArg) {
        const array = arrayArg?.get();
        if (!Array.isArray(array))
            return null;
        return array.shift();
    }
    static array_unshift(ctx, arrayArg, ...varargsArgs) {
        const array = arrayArg?.get();
        const varargs = varargsArgs.map((a) => a?.get());
        if (!Array.isArray(array))
            return 0;
        array.unshift(...varargs);
        return array.length;
    }
    static array_unique(ctx, arrayArg) {
        const array = arrayArg?.get();
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
    static array_column(ctx, arrayArg, columnKeyArg) {
        const array = arrayArg?.get();
        const columnKey = columnKeyArg?.get();
        if (!Array.isArray(array))
            return [];
        return array.map((item) => item?.[columnKey]).filter((v) => v !== undefined);
    }
    static sort(ctx, arrayArg) {
        const array = arrayArg?.get();
        if (!Array.isArray(array))
            return false;
        array.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
        return true;
    }
    static rsort(ctx, arrayArg) {
        const array = arrayArg?.get();
        if (!Array.isArray(array))
            return false;
        array.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
        return true;
    }
    static ksort(ctx, arrayArg, flagsArg) {
        const array = arrayArg?.get();
        const flags = Number(flagsArg?.get()) || 0;
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
    static async array_map(ctx, callbackArg, ...arraysArgs) {
        const callback = callbackArg?.get();
        const arrays = arraysArgs.map((a) => a?.get());
        if (!callback)
            return arrays[0] || [];
        const arr = arrays[0] || [];
        const isArr = Array.isArray(arr);
        const keys = isArr ? arr.map((_, i) => i) : Object.keys(arr);
        const res = isArr ? [] : {};
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const args = arrays.map((a) => (Array.isArray(a) ? a[i] : a[key]));
            const wrapArgs = args.map((a) => (a && typeof a === "object" && typeof a.get === "function" ? a : new PHPLiteral(a)));
            let mapped;
            if (typeof callback === "function") {
                mapped = await callback.apply(ctx, [ctx, ...wrapArgs]);
            }
            else if (typeof callback === "string") {
                mapped = await ctx.callFunction(callback, wrapArgs);
            }
            else if (Array.isArray(callback) && callback.length === 2) {
                mapped = await ctx.callMethod(callback[0], callback[1], wrapArgs);
            }
            else {
                mapped = args[0];
            }
            if (isArr) {
                res.push(mapped);
            }
            else {
                res[String(key)] = mapped;
            }
        }
        return res;
    }
    static async array_filter(ctx, arrayArg, callbackArg, modeArg) {
        const array = arrayArg?.get();
        const callback = callbackArg?.get();
        const mode = Number(modeArg?.get()) || 0;
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
                const args = mode === 1 ? [new PHPLiteral(k)] : mode === 2 ? [new PHPLiteral(v), new PHPLiteral(k)] : [new PHPLiteral(v)];
                if (typeof callback === "function") {
                    keep = Boolean(await callback.apply(ctx, [ctx, ...args]));
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
    static array_key_first(ctx, arrayArg) {
        const array = arrayArg?.get();
        if (!array || typeof array !== "object")
            return null;
        if (Array.isArray(array))
            return array.length > 0 ? 0 : null;
        const keys = Object.keys(array);
        return keys.length > 0 ? keys[0] : null;
    }
    static array_key_last(ctx, arrayArg) {
        const array = arrayArg?.get();
        if (!array || typeof array !== "object")
            return null;
        if (Array.isArray(array))
            return array.length > 0 ? array.length - 1 : null;
        const keys = Object.keys(array);
        return keys.length > 0 ? keys[keys.length - 1] : null;
    }
    static getEntries(array) {
        if (!array || (typeof array !== "object" && typeof array !== "function"))
            return [];
        return Object.entries(array).map(([k, v]) => [(!isNaN(Number(k)) && String(Number(k)) === String(k)) ? Number(k) : k, v]);
    }
    static reset(ctx, arrayArg) {
        const array = arrayArg?.get();
        const entries = ArrayRuntime.getEntries(array);
        if (!entries.length)
            return false;
        if (typeof array === "object" && array !== null)
            Object.defineProperty(array, "__ptr", { value: 0, writable: true, configurable: true, enumerable: false });
        return entries[0][1];
    }
    static current(ctx, arrayArg) {
        const array = arrayArg?.get();
        const entries = ArrayRuntime.getEntries(array);
        if (!entries.length)
            return false;
        const ptr = (array && typeof array === "object" && "__ptr" in array) ? array.__ptr : 0;
        if (ptr < 0 || ptr >= entries.length)
            return false;
        return entries[ptr][1];
    }
    static next(ctx, arrayArg) {
        const array = arrayArg?.get();
        const entries = ArrayRuntime.getEntries(array);
        if (!entries.length)
            return false;
        const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? array.__ptr : 0;
        const nextPtr = currentPtr + 1;
        if (array && typeof array === "object")
            Object.defineProperty(array, "__ptr", { value: nextPtr, writable: true, configurable: true, enumerable: false });
        if (nextPtr >= entries.length)
            return false;
        return entries[nextPtr][1];
    }
    static prev(ctx, arrayArg) {
        const array = arrayArg?.get();
        const entries = ArrayRuntime.getEntries(array);
        if (!entries.length)
            return false;
        const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? array.__ptr : 0;
        const prevPtr = currentPtr - 1;
        if (array && typeof array === "object")
            Object.defineProperty(array, "__ptr", { value: prevPtr, writable: true, configurable: true, enumerable: false });
        if (prevPtr < 0 || prevPtr >= entries.length)
            return false;
        return entries[prevPtr][1];
    }
    static end(ctx, arrayArg) {
        const array = arrayArg?.get();
        const entries = ArrayRuntime.getEntries(array);
        if (!entries.length)
            return false;
        const lastPtr = entries.length - 1;
        if (array && typeof array === "object")
            Object.defineProperty(array, "__ptr", { value: lastPtr, writable: true, configurable: true, enumerable: false });
        return entries[lastPtr][1];
    }
    static key(ctx, arrayArg) {
        const array = arrayArg?.get();
        const entries = ArrayRuntime.getEntries(array);
        if (!entries.length)
            return null;
        const ptr = (array && typeof array === "object" && "__ptr" in array) ? array.__ptr : 0;
        if (ptr < 0 || ptr >= entries.length)
            return null;
        return entries[ptr][0];
    }
    static each(ctx, arrayArg) {
        const array = arrayArg?.get();
        const entries = ArrayRuntime.getEntries(array);
        if (!entries.length)
            return false;
        const currentPtr = (array && typeof array === "object" && "__ptr" in array) ? array.__ptr : 0;
        if (currentPtr < 0 || currentPtr >= entries.length)
            return false;
        const [k, v] = entries[currentPtr];
        if (array && typeof array === "object")
            Object.defineProperty(array, "__ptr", { value: currentPtr + 1, writable: true, configurable: true, enumerable: false });
        return { 1: v, value: v, 0: k, key: k };
    }
    static functions = {
        "count": ArrayRuntime.count,
        "sizeof": ArrayRuntime.count,
        "array_keys": ArrayRuntime.array_keys,
        "array_values": ArrayRuntime.array_values,
        "array_flip": ArrayRuntime.array_flip,
        "array_reverse": ArrayRuntime.array_reverse,
        "in_array": ArrayRuntime.in_array,
        "array_search": ArrayRuntime.array_search,
        "array_key_exists": ArrayRuntime.array_key_exists,
        "key_exists": ArrayRuntime.array_key_exists,
        "array_merge": ArrayRuntime.array_merge,
        "array_combine": ArrayRuntime.array_combine,
        "array_fill_keys": ArrayRuntime.array_fill_keys,
        "array_fill": ArrayRuntime.array_fill,
        "array_intersect": ArrayRuntime.array_intersect,
        "array_diff": ArrayRuntime.array_diff,
        "array_intersect_key": ArrayRuntime.array_intersect_key,
        "array_diff_key": ArrayRuntime.array_diff_key,
        "array_slice": ArrayRuntime.array_slice,
        "array_push": ArrayRuntime.array_push,
        "array_pop": ArrayRuntime.array_pop,
        "array_shift": ArrayRuntime.array_shift,
        "array_unshift": ArrayRuntime.array_unshift,
        "array_unique": ArrayRuntime.array_unique,
        "array_column": ArrayRuntime.array_column,
        "sort": ArrayRuntime.sort,
        "rsort": ArrayRuntime.rsort,
        "ksort": ArrayRuntime.ksort,
        "array_map": ArrayRuntime.array_map,
        "array_filter": ArrayRuntime.array_filter,
        "array_key_first": ArrayRuntime.array_key_first,
        "array_change_key_case": ArrayRuntime.array_change_key_case,
        "array_key_last": ArrayRuntime.array_key_last,
        "current": ArrayRuntime.current,
        "pos": ArrayRuntime.current,
        "reset": ArrayRuntime.reset,
        "end": ArrayRuntime.end,
        "key": ArrayRuntime.key,
        "next": ArrayRuntime.next,
        "prev": ArrayRuntime.prev,
        "each": ArrayRuntime.each,
    };
    static register(engine) {
        engine.registerFunctions(ArrayRuntime.functions);
    }
}
//# sourceMappingURL=Arrays.js.map