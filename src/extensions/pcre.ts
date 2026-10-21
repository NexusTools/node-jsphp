import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";

import { defineFunction, encodePhpIdentifier, normalizePhpRegistryName } from "../runtime/Reflection.js";

export class PCREExtension extends PHPExtension {
  public readonly name = "pcre";

  private cleanExtendedRegexPattern(pattern: string): string {
    let inCharClass = false;
    let escaped = false;
    let result = "";

    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];

      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        result += ch;
        escaped = true;
        continue;
      }

      if (ch === "[" && !inCharClass) {
        inCharClass = true;
        result += ch;
        continue;
      }

      if (ch === "]" && inCharClass) {
        inCharClass = false;
        result += ch;
        continue;
      }

      if (inCharClass) {
        result += ch;
        continue;
      }

      if (ch === "#") {
        while (i < pattern.length && pattern[i] !== "\n" && pattern[i] !== "\r") {
          i++;
        }
        continue;
      }

      if (/\s/.test(ch)) {
        continue;
      }

      result += ch;
    }

    return result;
  }

  private compilePattern(pattern: string, global = false, offsets = false): RegExp {
    const opening = pattern[0];
    if (!opening || /[a-zA-Z0-9\\\s]/.test(opening)) throw new Error("Invalid regular expression delimiter");
    const closing = ({ "(": ")", "[": "]", "{": "}", "<": ">" } as Record<string, string>)[opening] || opening;
    const end = pattern.lastIndexOf(closing);
    if (end < 1) throw new Error("Missing regular expression delimiter");
    let source = pattern.slice(1, end);
    source = source.replace(/\(\?P</g, "(?<");
    if ("#~%!".includes(opening)) source = source.split(`\\${opening}`).join(opening);
    const modifiers = pattern.slice(end + 1);
    if (modifiers.includes("A")) source = `^(?:${source})`;
    if (modifiers.includes("x")) {
      source = this.cleanExtendedRegexPattern(source);
    }
    const flags = [...new Set([...modifiers].filter((flag) => "imsu".includes(flag)))].join("");
    return new RegExp(source, flags + (global ? "g" : "") + (offsets ? "d" : ""));
  }

  private fixReplacement(rep: string): string {
    return rep
      .replace(/[\x01-\x09]/g, (m) => "$" + m.charCodeAt(0))
      .replace(/\\([0-9]{1,2})/g, "$$$1");
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

  private async storeMatches(ctx: PHPContext, target: any, matches: any[]): Promise<void> {
    if (target && typeof target.set === "function") {
      await target.set(matches);
    } else if (target && typeof target === "object") {
      for (const key of Object.keys(target)) delete target[key];
      if (Array.isArray(target)) target.length = 0;
      Object.assign(target, matches);
    }
  }

  public async preg_quote(ctx: PHPContext, strArg?: PHPReference, delimiterArg?: PHPReference): Promise<string> {
    const str = String(await strArg?.get() ?? "");
    const rawDelimiter = await delimiterArg?.get();
    const delimiter = rawDelimiter ? String(rawDelimiter) : null;
    let escaped = str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    if (delimiter && delimiter.length > 0) {
      const delimEsc = delimiter.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      escaped = escaped.replace(new RegExp(delimEsc, "g"), "\\" + delimiter);
    }
    return escaped;
  }

  public onInit(engine: PHPEngine): void {
    this.constants = {
      preg_pattern_order: 1,
      preg_set_order: 2,
      preg_offset_capture: 256,
      preg_unmatched_as_null: 512,
      preg_no_error: 0,
      preg_internal_error: 1,
    };
    this.functions = {
      preg_match: async (ctx: PHPContext, patternArg?: PHPReference, subjectArg?: PHPReference, matchesObj?: PHPReference, flagsArg?: PHPReference, offsetArg?: PHPReference) => {
        const pattern = await ctx.str(await patternArg?.get());
        const subject = await ctx.str(await subjectArg?.get());
        const flags = Number(await flagsArg?.get()) || 0;
        const offset = Number(await offsetArg?.get()) || 0;
        try {
          const regex = this.compilePattern(pattern, false, Boolean(flags & 256));
          regex.lastIndex = offset < 0 ? Math.max(0, subject.length + offset) : offset;
          const match = regex.exec(subject);
          await this.storeMatches(ctx, matchesObj, match ? this.captures(match, flags) : []);
          ctx.setInternalVar("lastPregError", 0);
          return match ? 1 : 0;
        } catch {
          await this.storeMatches(ctx, matchesObj, []);
          ctx.setInternalVar("lastPregError", 1);
          return false;
        }
      },
      preg_match_all: async (ctx: PHPContext, patternArg?: PHPReference, subjectArg?: PHPReference, matchesObj?: PHPReference, flagsArg?: PHPReference, offsetArg?: PHPReference) => {
        const pattern = await ctx.str(await patternArg?.get());
        const subject = await ctx.str(await subjectArg?.get());
        const rawFlags = await flagsArg?.get();
        const flags = rawFlags !== undefined ? Number(rawFlags) : 1;
        const offset = Number(await offsetArg?.get()) || 0;
        try {
          const regex = this.compilePattern(pattern, true, Boolean(flags & 256));
          regex.lastIndex = offset < 0 ? Math.max(0, subject.length + offset) : offset;
          const rows: any[][] = [];
          let match: RegExpExecArray | null;
          while ((match = regex.exec(subject)) !== null) {
            rows.push(this.captures(match, flags));
            if (match[0].length === 0) {
              regex.lastIndex++;
              if (regex.lastIndex > subject.length) break;
            }
            if (rows.length >= 10000) break;
          }
          const matches: any = (flags & 2) ? rows : [];
          if (!(flags & 2)) {
            for (const row of rows) {
              for (const key of Object.keys(row)) (matches[key] ||= []).push((row as any)[key]);
            }
          }
          await this.storeMatches(ctx, matchesObj, matches);
          ctx.setInternalVar("lastPregError", 0);
          return rows.length;
        } catch {
          await this.storeMatches(ctx, matchesObj, []);
          ctx.setInternalVar("lastPregError", 1);
          return false;
        }
      },
      preg_replace: async (ctx: PHPContext, patternArg?: PHPReference, replacementArg?: PHPReference, subjectArg?: PHPReference) => {
        const pattern = await patternArg?.get();
        const replacement = await replacementArg?.get();
        const subject = await subjectArg?.get();

        if (Array.isArray(subject)) {
          return Promise.all(subject.map((s) => this.functions.preg_replace(ctx, patternArg, replacementArg, new PHPLiteral(s))));
        }

        let result = await ctx.str(subject);
        const patterns = Array.isArray(pattern) ? pattern : [pattern];
        const replacements = Array.isArray(replacement) ? replacement : [replacement];

        for (let i = 0; i < patterns.length; i++) {
          const pat = await ctx.str(patterns[i]);
          const rep = replacements[i] !== undefined ? await ctx.str(replacements[i]) : (replacements.length > 0 ? await ctx.str(replacements[replacements.length - 1]) : "");
          try {
            const regex = this.compilePattern(pat, true);
            const jsRep = this.fixReplacement(rep);
            result = result.replace(regex, jsRep);
          } catch {
            // Keep current result if pattern is invalid
          }
        }
        return result;
      },
      preg_replace_callback: async (ctx: PHPContext, patternArg?: PHPReference, callbackArg?: PHPReference, subjectArg?: PHPReference) => {
        const pattern = await patternArg?.get();
        const callback = await callbackArg?.get();
        const subject = await subjectArg?.get();

        if (Array.isArray(subject)) {
          const res: any[] = [];
          for (const s of subject) {
            res.push(await this.functions.preg_replace_callback(ctx, patternArg, callbackArg, new PHPLiteral(s)));
          }
          return res;
        }

        let currentSubject = await ctx.str(subject);
        const patterns = Array.isArray(pattern) ? pattern : [pattern];

        for (const patNode of patterns) {
          const pat = await ctx.str(patNode);
          try {
            const regex = this.compilePattern(pat, true);
            let output = "";
            let lastIndex = 0;
            let current: RegExpExecArray | null;
            while ((current = regex.exec(currentSubject)) !== null) {
              output += currentSubject.slice(lastIndex, current.index);
              const captures = Array.from(current);
              let replacement = "";
              const cb = callback;
              if (typeof cb === "string") {
                const fn = ctx.functions[normalizePhpRegistryName(cb)] || ctx.functionMissing(cb);
                replacement = await ctx.str(await fn(ctx, new PHPLiteral(captures)));
              } else if (Array.isArray(cb) && cb.length === 2) {
                const target0 = cb[0] instanceof PHPReference ? await cb[0].get() : cb[0];
                const mName = String(cb[1] instanceof PHPReference ? await cb[1].get() : cb[1]).toLowerCase();
                if (typeof target0 === "string") {
                  const clsName = normalizePhpRegistryName(target0);
                  const cls = ctx.classes[clsName] || ctx.engine.classes[clsName] || (await ctx.resolveClass(clsName, target0));
                  if (cls && typeof cls[mName] === "function") {
                    replacement = await ctx.str(await cls[mName](ctx, new PHPLiteral(captures)));
                  }
                } else if (target0 && typeof target0 === "object") {
                  if (typeof target0[mName] === "function") {
                    replacement = await ctx.str(await target0[mName](ctx, new PHPLiteral(captures)));
                  }
                }
              } else if (typeof cb === "function") {
                replacement = await ctx.str(await cb.apply(ctx, [ctx, new PHPLiteral(captures)]));
              } else if (cb && typeof cb === "object" && typeof cb.__invoke === "function") {
                replacement = await ctx.str(await cb.__invoke(ctx, new PHPLiteral(captures)));
              }
              output += replacement;
              if (current[0].length === 0) {
                regex.lastIndex++;
                lastIndex = regex.lastIndex;
              } else {
                lastIndex = current.index + current[0].length;
              }
            }
            currentSubject = output + currentSubject.slice(lastIndex);
          } catch {
            // Keep currentSubject if pattern is invalid
          }
        }
        return currentSubject;
      },
      preg_last_error: async (ctx: PHPContext) => ctx.getInternalVar("lastPregError") || 0,
      preg_last_error_msg: async (ctx: PHPContext) => ctx.getInternalVar("lastPregError") ? "Internal error" : "No error",
      preg_quote: async (ctx: PHPContext, strArg?: PHPReference, delimiterArg?: PHPReference) => this.preg_quote(ctx, strArg, delimiterArg),
      preg_split: async (ctx: PHPContext, patternArg?: PHPReference, subjectArg?: PHPReference, limitArg?: PHPReference, flagsArg?: PHPReference) => {
        const pattern = await ctx.str(await patternArg?.get());
        const subject = await ctx.str(await subjectArg?.get());
        const rawLimit = await limitArg?.get();
        const limit = rawLimit !== undefined ? Number(rawLimit) : -1;
        const rawFlags = await flagsArg?.get();
        let flags = 0;
        if (typeof rawFlags === "number") {
          flags = rawFlags;
        } else if (typeof rawFlags === "string") {
          if (rawFlags === "PREG_SPLIT_DELIM_CAPTURE") flags = 2;
          else if (rawFlags === "PREG_SPLIT_NO_EMPTY") flags = 1;
          else if (rawFlags === "PREG_SPLIT_OFFSET_CAPTURE") flags = 4;
          else flags = Number(rawFlags) || 0;
        }

        const PREG_SPLIT_NO_EMPTY = 1;
        const PREG_SPLIT_DELIM_CAPTURE = 2;
        const PREG_SPLIT_OFFSET_CAPTURE = 4;

        if (limit === 1) {
          if (flags & PREG_SPLIT_OFFSET_CAPTURE) {
            return [[subject, 0]];
          }
          return [subject];
        }

        try {
          if (flags & PREG_SPLIT_DELIM_CAPTURE) {
            const regex = this.compilePattern(pattern, true);
            let result: any[] = [];
            let lastIdx = 0;
            let m: RegExpExecArray | null;
            while ((m = regex.exec(subject)) !== null) {
              const matchStart = m.index;
              const matchStr = m[0];
              const textBefore = subject.slice(lastIdx, matchStart);
              result.push(textBefore);
              result.push(m[1] !== undefined ? m[1] : "");
              result.push(m[2] !== undefined ? m[2] : (m[0] !== undefined ? m[0] : ""));
              lastIdx = matchStart + matchStr.length;
              if (matchStr.length === 0) {
                regex.lastIndex++;
                if (regex.lastIndex > subject.length) break;
              }
              if (limit > 0 && result.length >= limit * 3) break;
            }
            result.push(subject.slice(lastIdx));

            if (flags & PREG_SPLIT_NO_EMPTY) {
              result = result.filter((p) => p !== "");
            }
            return result;
          }

          let pat = pattern.replace(/\((?!\?:|\?=|\?!|\?<=|\?<!)/g, "(?:");
          const regex = this.compilePattern(pat, true);
          let parts = subject.split(regex);

          if (limit > 0 && parts.length > limit) {
            const extra = parts.slice(limit - 1).join("");
            parts = [...parts.slice(0, limit - 1), extra];
          }

          if (flags & PREG_SPLIT_NO_EMPTY) {
            parts = parts.filter((p) => p !== "");
          }

          if (flags & PREG_SPLIT_OFFSET_CAPTURE) {
            let offset = 0;
            return parts.map((p) => {
              const idx = subject.indexOf(p, offset);
              offset = idx >= 0 ? idx + p.length : offset;
              return [p, idx >= 0 ? idx : 0];
            });
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
