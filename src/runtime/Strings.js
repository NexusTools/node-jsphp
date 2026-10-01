"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringRuntime = void 0;
const Reflection_1 = require("./Reflection");
class StringRuntime {
    /** Gets string length. */
    static strlen(ctx, str) {
        if (Buffer.isBuffer(str))
            return str.length;
        return String(str ?? "").length;
    }
    /** Count the number of substring occurrences. */
    static substr_count(ctx, haystack, needle, offset = 0, length) {
        const source = String(haystack ?? "").slice(offset, length === undefined ? undefined : offset + length);
        const search = String(needle ?? "");
        if (!search)
            return 0;
        let count = 0;
        let position = 0;
        while ((position = source.indexOf(search, position)) !== -1) {
            count++;
            position += search.length;
        }
        return count;
    }
    /** Return part of a string. */
    static substr(ctx, str, start, length) {
        const s = String(str ?? "");
        if (start < 0)
            start = s.length + start;
        if (length !== undefined) {
            if (length < 0)
                return s.substring(start, s.length + length);
            return s.substring(start, start + length);
        }
        return s.substring(start);
    }
    /** Replace text within a portion of a string. */
    static substr_replace(ctx, subject, replacement, offset, length) {
        if (Array.isArray(subject)) {
            return subject.map((value, index) => StringRuntime.substr_replace(ctx, value, Array.isArray(replacement) ? replacement[index] ?? "" : replacement, Array.isArray(offset) ? offset[index] ?? 0 : offset, Array.isArray(length) ? length[index] : length));
        }
        const source = String(subject ?? "");
        const startValue = Math.trunc(Number(offset) || 0);
        const start = Math.max(0, Math.min(source.length, startValue < 0 ? source.length + startValue : startValue));
        const lengthValue = length == null ? source.length : Math.trunc(Number(length) || 0);
        const end = lengthValue < 0
            ? Math.max(start, source.length + lengthValue)
            : Math.min(source.length, start + lengthValue);
        const inserted = Array.isArray(replacement) ? replacement[0] ?? "" : replacement ?? "";
        return source.slice(0, start) + String(inserted) + source.slice(end);
    }
    /** Find the position of the first occurrence of a substring in a string. */
    static strpos(ctx, haystack, needle, offset = 0) {
        const idx = String(haystack ?? "").indexOf(String(needle ?? ""), offset);
        return idx === -1 ? false : idx;
    }
    /** Find the position of the first occurrence of a case-insensitive substring in a string. */
    static stripos(ctx, haystack, needle, offset = 0) {
        const idx = String(haystack ?? "").toLowerCase().indexOf(String(needle ?? "").toLowerCase(), offset);
        return idx === -1 ? false : idx;
    }
    /** Find the position of the last occurrence of a substring in a string. */
    static strrpos(ctx, haystack, needle, offset = 0) {
        const idx = String(haystack ?? "").lastIndexOf(String(needle ?? ""), offset || undefined);
        return idx === -1 ? false : idx;
    }
    /** Find the position of the last occurrence of a case-insensitive substring in a string. */
    static strripos(ctx, haystack, needle, offset = 0) {
        const idx = String(haystack ?? "").toLowerCase().lastIndexOf(String(needle ?? "").toLowerCase(), offset || undefined);
        return idx === -1 ? false : idx;
    }
    /** Find the first occurrence of a string. */
    static strstr(ctx, haystack, needle, beforeNeedle = false) {
        const s = String(haystack ?? "");
        const n = String(needle ?? "");
        const idx = s.indexOf(n);
        if (idx === -1)
            return false;
        return beforeNeedle ? s.substring(0, idx) : s.substring(idx);
    }
    /**
     * Replace all occurrences of the search string with the replacement string.
     * @param countRef Output variable passed by reference to receive replacement count.
     */
    static str_replace(ctx, search, replace, subject, countRef) {
        var replaceCount = 0;
        if (Array.isArray(subject)) {
            const res = subject.map((s) => StringRuntime.str_replace(ctx, search, replace, s, { set: (val) => { replaceCount += val; } }));
            if (countRef && typeof countRef.set === "function")
                countRef.set(replaceCount);
            return res;
        }
        let s = String(subject ?? "");
        const searches = Array.isArray(search) ? search : [search];
        const replaces = Array.isArray(replace) ? replace : [replace];
        searches.forEach((sch, i) => {
            const rep = replaces[i] !== undefined ? replaces[i] : replaces[replaces.length - 1] || "";
            if (String(sch))
                replaceCount += s.split(String(sch)).length - 1;
            s = s.split(String(sch)).join(String(rep));
        });
        if (countRef && typeof countRef.set === "function") {
            countRef.set(replaceCount);
        }
        return s;
    }
    /** Translate characters or replace substrings. */
    static strtr(ctx, subject, from, to) {
        let result = String(subject ?? "");
        if (from && typeof from === "object" && !Array.isArray(from)) {
            for (const [search, replacement] of Object.entries(from))
                result = result.split(search).join(String(replacement));
            return result;
        }
        const search = String(from ?? "");
        const replacement = String(to ?? "");
        return result.split(search).join(replacement);
    }
    /** Case-insensitive version of str_replace. */
    static str_ireplace(ctx, search, replace, subject) {
        if (Array.isArray(subject)) {
            return subject.map((s) => StringRuntime.str_ireplace(ctx, search, replace, s));
        }
        let s = String(subject ?? "");
        const searches = Array.isArray(search) ? search : [search];
        const replaces = Array.isArray(replace) ? replace : [replace];
        searches.forEach((sch, i) => {
            const rep = replaces[i] !== undefined ? replaces[i] : replaces[replaces.length - 1] || "";
            const regex = new RegExp(String(sch).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "gi");
            s = s.replace(regex, String(rep));
        });
        return s;
    }
    /** Return a formatted string. */
    static sprintf(ctx, fmt, ...args) {
        let i = 0;
        return String(fmt ?? "").replace(/%([%d s f g x X])/g, (_, spec) => {
            if (spec === "%")
                return "%";
            const val = args[i++];
            if (spec === "d")
                return String(parseInt(val, 10) || 0);
            if (spec === "f" || spec === "g")
                return String(parseFloat(val) || 0);
            if (spec === "x")
                return (parseInt(val, 10) || 0).toString(16);
            if (spec === "X")
                return (parseInt(val, 10) || 0).toString(16).toUpperCase();
            return String(val ?? "");
        });
    }
    /** Split a string by a string. */
    static explode(ctx, delimiter, string, limit) {
        const res = String(string ?? "").split(delimiter);
        if (limit !== undefined && limit > 0 && res.length > limit) {
            return [...res.slice(0, limit - 1), res.slice(limit - 1).join(delimiter)];
        }
        return res;
    }
    /** Join array elements with a string. */
    static implode(ctx, glue, pieces) {
        return (pieces || []).join(glue);
    }
    /** Strip whitespace (or other characters) from the beginning and end of a string. */
    static trim(ctx, str, charlist) {
        let s = String(str ?? "");
        if (!charlist)
            return s.trim();
        const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        return s.replace(new RegExp(`^[${mask}]+|[${mask}]+$`, "g"), "");
    }
    /** Strip whitespace (or other characters) from the beginning of a string. */
    static ltrim(ctx, str, charlist) {
        let s = String(str ?? "");
        if (!charlist)
            return s.trimStart();
        const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        return s.replace(new RegExp(`^[${mask}]+`, "g"), "");
    }
    /** Strip whitespace (or other characters) from the end of a string. */
    static rtrim(ctx, str, charlist) {
        let s = String(str ?? "");
        if (!charlist)
            return s.trimEnd();
        const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        return s.replace(new RegExp(`[${mask}]+$`, "g"), "");
    }
    /** Make a string lowercase. */
    static strtolower(ctx, str) { return String(str ?? "").toLowerCase(); }
    /** Make a string uppercase. */
    static strtoupper(ctx, str) { return String(str ?? "").toUpperCase(); }
    /** Make a string's first character uppercase. */
    static ucfirst(ctx, str) {
        const s = String(str ?? "");
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    /** Make a string's first character lowercase. */
    static lcfirst(ctx, str) {
        const s = String(str ?? "");
        return s.charAt(0).toLowerCase() + s.slice(1);
    }
    /** Uppercase the first character of each word in a string. */
    static ucwords(ctx, str) {
        return String(str ?? "").replace(/\b\w/g, (l) => l.toUpperCase());
    }
    /** Binary safe string comparison. */
    static strcmp(ctx, str1, str2) {
        const s1 = String(str1 ?? "");
        const s2 = String(str2 ?? "");
        return s1.localeCompare(s2);
    }
    /** Binary safe string comparison of the first n characters. */
    static strncmp(ctx, str1, str2, length) {
        return StringRuntime.strcmp(ctx, String(str1 ?? "").slice(0, length), String(str2 ?? "").slice(0, length));
    }
    /** Quote string with slashes. */
    static addslashes(ctx, str) {
        return String(str ?? "").replace(/[\\\"']/g, "\\$&").replace(/\u0000/g, "\\0");
    }
    /** Un-quotes a quoted string. */
    static stripslashes(ctx, str) {
        return String(str ?? "").replace(/\\(['"\\0])/g, "$1");
    }
    /** Convert special characters to HTML entities. */
    static htmlspecialchars(ctx, str) {
        return String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    /** Convert special HTML entities back to characters. */
    static htmlspecialchars_decode(ctx, str) {
        return String(str ?? "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    }
    /** Inserts HTML line breaks before all newlines in a string. */
    static nl2br(ctx, str, isXhtml = true) {
        const breakTag = isXhtml ? "<br />" : "<br>";
        return String(str ?? "").replace(/(\r\n|\n\r|\r|\n)/g, breakTag + "$1");
    }
    /** Repeat a string. */
    static str_repeat(ctx, input, multiplier) {
        return String(input ?? "").repeat(Math.max(0, multiplier));
    }
    /** Pad a string to a certain length with another string. */
    static str_pad(ctx, input, padLength, padString = " ", padType = 1) {
        let s = String(input ?? "");
        if (s.length >= padLength)
            return s;
        const needed = padLength - s.length;
        const pStr = padString.repeat(Math.ceil(needed / padString.length)).substring(0, needed);
        if (padType === 0)
            return pStr + s; // STR_PAD_LEFT
        if (padType === 2) { // STR_PAD_BOTH
            const left = Math.floor(needed / 2);
            const right = needed - left;
            return pStr.substring(0, left) + s + pStr.substring(0, right);
        }
        return s + pStr; // STR_PAD_RIGHT
    }
    /** Convert a string to an array. */
    static str_split(ctx, string, length = 1) {
        const s = String(string ?? "");
        const res = [];
        for (let i = 0; i < s.length; i += length) {
            res.push(s.substring(i, i + length));
        }
        return res;
    }
    /** Reverse a string. */
    static strrev(ctx, string) {
        return String(string ?? "").split("").reverse().join("");
    }
    /** Generate a single-byte string from a number. */
    static chr(ctx, ascii) {
        return String.fromCharCode(ascii);
    }
    /** Convert the first byte of a string to a value between 0 and 255. */
    static ord(ctx, character) {
        return String(character ?? "").charCodeAt(0) || 0;
    }
    /** Convert binary data into hexadecimal representation. */
    static bin2hex(ctx, string) {
        return Buffer.from(String(string ?? "")).toString("hex");
    }
    /** Decodes a hexadecimally encoded binary string. */
    static hex2bin(ctx, hexString) {
        return Buffer.from(String(hexString ?? ""), "hex").toString("utf8");
    }
    /** Compares two "PHP-standardized" version number strings. */
    static version_compare(ctx, v1, v2, op) {
        const parse = (v) => (v || "").split(".").map((n) => parseInt(n, 10) || 0);
        const p1 = parse(v1);
        const p2 = parse(v2);
        const max = Math.max(p1.length, p2.length);
        let comp = 0;
        for (let i = 0; i < max; i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) {
                comp = 1;
                break;
            }
            if (n1 < n2) {
                comp = -1;
                break;
            }
        }
        if (!op)
            return comp;
        switch (op) {
            case "<":
            case "lt": return comp < 0;
            case "<=":
            case "le": return comp <= 0;
            case ">":
            case "gt": return comp > 0;
            case ">=":
            case "ge": return comp >= 0;
            case "==":
            case "=":
            case "eq": return comp === 0;
            case "!=":
            case "<>":
            case "ne": return comp !== 0;
            default: return false;
        }
    }
    /**
     * Parses encoded query string into variables.
     * @param result Output variable passed by reference to receive parsed key-value pairs.
     */
    static parse_str(ctx, query, result) {
        const parsed = Object.create(null);
        for (const [name, value] of new URLSearchParams(String(query ?? ""))) {
            const bracket = name.indexOf("[");
            const rawBase = bracket < 0 ? name : name.slice(0, bracket);
            const base = rawBase.replace(/[ .]/g, "_");
            if (!base)
                continue;
            const subKeys = Array.from(name.slice(bracket < 0 ? name.length : bracket).matchAll(/\[([^\]]*)\]/g), (match) => match[1]);
            const keys = [base, ...subKeys];
            let target = parsed;
            keys.forEach((part, index) => {
                const key = part === ""
                    ? String(Math.max(-1, ...Object.keys(target).filter((entry) => /^(0|[1-9]\d*)$/.test(entry)).map(Number)) + 1)
                    : part;
                if (index === keys.length - 1) {
                    target[key] = value;
                }
                else {
                    if (!target[key] || typeof target[key] !== "object") {
                        target[key] = Object.create(null);
                    }
                    target = target[key];
                }
            });
        }
        const normalize = (value) => {
            if (!value || typeof value !== "object")
                return value;
            const keys = Object.keys(value);
            if (keys.length > 0 && keys.every((key, index) => key === String(index))) {
                return keys.map((key) => normalize(value[key]));
            }
            const obj = {};
            for (const key of keys) {
                obj[key] = normalize(value[key]);
            }
            return obj;
        };
        const output = normalize(parsed);
        ctx.setInternalVar("lastParseStrResult", output);
        if (result && typeof result.set === "function") {
            result.set(output);
        }
        else if (result !== undefined && result !== null && typeof result === "object") {
            for (const key of Object.keys(result))
                delete result[key];
            Object.assign(result, output);
        }
        else {
            for (const [k, v] of Object.entries(output)) {
                ctx.setVar(k, v);
            }
        }
    }
    static functions = {
        "parse_str": StringRuntime.parse_str,
        "version_compare": StringRuntime.version_compare,
        "strlen": StringRuntime.strlen,
        "substr_count": StringRuntime.substr_count,
        "substr": StringRuntime.substr,
        "substr_replace": StringRuntime.substr_replace,
        "strpos": StringRuntime.strpos,
        "stripos": StringRuntime.stripos,
        "strrpos": StringRuntime.strrpos,
        "strripos": StringRuntime.strripos,
        "strstr": StringRuntime.strstr,
        "str_replace": StringRuntime.str_replace,
        "strtr": StringRuntime.strtr,
        "str_ireplace": StringRuntime.str_ireplace,
        "sprintf": StringRuntime.sprintf,
        "explode": StringRuntime.explode,
        "implode": StringRuntime.implode,
        "trim": StringRuntime.trim,
        "ltrim": StringRuntime.ltrim,
        "rtrim": StringRuntime.rtrim,
        "strtolower": StringRuntime.strtolower,
        "strtoupper": StringRuntime.strtoupper,
        "ucfirst": StringRuntime.ucfirst,
        "lcfirst": StringRuntime.lcfirst,
        "ucwords": StringRuntime.ucwords,
        "strcmp": StringRuntime.strcmp,
        "strncmp": StringRuntime.strncmp,
        "addslashes": StringRuntime.addslashes,
        "stripslashes": StringRuntime.stripslashes,
        "htmlspecialchars": StringRuntime.htmlspecialchars,
        "htmlspecialchars_decode": StringRuntime.htmlspecialchars_decode,
        "nl2br": StringRuntime.nl2br,
        "str_repeat": StringRuntime.str_repeat,
        "str_pad": StringRuntime.str_pad,
        "str_split": StringRuntime.str_split,
        "strrev": StringRuntime.strrev,
        "chr": StringRuntime.chr,
        "ord": StringRuntime.ord,
        "bin2hex": StringRuntime.bin2hex,
        "hex2bin": StringRuntime.hex2bin,
    };
    static register(engine) {
        engine.registerFunctions(StringRuntime.functions);
    }
}
exports.StringRuntime = StringRuntime;
(0, Reflection_1.defineFunction)(StringRuntime.parse_str, {
    name: "parse_str",
    parameters: [{ name: "query" }, { name: "result", byref: true }],
});
(0, Reflection_1.defineFunction)(StringRuntime.str_replace, {
    name: "str_replace",
    parameters: [{ name: "search" }, { name: "replace" }, { name: "subject" }, { name: "count", byref: true }],
});
//# sourceMappingURL=Strings.js.map