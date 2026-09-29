"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringRuntime = void 0;
class StringRuntime {
    static strlen(str) {
        if (Buffer.isBuffer(str))
            return str.length;
        return String(str ?? "").length;
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
        if (Array.isArray(subject)) {
            return subject.map((s) => StringRuntime.str_replace(search, replace, s));
        }
        let s = String(subject ?? "");
        const searches = Array.isArray(search) ? search : [search];
        const replaces = Array.isArray(replace) ? replace : [replace];
        searches.forEach((sch, i) => {
            const rep = replaces[i] !== undefined ? replaces[i] : replaces[replaces.length - 1] || "";
            s = s.split(String(sch)).join(String(rep));
        });
        return s;
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
}
exports.StringRuntime = StringRuntime;
//# sourceMappingURL=Strings.js.map