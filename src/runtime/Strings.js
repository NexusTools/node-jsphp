"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringRuntime = void 0;
class StringRuntime {
    static lastReplaceCount = 0;
    static strlen(str) {
        if (Buffer.isBuffer(str))
            return str.length;
        return String(str ?? "").length;
    }
    static substr_count(haystack, needle, offset = 0, length) {
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
    static substr(str, start, length) {
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
    static substr_replace(subject, replacement, offset, length) {
        if (Array.isArray(subject)) {
            return subject.map((value, index) => StringRuntime.substr_replace(value, Array.isArray(replacement) ? replacement[index] ?? "" : replacement, Array.isArray(offset) ? offset[index] ?? 0 : offset, Array.isArray(length) ? length[index] : length));
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
    static strpos(haystack, needle, offset = 0) {
        const idx = String(haystack ?? "").indexOf(String(needle ?? ""), offset);
        return idx === -1 ? false : idx;
    }
    static stripos(haystack, needle, offset = 0) {
        const idx = String(haystack ?? "").toLowerCase().indexOf(String(needle ?? "").toLowerCase(), offset);
        return idx === -1 ? false : idx;
    }
    static strrpos(haystack, needle, offset = 0) {
        const idx = String(haystack ?? "").lastIndexOf(String(needle ?? ""), offset || undefined);
        return idx === -1 ? false : idx;
    }
    static strripos(haystack, needle, offset = 0) {
        const idx = String(haystack ?? "").toLowerCase().lastIndexOf(String(needle ?? "").toLowerCase(), offset || undefined);
        return idx === -1 ? false : idx;
    }
    static strstr(haystack, needle, beforeNeedle = false) {
        const s = String(haystack ?? "");
        const n = String(needle ?? "");
        const idx = s.indexOf(n);
        if (idx === -1)
            return false;
        return beforeNeedle ? s.substring(0, idx) : s.substring(idx);
    }
    static str_replace(search, replace, subject) {
        StringRuntime.lastReplaceCount = 0;
        if (Array.isArray(subject)) {
            return subject.map((s) => StringRuntime.str_replace(search, replace, s));
        }
        let s = String(subject ?? "");
        const searches = Array.isArray(search) ? search : [search];
        const replaces = Array.isArray(replace) ? replace : [replace];
        searches.forEach((sch, i) => {
            const rep = replaces[i] !== undefined ? replaces[i] : replaces[replaces.length - 1] || "";
            if (String(sch))
                StringRuntime.lastReplaceCount += s.split(String(sch)).length - 1;
            s = s.split(String(sch)).join(String(rep));
        });
        return s;
    }
    static strtr(subject, from, to) {
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
    static str_ireplace(search, replace, subject) {
        if (Array.isArray(subject)) {
            return subject.map((s) => StringRuntime.str_ireplace(search, replace, s));
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
    static sprintf(fmt, ...args) {
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
    static explode(delimiter, string, limit) {
        const res = String(string ?? "").split(delimiter);
        if (limit !== undefined && limit > 0 && res.length > limit) {
            return [...res.slice(0, limit - 1), res.slice(limit - 1).join(delimiter)];
        }
        return res;
    }
    static implode(glue, pieces) {
        return (pieces || []).join(glue);
    }
    static trim(str, charlist) {
        let s = String(str ?? "");
        if (!charlist)
            return s.trim();
        const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        return s.replace(new RegExp(`^[${mask}]+|[${mask}]+$`, "g"), "");
    }
    static ltrim(str, charlist) {
        let s = String(str ?? "");
        if (!charlist)
            return s.trimStart();
        const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        return s.replace(new RegExp(`^[${mask}]+`, "g"), "");
    }
    static rtrim(str, charlist) {
        let s = String(str ?? "");
        if (!charlist)
            return s.trimEnd();
        const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        return s.replace(new RegExp(`[${mask}]+$`, "g"), "");
    }
    static strtolower(str) { return String(str ?? "").toLowerCase(); }
    static strtoupper(str) { return String(str ?? "").toUpperCase(); }
    static ucfirst(str) {
        const s = String(str ?? "");
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    static lcfirst(str) {
        const s = String(str ?? "");
        return s.charAt(0).toLowerCase() + s.slice(1);
    }
    static ucwords(str) {
        return String(str ?? "").replace(/\b\w/g, (l) => l.toUpperCase());
    }
    static strcmp(str1, str2) {
        const s1 = String(str1 ?? "");
        const s2 = String(str2 ?? "");
        return s1.localeCompare(s2);
    }
    static strncmp(str1, str2, length) {
        return StringRuntime.strcmp(String(str1 ?? "").slice(0, length), String(str2 ?? "").slice(0, length));
    }
    static addslashes(str) {
        return String(str ?? "").replace(/[\\\"']/g, "\\$&").replace(/\u0000/g, "\\0");
    }
    static stripslashes(str) {
        return String(str ?? "").replace(/\\(['"\\0])/g, "$1");
    }
    static htmlspecialchars(str) {
        return String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    static htmlspecialchars_decode(str) {
        return String(str ?? "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    }
    static nl2br(str, isXhtml = true) {
        const breakTag = isXhtml ? "<br />" : "<br>";
        return String(str ?? "").replace(/(\r\n|\n\r|\r|\n)/g, breakTag + "$1");
    }
    static str_repeat(input, multiplier) {
        return String(input ?? "").repeat(Math.max(0, multiplier));
    }
    static str_pad(input, padLength, padString = " ", padType = 1) {
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
    static str_split(string, length = 1) {
        const s = String(string ?? "");
        const res = [];
        for (let i = 0; i < s.length; i += length) {
            res.push(s.substring(i, i + length));
        }
        return res;
    }
    static strrev(string) {
        return String(string ?? "").split("").reverse().join("");
    }
    static chr(ascii) {
        return String.fromCharCode(ascii);
    }
    static ord(character) {
        return String(character ?? "").charCodeAt(0) || 0;
    }
    static bin2hex(string) {
        return Buffer.from(String(string ?? "")).toString("hex");
    }
    static hex2bin(hexString) {
        return Buffer.from(String(hexString ?? ""), "hex").toString("utf8");
    }
    static version_compare(v1, v2, op) {
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
    static register(engine) {
        const register = engine.registerFunction.bind(engine);
        register("version_compare", (ctx, first, second, operator) => StringRuntime.version_compare(first, second, operator));
        register("strlen", (ctx, str) => StringRuntime.strlen(str));
        register("substr_count", (ctx, haystack, needle, offset = 0, length) => StringRuntime.substr_count(haystack, needle, offset, length));
        register("substr", (ctx, str, start, length) => StringRuntime.substr(str, start, length));
        register("substr_replace", (ctx, subject, replacement, offset, length) => StringRuntime.substr_replace(subject, replacement, offset, length));
        register("strpos", (ctx, haystack, needle, offset = 0) => StringRuntime.strpos(haystack, needle, offset));
        register("stripos", (ctx, haystack, needle, offset = 0) => StringRuntime.stripos(haystack, needle, offset));
        register("strrpos", (ctx, haystack, needle, offset = 0) => StringRuntime.strrpos(haystack, needle, offset));
        register("strripos", (ctx, haystack, needle, offset = 0) => StringRuntime.strripos(haystack, needle, offset));
        register("strstr", (ctx, haystack, needle, before = false) => StringRuntime.strstr(haystack, needle, before));
        register("str_replace", (ctx, search, replace, subject) => {
            const result = StringRuntime.str_replace(search, replace, subject);
            ctx.setInternalVar("lastStrReplaceCount", StringRuntime.lastReplaceCount);
            return result;
        });
        register("strtr", (ctx, subject, from, to) => StringRuntime.strtr(subject, from, to));
        register("str_ireplace", (ctx, search, replace, subject) => StringRuntime.str_ireplace(search, replace, subject));
        register("sprintf", (ctx, fmt, ...args) => StringRuntime.sprintf(fmt, ...args));
        register("printf", async (ctx, fmt, ...args) => { const result = StringRuntime.sprintf(fmt, ...args); await ctx.echo(result); return result.length; });
        register("vsprintf", (ctx, fmt, args = []) => StringRuntime.sprintf(fmt, ...(Array.isArray(args) ? args : [])));
        register("vprintf", async (ctx, fmt, args = []) => { const result = StringRuntime.sprintf(fmt, ...(Array.isArray(args) ? args : [])); await ctx.echo(result); return result.length; });
        register("explode", (ctx, delimiter, str, limit) => StringRuntime.explode(delimiter, str, limit));
        register("implode", (ctx, glue, pieces) => StringRuntime.implode(glue, pieces));
        register("trim", (ctx, str, chars) => StringRuntime.trim(str, chars));
        register("ltrim", (ctx, str, chars) => StringRuntime.ltrim(str, chars));
        register("rtrim", (ctx, str, chars) => StringRuntime.rtrim(str, chars));
        register("strtolower", (ctx, str) => StringRuntime.strtolower(str));
        register("strtoupper", (ctx, str) => StringRuntime.strtoupper(str));
        register("ucfirst", (ctx, str) => StringRuntime.ucfirst(str));
        register("lcfirst", (ctx, str) => StringRuntime.lcfirst(str));
        register("ucwords", (ctx, str) => StringRuntime.ucwords(str));
        register("strcmp", (ctx, s1, s2) => StringRuntime.strcmp(s1, s2));
        register("strncmp", (ctx, s1, s2, length) => StringRuntime.strncmp(s1, s2, length));
        register("addslashes", (ctx, str) => StringRuntime.addslashes(str));
        register("stripslashes", (ctx, str) => StringRuntime.stripslashes(str));
        register("htmlspecialchars", (ctx, str) => StringRuntime.htmlspecialchars(str));
        register("htmlspecialchars_decode", (ctx, str) => StringRuntime.htmlspecialchars_decode(str));
        register("nl2br", (ctx, str, xhtml = true) => StringRuntime.nl2br(str, xhtml));
        register("str_repeat", (ctx, str, mult) => StringRuntime.str_repeat(str, mult));
        register("str_pad", (ctx, str, len, pad = " ", type = 1) => StringRuntime.str_pad(str, len, pad, type));
        register("str_split", (ctx, str, len = 1) => StringRuntime.str_split(str, len));
        register("strrev", (ctx, str) => StringRuntime.strrev(str));
        register("chr", (ctx, ascii) => StringRuntime.chr(ascii));
        register("ord", (ctx, char) => StringRuntime.ord(char));
        register("bin2hex", (ctx, str) => StringRuntime.bin2hex(str));
        register("hex2bin", (ctx, str) => StringRuntime.hex2bin(str));
    }
}
exports.StringRuntime = StringRuntime;
//# sourceMappingURL=Strings.js.map