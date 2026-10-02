import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";
import { defineFunction } from "../runtime/Reflection";

export class PCREExtension extends PHPExtension {
  public readonly name = "pcre";

  private compilePattern(pattern: string, global = false, offsets = false): RegExp {
    const opening = pattern[0];
    if (!opening || /[a-zA-Z0-9\\\s]/.test(opening)) throw new Error("Invalid regular expression delimiter");
    const closing = ({ "(": ")", "[": "]", "{": "}", "<": ">" } as Record<string, string>)[opening] || opening;
    const end = pattern.lastIndexOf(closing);
    if (end < 1) throw new Error("Missing regular expression delimiter");
    let source = pattern.slice(1, end);
    if ("#~%!".includes(opening)) source = source.split(`\\${opening}`).join(opening);
    const modifiers = pattern.slice(end + 1);
    if (modifiers.includes("A")) source = `^(?:${source})`;
    const flags = [...new Set([...modifiers].filter((flag) => "imsu".includes(flag)))].join("");
    return new RegExp(source, flags + (global ? "g" : "") + (offsets ? "d" : ""));
  }

  private captures(match: RegExpExecArray, flags: number): any[] {
    const result: any = [];
    const indices = (match as any).indices;
    const capture = (value: string | undefined, position: number | undefined): any => {
      const content = value === undefined ? ((flags & 512) ? null : "") : value;
      return (flags & 256) ? [content, position ?? -1] : content;
    };
    for (let index = 0; index < match.length; index++) result[index] = capture(match[index], indices?.[index]?.[0]);
    for (const [name, value] of Object.entries(match.groups || {})) result[name] = capture(value, indices?.groups?.[name]?.[0]);
    return result;
  }

  private storeMatches(ctx: PHPContext, target: any, matches: any[]): void {
    if (target && typeof target.set === "function") {
      target.set(matches);
    } else if (target && typeof target === "object") {
      for (const key of Object.keys(target)) delete target[key];
      if (Array.isArray(target)) target.length = 0;
      Object.assign(target, matches);
    }
  }

  public onInit(engine: PHPEngine): void {
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
      preg_match: (ctx: PHPContext, pattern: string, subject: string, matchesObj?: any, flags = 0, offset = 0) => {
        try {
          const input = String(subject ?? "");
          const regex = this.compilePattern(pattern, true, Boolean(flags & 256));
          regex.lastIndex = offset < 0 ? Math.max(0, input.length + offset) : offset;
          const match = regex.exec(input);
          this.storeMatches(ctx, matchesObj, match ? this.captures(match, flags) : []);
          ctx.setInternalVar("lastPregError", 0);
          return match ? 1 : 0;
        } catch {
          this.storeMatches(ctx, matchesObj, []);
          ctx.setInternalVar("lastPregError", 1);
          return false;
        }
      },
      /**
       * Perform a global regular expression match.
       * @param matchesObj Output variable passed by reference to receive all match results.
       */
      preg_match_all: (ctx: PHPContext, pattern: string, subject: string, matchesObj?: any, flags = 1, offset = 0) => {
        try {
          const input = String(subject ?? "");
          const regex = this.compilePattern(pattern, true, Boolean(flags & 256));
          regex.lastIndex = offset < 0 ? Math.max(0, input.length + offset) : offset;
          const rows: any[][] = [];
          let match: RegExpExecArray | null;
          while ((match = regex.exec(input)) !== null) {
            rows.push(this.captures(match, flags));
            if (match[0].length === 0) regex.lastIndex++;
          }
          const matches: any = (flags & 2) ? rows : [];
          if (!(flags & 2)) {
            for (const row of rows) {
              for (const key of Object.keys(row)) (matches[key] ||= []).push((row as any)[key]);
            }
          }
          this.storeMatches(ctx, matchesObj, matches);
          ctx.setInternalVar("lastPregError", 0);
          return rows.length;
        } catch {
          this.storeMatches(ctx, matchesObj, []);
          ctx.setInternalVar("lastPregError", 1);
          return false;
        }
      },
      preg_replace: (ctx: PHPContext, pattern: string, replacement: string, subject: string) => {
        try {
          const regex = this.compilePattern(pattern, true);
          return String(subject || "").replace(regex, replacement);
        } catch {
          return subject;
        }
      },
      preg_replace_callback: async (ctx: PHPContext, pattern: string, callback: any, subject: string) => {
        try {
          const regex = this.compilePattern(pattern, true);
          const input = String(subject || "");
          let output = "";
          let lastIndex = 0;
          let current: RegExpExecArray | null;
          while ((current = regex.exec(input)) !== null) {
            output += input.slice(lastIndex, current.index);
            const captures = Array.from(current);
            let replacement = "";
            if (typeof callback === "string") replacement = String(await ctx.callFunction(callback, [captures]));
            else if (Array.isArray(callback) && callback.length === 2) replacement = String(await ctx.callMethod(callback[0], callback[1], [captures]));
            else if (typeof callback === "function") replacement = String(await callback.apply(ctx, [ctx, captures]));
            output += replacement;
            lastIndex = current.index + current[0].length;
            if (current[0].length === 0) regex.lastIndex++;
          }
          return output + input.slice(lastIndex);
        } catch {
          return subject;
        }
      },
      preg_last_error: (ctx: PHPContext) => ctx.getInternalVar("lastPregError") || 0,
      preg_last_error_msg: (ctx: PHPContext) => ctx.getInternalVar("lastPregError") ? "Internal error" : "No error",
      preg_split: (ctx: PHPContext, pattern: string, subject: string, limit = -1, flags = 0) => {
        try {
          const reg = this.compilePattern(pattern);
          const str = String(subject ?? "");
          const lim = Number(limit);
          if (lim === 1) return [str];
          const parts = str.split(reg);
          if (lim > 1 && parts.length > lim) {
            const extra = parts.slice(lim - 1).join("");
            return [...parts.slice(0, lim - 1), extra];
          }
          return parts;
        } catch {
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
