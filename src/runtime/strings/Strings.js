"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringRuntime = void 0;
class StringRuntime {
    static strlen(str) {
        return String(str || "").length;
    }
    static substr(str, start, length) {
        const s = String(str || "");
        if (length !== undefined) {
            return s.substring(start, start + length);
        }
        return s.substring(start);
    }
    static strpos(haystack, needle, offset = 0) {
        const idx = String(haystack || "").indexOf(String(needle || ""), offset);
        return idx === -1 ? false : idx;
    }
    static explode(delimiter, string, limit) {
        const res = String(string || "").split(delimiter);
        if (limit !== undefined && limit > 0 && res.length > limit) {
            return [...res.slice(0, limit - 1), res.slice(limit - 1).join(delimiter)];
        }
        return res;
    }
    static implode(glue, pieces) {
        return (pieces || []).join(glue);
    }
}
exports.StringRuntime = StringRuntime;
//# sourceMappingURL=Strings.js.map