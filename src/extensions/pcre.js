import { PHPExtension } from "../PHPExtension.js";
import { PHPLiteral } from "../runtime/PHPVariable.js";
import { PHPObject } from "../runtime/PHPObject.js";
import { defineFunction } from "../runtime/Reflection.js";
export class PCREExtension extends PHPExtension {
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
        source = source.replace(/\(\?P</g, "(?<");
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
            preg_pattern_order: 1,
            preg_set_order: 2,
            preg_offset_capture: 256,
            preg_unmatched_as_null: 512,
            preg_no_error: 0,
            preg_internal_error: 1,
        };
        this.functions = {
            preg_match: (ctx, patternArg, subjectArg, matchesObj, flagsArg, offsetArg) => {
                const pattern = ctx.str(patternArg?.get());
                const subject = ctx.str(subjectArg?.get());
                const flags = Number(flagsArg?.get()) || 0;
                const offset = Number(offsetArg?.get()) || 0;
                try {
                    const regex = this.compilePattern(pattern, true, Boolean(flags & 256));
                    regex.lastIndex = offset < 0 ? Math.max(0, subject.length + offset) : offset;
                    const match = regex.exec(subject);
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
            preg_match_all: (ctx, patternArg, subjectArg, matchesObj, flagsArg, offsetArg) => {
                const pattern = ctx.str(patternArg?.get());
                const subject = ctx.str(subjectArg?.get());
                const flags = flagsArg?.get() !== undefined ? Number(flagsArg.get()) : 1;
                const offset = Number(offsetArg?.get()) || 0;
                try {
                    const regex = this.compilePattern(pattern, true, Boolean(flags & 256));
                    regex.lastIndex = offset < 0 ? Math.max(0, subject.length + offset) : offset;
                    const rows = [];
                    let match;
                    while ((match = regex.exec(subject)) !== null) {
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
            preg_replace: (ctx, patternArg, replacementArg, subjectArg) => {
                const pattern = ctx.str(patternArg?.get());
                const replacement = ctx.str(replacementArg?.get());
                const subject = ctx.str(subjectArg?.get());
                try {
                    const regex = this.compilePattern(pattern, true);
                    return subject.replace(regex, replacement);
                }
                catch {
                    return subject;
                }
            },
            preg_replace_callback: async (ctx, patternArg, callbackArg, subjectArg) => {
                const pattern = ctx.str(patternArg?.get());
                const callback = callbackArg?.get();
                const subject = ctx.str(subjectArg?.get());
                try {
                    const regex = this.compilePattern(pattern, true);
                    let output = "";
                    let lastIndex = 0;
                    let current;
                    while ((current = regex.exec(subject)) !== null) {
                        output += subject.slice(lastIndex, current.index);
                        const captures = Array.from(current);
                        let replacement = "";
                        const cb = callback && typeof callback === "object" && typeof callback.get === "function" ? callback.get() : callback;
                        if (typeof cb === "string") {
                            replacement = ctx.str((await ctx.callFunction(cb, [new PHPLiteral(captures)])));
                        }
                        else if (Array.isArray(cb) && cb.length === 2) {
                            const obj = cb[0] && typeof cb[0] === "object" && typeof cb[0].get === "function" ? cb[0].get() : cb[0];
                            const m = cb[1] && typeof cb[1] === "object" && typeof cb[1].get === "function" ? cb[1].get() : cb[1];
                            replacement = ctx.str((await ctx.callMethod(obj, String(m), [new PHPLiteral(captures)])));
                        }
                        else if (typeof cb === "function") {
                            replacement = ctx.str((await cb.apply(ctx, [ctx, new PHPLiteral(captures)])));
                        }
                        else if (cb instanceof PHPObject) {
                            replacement = ctx.str((await ctx.callMethod(cb, "__invoke", [new PHPLiteral(captures)])));
                        }
                        output += replacement;
                        lastIndex = current.index + current[0].length;
                        if (current[0].length === 0)
                            regex.lastIndex++;
                    }
                    return output + subject.slice(lastIndex);
                }
                catch {
                    return subject;
                }
            },
            preg_last_error: (ctx) => ctx.getInternalVar("lastPregError") || 0,
            preg_last_error_msg: (ctx) => ctx.getInternalVar("lastPregError") ? "Internal error" : "No error",
            preg_split: (ctx, patternArg, subjectArg, limitArg, flagsArg) => {
                const pattern = ctx.str(patternArg?.get());
                const subject = ctx.str(subjectArg?.get());
                const limit = limitArg?.get() !== undefined ? Number(limitArg.get()) : -1;
                try {
                    const reg = this.compilePattern(pattern);
                    if (limit === 1)
                        return [subject];
                    const parts = subject.split(reg);
                    if (limit > 1 && parts.length > limit) {
                        const extra = parts.slice(limit - 1).join("");
                        return [...parts.slice(0, limit - 1), extra];
                    }
                    return parts;
                }
                catch {
                    return false;
                }
            },
        };
        defineFunction(this.functions.preg_match, {
            name: "preg_match",
            parameters: [{ name: "pattern" }, { name: "subject" }, { name: "matches", byref: true }, { name: "flags" }, { name: "offset" }],
        });
        defineFunction(this.functions.preg_match_all, {
            name: "preg_match_all",
            parameters: [{ name: "pattern" }, { name: "subject" }, { name: "matches", byref: true }, { name: "flags" }, { name: "offset" }],
        });
    }
}
//# sourceMappingURL=pcre.js.map