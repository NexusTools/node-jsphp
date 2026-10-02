"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PCREExtension = void 0;
const PHPExtension_1 = require("../PHPExtension");
const Reflection_1 = require("../runtime/Reflection");
class PCREExtension extends PHPExtension_1.PHPExtension {
    name = "pcre";
    compilePattern(pattern, global = false, offsets = false) {
        const opening = pattern[0];
        if (!opening || /[a-zA-Z0-9\\\s]/.test(opening))
            throw new Error("Invalid regular expression delimiter");
        const closing = { "(": ")", "[": "]", "{": "}", "<": ">" }[opening] || opening;
        const end = pattern.lastIndexOf(closing);
        if (end < 1)
            throw new Error("Missing regular expression delimiter");
        let source = pattern.slice(1, end);
        if ("#~%!".includes(opening))
            source = source.split(`\\${opening}`).join(opening);
        const modifiers = pattern.slice(end + 1);
        if (modifiers.includes("A"))
            source = `^(?:${source})`;
        const flags = [...new Set([...modifiers].filter((flag) => "imsu".includes(flag)))].join("");
        return new RegExp(source, flags + (global ? "g" : "") + (offsets ? "d" : ""));
    }
    captures(match, flags) {
        const result = [];
        const indices = match.indices;
        const capture = (value, position) => {
            const content = value === undefined ? ((flags & 512) ? null : "") : value;
            return (flags & 256) ? [content, position ?? -1] : content;
        };
        for (let index = 0; index < match.length; index++)
            result[index] = capture(match[index], indices?.[index]?.[0]);
        for (const [name, value] of Object.entries(match.groups || {}))
            result[name] = capture(value, indices?.groups?.[name]?.[0]);
        return result;
    }
    storeMatches(ctx, target, matches) {
        if (target && typeof target.set === "function") {
            target.set(matches);
        }
        else if (target && typeof target === "object") {
            for (const key of Object.keys(target))
                delete target[key];
            if (Array.isArray(target))
                target.length = 0;
            Object.assign(target, matches);
        }
    }
    onInit(engine) {
        this.constants = {
            PREG_PATTERN_ORDER: 1,
            PREG_SET_ORDER: 2,
            PREG_OFFSET_CAPTURE: 256,
            PREG_UNMATCHED_AS_NULL: 512,
            PREG_NO_ERROR: 0,
            PREG_INTERNAL_ERROR: 1,
        };
        this.functions = {
            /**
             * Perform a regular expression match.
             * @param matchesObj Output variable passed by reference to receive match results.
             */
            preg_match: (ctx, pattern, subject, matchesObj, flags = 0, offset = 0) => {
                try {
                    const input = String(subject ?? "");
                    const regex = this.compilePattern(pattern, true, Boolean(flags & 256));
                    regex.lastIndex = offset < 0 ? Math.max(0, input.length + offset) : offset;
                    const match = regex.exec(input);
                    this.storeMatches(ctx, matchesObj, match ? this.captures(match, flags) : []);
                    ctx.setInternalVar("lastPregError", 0);
                    return match ? 1 : 0;
                }
                catch {
                    this.storeMatches(ctx, matchesObj, []);
                    ctx.setInternalVar("lastPregError", 1);
                    return false;
                }
            },
            /**
             * Perform a global regular expression match.
             * @param matchesObj Output variable passed by reference to receive all match results.
             */
            preg_match_all: (ctx, pattern, subject, matchesObj, flags = 1, offset = 0) => {
                try {
                    const input = String(subject ?? "");
                    const regex = this.compilePattern(pattern, true, Boolean(flags & 256));
                    regex.lastIndex = offset < 0 ? Math.max(0, input.length + offset) : offset;
                    const rows = [];
                    let match;
                    while ((match = regex.exec(input)) !== null) {
                        rows.push(this.captures(match, flags));
                        if (match[0].length === 0)
                            regex.lastIndex++;
                    }
                    const matches = (flags & 2) ? rows : [];
                    if (!(flags & 2)) {
                        for (const row of rows) {
                            for (const key of Object.keys(row))
                                (matches[key] ||= []).push(row[key]);
                        }
                    }
                    this.storeMatches(ctx, matchesObj, matches);
                    ctx.setInternalVar("lastPregError", 0);
                    return rows.length;
                }
                catch {
                    this.storeMatches(ctx, matchesObj, []);
                    ctx.setInternalVar("lastPregError", 1);
                    return false;
                }
            },
            preg_replace: (ctx, pattern, replacement, subject) => {
                try {
                    const regex = this.compilePattern(pattern, true);
                    return String(subject || "").replace(regex, replacement);
                }
                catch {
                    return subject;
                }
            },
            preg_replace_callback: async (ctx, pattern, callback, subject) => {
                try {
                    const regex = this.compilePattern(pattern, true);
                    const input = String(subject || "");
                    let output = "";
                    let lastIndex = 0;
                    let current;
                    while ((current = regex.exec(input)) !== null) {
                        output += input.slice(lastIndex, current.index);
                        const captures = Array.from(current);
                        let replacement = "";
                        if (typeof callback === "string")
                            replacement = String(await ctx.callFunction(callback, [captures]));
                        else if (Array.isArray(callback) && callback.length === 2)
                            replacement = String(await ctx.callMethod(callback[0], callback[1], [captures]));
                        else if (typeof callback === "function")
                            replacement = String(await callback.apply(ctx, [ctx, captures]));
                        output += replacement;
                        lastIndex = current.index + current[0].length;
                        if (current[0].length === 0)
                            regex.lastIndex++;
                    }
                    return output + input.slice(lastIndex);
                }
                catch {
                    return subject;
                }
            },
            preg_last_error: (ctx) => ctx.getInternalVar("lastPregError") || 0,
            preg_last_error_msg: (ctx) => ctx.getInternalVar("lastPregError") ? "Internal error" : "No error",
            preg_split: (ctx, pattern, subject, limit = -1, flags = 0) => {
                try {
                    const reg = this.compilePattern(pattern);
                    const str = String(subject ?? "");
                    const lim = Number(limit);
                    if (lim === 1)
                        return [str];
                    const parts = str.split(reg);
                    if (lim > 1 && parts.length > lim) {
                        const extra = parts.slice(lim - 1).join("");
                        return [...parts.slice(0, lim - 1), extra];
                    }
                    return parts;
                }
                catch {
                    return false;
                }
            },
        };
        (0, Reflection_1.defineFunction)(this.functions.preg_match, {
            name: "preg_match",
            parameters: [{ name: "pattern" }, { name: "subject" }, { name: "matches", byref: true }, { name: "flags" }, { name: "offset" }],
        });
        (0, Reflection_1.defineFunction)(this.functions.preg_match_all, {
            name: "preg_match_all",
            parameters: [{ name: "pattern" }, { name: "subject" }, { name: "matches", byref: true }, { name: "flags" }, { name: "offset" }],
        });
    }
}
exports.PCREExtension = PCREExtension;
//# sourceMappingURL=pcre.js.map