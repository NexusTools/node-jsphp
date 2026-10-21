import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable.js";
import { PHPError, PHPWarning } from "./PHPError.js";

import { defineFunction } from "./Reflection.js";

export class StringRuntime {

  /** Gets string length. */
  public static async strlen(ctx: PHPContext, strArg?: any): Promise<number>{
    const str = await ctx.toVal(strArg);
    if (Buffer.isBuffer(str)) return str.length;
    return String(str ?? "").length;
  }

  /** Count the number of substring occurrences. */
  public static async substr_count(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): Promise<number>{
    const rawOffset = await offsetArg?.get();
    const rawLength = await lengthArg?.get();
    const offset = Number(rawOffset) || 0;
    const length = rawLength !== undefined ? Number(rawLength) : undefined;
    const source = String(await haystackArg?.get() ?? "").slice(offset, length === undefined ? undefined : offset + length);
    const search = String(await needleArg?.get() ?? "");
    if (!search) return 0;
    let count = 0;
    let position = 0;
    while ((position = source.indexOf(search, position)) !== -1) {
      count++;
      position += search.length;
    }
    return count;
  }

  /** Return part of a string. */
  public static async substr(ctx: PHPContext, strArg?: any, startArg?: any, lengthArg?: any): Promise<string>{
    const s = await ctx.str(await ctx.toVal(strArg));
    const startVal = await ctx.toVal(startArg);
    let start = Number(startVal) || 0;
    const lenVal = await ctx.toVal(lengthArg);
    const length = lenVal !== undefined && lenVal !== null ? Number(lenVal) : undefined;

    if (start < 0) start = s.length + start;
    if (length !== undefined) {
      if (length < 0) return s.substring(start, s.length + length);
      return s.substring(start, start + length);
    }
    return s.substring(start);
  }

  /** Replace text within a portion of a string. */
  public static async substr_replace(ctx: PHPContext, subjectArg?: PHPReference, replacementArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): Promise<string | string[]>{
    const subject = await subjectArg?.get();
    const replacement = await replacementArg?.get();
    const offset = await offsetArg?.get();
    const length = await lengthArg?.get();

    if (Array.isArray(subject)) {
      const results: string[] = [];
      for (let index = 0; index < subject.length; index++) {
        results.push(String(await StringRuntime.substr_replace(
          ctx,
          new PHPLiteral(subject[index]),
          new PHPLiteral(Array.isArray(replacement) ? replacement[index] ?? "" : replacement),
          new PHPLiteral(Array.isArray(offset) ? offset[index] ?? 0 : offset),
          new PHPLiteral(Array.isArray(length) ? length[index] : length)
        )));
      }
      return results;
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
  public static async strpos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): Promise<number | false>{
    const haystack = String(await haystackArg?.get() ?? "");
    const needle = String(await needleArg?.get() ?? "");
    const offset = Number(await offsetArg?.get()) || 0;
    const idx = haystack.indexOf(needle, offset);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the first occurrence of a case-insensitive substring in a string. */
  public static async stripos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): Promise<number | false>{
    const haystack = String(await haystackArg?.get() ?? "").toLowerCase();
    const needle = String(await needleArg?.get() ?? "").toLowerCase();
    const offset = Number(await offsetArg?.get()) || 0;
    const idx = haystack.indexOf(needle, offset);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the last occurrence of a substring in a string. */
  public static async strrpos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): Promise<number | false>{
    const haystack = String(await haystackArg?.get() ?? "");
    const needle = String(await needleArg?.get() ?? "");
    const offset = Number(await offsetArg?.get()) || 0;
    const idx = haystack.lastIndexOf(needle, offset || undefined);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the last occurrence of a case-insensitive substring in a string. */
  public static async strripos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): Promise<number | false>{
    const haystack = String(await haystackArg?.get() ?? "").toLowerCase();
    const needle = String(await needleArg?.get() ?? "").toLowerCase();
    const offset = Number(await offsetArg?.get()) || 0;
    const idx = haystack.lastIndexOf(needle, offset || undefined);
    return idx === -1 ? false : idx;
  }

  /** Find the first occurrence of a string. */
  public static async strstr(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, beforeNeedleArg?: PHPReference): Promise<string | false>{
    const s = String(await haystackArg?.get() ?? "");
    const n = String(await needleArg?.get() ?? "");
    const beforeNeedle = Boolean(await beforeNeedleArg?.get());
    const idx = s.indexOf(n);
    if (idx === -1) return false;
    return beforeNeedle ? s.substring(0, idx) : s.substring(idx);
  }

  /** Find the first case-insensitive occurrence of a string. */
  public static async stristr(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, beforeNeedleArg?: PHPReference): Promise<string | false>{
    const s = String(await haystackArg?.get() ?? "");
    const n = String(await needleArg?.get() ?? "");
    const beforeNeedle = Boolean(await beforeNeedleArg?.get());
    const idx = s.toLowerCase().indexOf(n.toLowerCase());
    if (idx === -1) return false;
    return beforeNeedle ? s.substring(0, idx) : s.substring(idx);
  }

  /**
   * Replace all occurrences of the search string with the replacement string.
   * @param countRef Output variable passed by reference to receive replacement count.
   */
  public static async str_replace(ctx: PHPContext, searchArg?: PHPReference, replaceArg?: PHPReference, subjectArg?: PHPReference, countRef?: PHPReference): Promise<any>{
    const search = await searchArg?.get();
    const replace = await replaceArg?.get();
    const subject = await subjectArg?.get();
    var replaceCount = 0;

    if (Array.isArray(subject)) {
      const res = await Promise.all(subject.map((s) => StringRuntime.str_replace(ctx, new PHPLiteral(search), new PHPLiteral(replace), new PHPLiteral(s), countRef)));
      if (countRef && typeof countRef.set === "function") await countRef.set(replaceCount);
      return res;
    }
    let s = String(subject ?? "");
    const searches = Array.isArray(search) ? search : [search];
    const replaces = Array.isArray(replace) ? replace : [replace];

    searches.forEach((sch, i) => {
      const rep = replaces[i] !== undefined ? replaces[i] : replaces[replaces.length - 1] || "";
      if (String(sch)) replaceCount += s.split(String(sch)).length - 1;
      s = s.split(String(sch)).join(String(rep));
    });

    if (countRef && typeof countRef.set === "function") {
      await countRef.set(replaceCount);
    }
    return s;
  }

  /** Translate characters or replace substrings. */
  public static async strtr(ctx: PHPContext, subjectArg?: PHPReference, fromArg?: PHPReference, toArg?: PHPReference): Promise<string>{
    let result = String(await subjectArg?.get() ?? "");
    const from = await fromArg?.get();
    const to = await toArg?.get();

    if (from && typeof from === "object" && !Array.isArray(from)) {
      for (const [search, replacement] of Object.entries(from)) result = result.split(search).join(String(replacement));
      return result;
    }
    const search = String(from ?? "");
    const replacement = String(to ?? "");
    return result.split(search).join(replacement);
  }

  /** Case-insensitive version of str_replace. */
  public static async str_ireplace(ctx: PHPContext, searchArg?: PHPReference, replaceArg?: PHPReference, subjectArg?: PHPReference, countRef?: PHPReference): Promise<any>{
    const search = await searchArg?.get();
    const replace = await replaceArg?.get();
    const subject = await subjectArg?.get();

    if (Array.isArray(subject)) {
      return Promise.all(subject.map((s) => StringRuntime.str_ireplace(ctx, new PHPLiteral(search), new PHPLiteral(replace), new PHPLiteral(s), countRef)));
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
  public static async sprintf(ctx: PHPContext, fmtArg?: PHPReference, ...args: PHPReference[]): Promise<string>{
    const fmt = String(await fmtArg?.get() ?? "");
    let argIndex = 0;
    const formatPattern = /%(\d+\$)?([-+0' ])?(\d+)?(\.\d+)?([%sbcdeufFoghxX])/g;
    let output = "";
    let previousIndex = 0;
    for (const match of fmt.matchAll(formatPattern)) {
      const [whole, param, flags, width, precision, type] = match;
      const matchIndex = match.index!;
      output += fmt.slice(previousIndex, matchIndex);
      previousIndex = matchIndex + whole.length;
      if (type === "%") {
        output += "%";
        continue;
      }

      let idx = argIndex;
      if (param) {
        idx = parseInt(param.slice(0, -1), 10) - 1;
      } else {
        argIndex++;
      }

      const val = await args[idx]?.get();
      let str = "";

      const numWidth = width ? parseInt(width, 10) : 0;
      const padChar = flags && flags.includes("0") ? "0" : " ";
      const leftAlign = flags && flags.includes("-");

      if (type === "s") {
        str = String(val ?? "");
        if (precision) {
          str = str.slice(0, parseInt(precision.slice(1), 10));
        }
      } else if (type === "d" || type === "i" || type === "u") {
        const num = Math.trunc(Number(val) || 0);
        str = String(type === "u" ? Math.abs(num) : num);
      } else if (type === "f" || type === "F") {
        const num = Number(val) || 0;
        const prec = precision ? parseInt(precision.slice(1), 10) : 6;
        str = num.toFixed(prec);
      } else if (type === "x") {
        str = (parseInt(val, 10) || 0).toString(16);
      } else if (type === "X") {
        str = (parseInt(val, 10) || 0).toString(16).toUpperCase();
      } else if (type === "b") {
        str = (parseInt(val, 10) || 0).toString(2);
      } else if (type === "o") {
        str = (parseInt(val, 10) || 0).toString(8);
      } else if (type === "c") {
        str = String.fromCharCode(parseInt(val, 10) || 0);
      } else {
        str = String(val ?? "");
      }

      if (str.length < numWidth) {
        const padLen = numWidth - str.length;
        if (padLen > 1000000) throw new PHPWarning("str_pad(): padding length is too large");
    const padding = padChar.repeat(padLen);
        str = leftAlign ? str + padding : padding + str;
      }

      output += str;
    }
    return output + fmt.slice(previousIndex);
  }

  /** Output a formatted string. */
  public static async printf(ctx: PHPContext, fmtArg?: PHPReference, ...args: PHPReference[]): Promise<number> {
    const output = await StringRuntime.sprintf(ctx, fmtArg, ...args);
    await ctx.echo(output);
    return output.length;
  }

  /** Split a string by a string. */
  public static async explode(ctx: PHPContext, delimiterArg?: PHPReference, stringArg?: PHPReference, limitArg?: PHPReference): Promise<string[]>{
    const delimiter = String(await delimiterArg?.get() ?? "");
    const string = String(await stringArg?.get() ?? "");
    const rawLimit = await limitArg?.get();
    const limit = rawLimit !== undefined ? Number(rawLimit) : undefined;
    const res = string.split(delimiter);
    if (limit !== undefined && limit > 0 && res.length > limit) {
      return [...res.slice(0, limit - 1), res.slice(limit - 1).join(delimiter)];
    }
    return res;
  }

  /** Join array elements with a string. */
  public static async implode(ctx: PHPContext, glueArg?: PHPReference, piecesArg?: PHPReference): Promise<string>{
    const val1 = await glueArg?.get();
    const val2 = await piecesArg?.get();

    let glue = "";
    let pieces: any[] = [];

    if (Array.isArray(val1) || (val1 && typeof val1 === "object" && (val1.constructor === Object || val1.constructor === Array))) {
      pieces = Array.isArray(val1) ? val1 : Object.values(val1);
      glue = val2 !== undefined && val2 !== null ? String(val2) : "";
    } else if (Array.isArray(val2) || (val2 && typeof val2 === "object" && (val2.constructor === Object || val2.constructor === Array))) {
      pieces = Array.isArray(val2) ? val2 : Object.values(val2);
      glue = val1 !== undefined && val1 !== null ? String(val1) : "";
    }

    return (await Promise.all(pieces.map(async (piece) => String(await ctx.toVal(piece) ?? "")))).join(glue);
  }

  /** Strip whitespace (or other characters) from the beginning and end of a string. */
  public static async trim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): Promise<string>{
    const s = await ctx.str(await strArg?.get());
    const charlist = await charlistArg?.get();
    if (!charlist) return s.trim();
    const mask = String(charlist).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`^[${mask}]+|[${mask}]+$`, "g"), "");
  }

  /** Strip whitespace (or other characters) from the beginning of a string. */
  public static async ltrim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): Promise<string>{
    const s = await ctx.str(await strArg?.get());
    const charlist = await charlistArg?.get();
    if (!charlist) return s.trimStart();
    const mask = String(charlist).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`^[${mask}]+`, "g"), "");
  }

  /** Strip whitespace (or other characters) from the end of a string. */
  public static async rtrim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): Promise<string>{
    const s = await ctx.str(await strArg?.get());
    const charlist = await charlistArg?.get();
    if (!charlist) return s.trimEnd();
    const mask = String(charlist).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`[${mask}]+$`, "g"), "");
  }

  /** Strip HTML and PHP tags from a string. */
  public static async strip_tags(ctx: PHPContext, strArg?: PHPReference, allowable_tagsArg?: PHPReference): Promise<string>{
    const s = String(await strArg?.get() ?? "");
    const allowable_tags = await allowable_tagsArg?.get();
    if (!allowable_tags) {
      return s.replace(/<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>|<[^>]*>/gi, "");
    }
    const tags = Array.isArray(allowable_tags)
      ? allowable_tags
      : String(allowable_tags).match(/<[a-z0-9]+>/gi) || [];
    const allowed = new Set(tags.map((t: string) => t.replace(/[<>]/g, "").toLowerCase()));
    return s.replace(/<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>|<(?:\/)?([a-z0-9]+)[^>]*>/gi, (match, tagName) => {
      if (tagName && allowed.has(tagName.toLowerCase())) return match;
      return "";
    });
  }

  /** Make a string lowercase. */
  public static async strtolower(ctx: PHPContext, strArg?: PHPReference): Promise<string>{ return String(await strArg?.get() ?? "").toLowerCase(); }
  /** Make a string uppercase. */
  public static async strtoupper(ctx: PHPContext, strArg?: PHPReference): Promise<string>{ return String(await strArg?.get() ?? "").toUpperCase(); }
  /** Make a string's first character uppercase. */
  public static async ucfirst(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    const s = String(await strArg?.get() ?? "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /** Make a string's first character lowercase. */
  public static async lcfirst(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    const s = String(await strArg?.get() ?? "");
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  /** Uppercase the first character of each word in a string. */
  public static async ucwords(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    return String(await strArg?.get() ?? "").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /** Binary safe string comparison. */
  public static async strcmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference): Promise<number>{
    const s1 = String(await str1Arg?.get() ?? "");
    const s2 = String(await str2Arg?.get() ?? "");
    return s1.localeCompare(s2);
  }

  /** Binary safe string comparison of the first n characters. */
  public static async strncmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference, lengthArg?: PHPReference): Promise<number>{
    const length = Number(await lengthArg?.get()) || 0;
    return StringRuntime.strcmp(ctx, new PHPLiteral(String(await str1Arg?.get() ?? "").slice(0, length)), new PHPLiteral(String(await str2Arg?.get() ?? "").slice(0, length)));
  }

  /** Binary safe case-insensitive string comparison. */
  public static async strcasecmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference): Promise<number>{
    const s1 = String(await str1Arg?.get() ?? "").toLowerCase();
    const s2 = String(await str2Arg?.get() ?? "").toLowerCase();
    if (s1 === s2) return 0;
    return s1 < s2 ? -1 : 1;
  }

  /** Binary safe case-insensitive string comparison of the first n characters. */
  public static async strncasecmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference, lengthArg?: PHPReference): Promise<number>{
    const length = Number(await lengthArg?.get()) || 0;
    return StringRuntime.strcasecmp(ctx, new PHPLiteral(String(await str1Arg?.get() ?? "").slice(0, length)), new PHPLiteral(String(await str2Arg?.get() ?? "").slice(0, length)));
  }

  public static async strnatcmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference): Promise<number>{
    const s1 = await ctx.str(await str1Arg?.get());
    const s2 = await ctx.str(await str2Arg?.get());
    return s1.localeCompare(s2, undefined, { numeric: true });
  }

  public static async strnatcasecmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference): Promise<number>{
    const s1 = (await ctx.str(await str1Arg?.get())).toLowerCase();
    const s2 = (await ctx.str(await str2Arg?.get())).toLowerCase();
    return s1.localeCompare(s2, undefined, { numeric: true, sensitivity: "base" });
  }

  /** Quote string with slashes. */
  public static async addslashes(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    return (await ctx.str(strArg)).replace(/[\\\"']/g, "\\$&").replace(/\u0000/g, "\\0");
  }

  public static async addcslashes(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): Promise<string>{
    const string = String(await strArg?.get() ?? "");
    const list = String(await charlistArg?.get() ?? "");
    const chars = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      if (list[i] === "\\" && i + 1 < list.length) {
        chars.add(list[++i]);
      } else if (i + 3 < list.length && list[i + 1] === "." && list[i + 2] === ".") {
        const start = list.charCodeAt(i);
        const end = list.charCodeAt(i + 3);
        for (let c = start; c <= end; c++) {
          chars.add(String.fromCharCode(c));
        }
        i += 3;
      } else {
        chars.add(list[i]);
      }
    }
    let res = "";
    for (let i = 0; i < string.length; i++) {
      const ch = string[i];
      if (chars.has(ch)) {
        if (ch === "\n") res += "\\n";
        else if (ch === "\r") res += "\\r";
        else if (ch === "\t") res += "\\t";
        else res += "\\" + ch;
      } else {
        res += ch;
      }
    }
    return res;
  }

  /** Un-quotes a quoted string. */
  public static async stripslashes(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    return (await ctx.str(strArg)).replace(/\\(['"\\0])/g, "$1");
  }

  public static async stripcslashes(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    return StringRuntime.stripslashes(ctx, strArg);
  }

  /** Convert special characters to HTML entities. */
  public static async htmlspecialchars(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    return (await ctx.str(strArg))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /** Convert special HTML entities back to characters. */
  public static async htmlspecialchars_decode(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    return String(await strArg?.get() ?? "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  public static async htmlentities(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    return StringRuntime.htmlspecialchars(ctx, strArg);
  }

  public static async html_entity_decode(ctx: PHPContext, strArg?: PHPReference): Promise<string>{
    return StringRuntime.htmlspecialchars_decode(ctx, strArg);
  }

  public static async unpack(ctx: PHPContext, formatArg?: PHPReference, stringArg?: PHPReference, offsetArg?: PHPReference): Promise<Record<string, number> | false>{
    const format = String(await formatArg?.get() ?? "");
    const rawStr = await stringArg?.get();
    const offset = Number(await offsetArg?.get()) || 0;
    if (rawStr === undefined || rawStr === null || !format) return false;

    const buffer = Buffer.isBuffer(rawStr) ? rawStr : Buffer.from(String(rawStr), "binary");
    const result: Record<string, number> = {};
    let bufIdx = offset;

    const codes = format.split("/");
    let autoIdx = 1;

    for (const item of codes) {
      if (!item) continue;
      const type = item[0];
      const name = item.slice(1) || String(autoIdx++);
      if (bufIdx >= buffer.length) break;

      if (type === "N") {
        if (bufIdx + 4 > buffer.length) break;
        result[name] = buffer.readUInt32BE(bufIdx);
        bufIdx += 4;
      } else if (type === "V") {
        if (bufIdx + 4 > buffer.length) break;
        result[name] = buffer.readUInt32LE(bufIdx);
        bufIdx += 4;
      } else if (type === "n") {
        if (bufIdx + 2 > buffer.length) break;
        result[name] = buffer.readUInt16BE(bufIdx);
        bufIdx += 2;
      } else if (type === "v") {
        if (bufIdx + 2 > buffer.length) break;
        result[name] = buffer.readUInt16LE(bufIdx);
        bufIdx += 2;
      } else if (type === "C") {
        result[name] = buffer.readUInt8(bufIdx);
        bufIdx += 1;
      } else if (type === "c") {
        result[name] = buffer.readInt8(bufIdx);
        bufIdx += 1;
      }
    }

    return Object.keys(result).length > 0 ? result : false;
  }

  public static async pack(ctx: PHPContext, formatArg?: PHPReference, ...args: PHPReference[]): Promise<string>{
    const format = String(await formatArg?.get() ?? "");
    const values = await Promise.all(args.map((arg) => arg?.get()));
    const buffer = Buffer.alloc(1024);
    let offset = 0;
    let valIdx = 0;

    for (let i = 0; i < format.length; i++) {
      const type = format[i];
      const val = Number(values[valIdx++]) || 0;
      if (type === "N") {
        buffer.writeUInt32BE(val, offset);
        offset += 4;
      } else if (type === "V") {
        buffer.writeUInt32LE(val, offset);
        offset += 4;
      } else if (type === "n") {
        buffer.writeUInt16BE(val, offset);
        offset += 2;
      } else if (type === "v") {
        buffer.writeUInt16LE(val, offset);
        offset += 2;
      } else if (type === "C") {
        buffer.writeUInt8(val, offset);
        offset += 1;
      }
    }
    return buffer.subarray(0, offset).toString("binary");
  }

  private static strtokState: { str: string; token: string; index: number } | null = null;

  public static async strtok(ctx: PHPContext, strArg?: PHPReference, tokenArg?: PHPReference): Promise<string | false>{
    let str: string | undefined;
    let token: string | undefined;

    if (tokenArg === undefined) {
      token = String(await strArg?.get() ?? "");
    } else {
      str = String(await strArg?.get() ?? "");
      token = String(await tokenArg?.get() ?? "");
    }

    if (str !== undefined) {
      StringRuntime.strtokState = { str, token, index: 0 };
    }

    if (!StringRuntime.strtokState) return false;

    const state = StringRuntime.strtokState;
    if (state.index >= state.str.length) return false;

    const separators = new Set(token.split(""));
    while (state.index < state.str.length && separators.has(state.str[state.index])) {
      state.index++;
    }

    if (state.index >= state.str.length) return false;

    const start = state.index;
    while (state.index < state.str.length && !separators.has(state.str[state.index])) {
      state.index++;
    }

    return state.str.substring(start, state.index);
  }

  /** Inserts HTML line breaks before all newlines in a string. */
  public static async nl2br(ctx: PHPContext, strArg?: PHPReference, isXhtmlArg?: PHPReference): Promise<string>{
    const rawXhtml = await isXhtmlArg?.get();
    const isXhtml = rawXhtml !== undefined ? Boolean(rawXhtml) : true;
    const breakTag = isXhtml ? "<br />" : "<br>";
    return String(await strArg?.get() ?? "").replace(/(\r\n|\n\r|\r|\n)/g, breakTag + "$1");
  }

  /** Repeat a string. */
  public static async str_repeat(ctx: PHPContext, inputArg?: PHPReference, multiplierArg?: PHPReference): Promise<string>{
    const input = String(await inputArg?.get() ?? "");
    const multiplier = Number(await multiplierArg?.get()) || 0;
    if (multiplier > 1000000) throw new PHPWarning("str_repeat(): multiplier is too large");
    return input.repeat(Math.max(0, multiplier));
  }

  /** Pad a string to a certain length with another string. */
  public static async str_pad(ctx: PHPContext, inputArg?: PHPReference, padLengthArg?: PHPReference, padStringArg?: PHPReference, padTypeArg?: PHPReference): Promise<string>{
    let s = String(await inputArg?.get() ?? "");
    const padLength = Number(await padLengthArg?.get()) || 0;
    const rawPadString = await padStringArg?.get();
    const padString = rawPadString !== undefined ? String(rawPadString) : " ";
    const rawPadType = await padTypeArg?.get();
    const padType = rawPadType !== undefined ? Number(rawPadType) : 1;
    if (s.length >= padLength || !padString) return s;
    const needed = padLength - s.length;
    const pStr = padString.repeat(Math.ceil(needed / padString.length)).substring(0, needed);
    if (padType === 0) return pStr + s; // STR_PAD_LEFT
    if (padType === 2) { // STR_PAD_BOTH
      const left = Math.floor(needed / 2);
      const right = needed - left;
      return pStr.substring(0, left) + s + pStr.substring(0, right);
    }
    return s + pStr; // STR_PAD_RIGHT
  }

  /** Convert a string to an array. */
  public static async str_split(ctx: PHPContext, stringArg?: PHPReference, lengthArg?: PHPReference): Promise<string[]>{
    const s = String(await stringArg?.get() ?? "");
    let length = Number(await lengthArg?.get());
    if (isNaN(length) || length < 1) length = 1;
    const res: string[] = [];
    for (let i = 0; i < s.length; i += length) {
      res.push(s.substring(i, i + length));
    }
    return res;
  }

  /** Reverse a string. */
  public static async strrev(ctx: PHPContext, stringArg?: PHPReference): Promise<string>{
    return String(await stringArg?.get() ?? "").split("").reverse().join("");
  }

  /** Generate a single-byte string from a number. */
  public static async chr(ctx: PHPContext, asciiArg?: any): Promise<string>{
    const val = await ctx.toVal(asciiArg);
    const ascii = (Number(val) || 0) & 0xff;
    return String.fromCharCode(ascii);
  }

  /** Convert the first byte of a string to a value between 0 and 255. */
  public static async ord(ctx: PHPContext, characterArg?: any): Promise<number>{
    const val = await ctx.toVal(characterArg);
    if (typeof val === "number") return val & 0xff;
    if (Buffer.isBuffer(val)) return val.length > 0 ? val[0] : 0;
    const str = await ctx.str(val);
    return str.length > 0 ? str.charCodeAt(0) & 0xff : 0;
  }

  /** Format a number with grouped thousands. */
  public static async number_format(
    ctx: PHPContext,
    numArg?: any,
    decimalsArg?: any,
    decPointArg?: any,
    thousandsSepArg?: any
  ): Promise<string>{
    let numVal = await ctx.toVal(numArg);
    const num = Number(numVal) || 0;

    let decimalsVal = await ctx.toVal(decimalsArg);
    const decimals = decimalsVal !== undefined && decimalsVal !== null ? Math.max(0, Math.trunc(Number(decimalsVal))) : 0;

    let decPointVal = await ctx.toVal(decPointArg);
    const decPoint = decPointVal !== undefined && decPointVal !== null ? await ctx.str(decPointVal) : ".";

    let thousandsSepVal = await ctx.toVal(thousandsSepArg);
    const thousandsSep = thousandsSepVal !== undefined && thousandsSepVal !== null ? await ctx.str(thousandsSepVal) : ",";

    const fixed = num.toFixed(decimals);
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
    return parts.join(decPoint);
  }

  /** Convert binary data into hexadecimal representation. */
  public static async bin2hex(ctx: PHPContext, stringArg?: PHPReference): Promise<string>{
    return Buffer.from(String(await stringArg?.get() ?? "")).toString("hex");
  }

  /** Decodes a hexadecimally encoded binary string. */
  public static async hex2bin(ctx: PHPContext, hexStringArg?: PHPReference): Promise<string>{
    return Buffer.from(String(await hexStringArg?.get() ?? ""), "hex").toString("utf8");
  }

  public static async substr_compare(ctx: PHPContext, mainStrArg?: PHPReference, strArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference, caseInsensitiveArg?: PHPReference): Promise<number>{
    const mainStr = await ctx.str(await mainStrArg?.get());
    const str = await ctx.str(await strArg?.get());
    let offset = Number(await offsetArg?.get()) || 0;
    if (offset < 0) offset = mainStr.length + offset;
    if (offset < 0 || offset >= mainStr.length) return -1;

    const rawLength = await lengthArg?.get();
    const length = rawLength !== undefined && rawLength !== null ? Number(rawLength) : str.length;
    const caseInsensitive = Boolean(await caseInsensitiveArg?.get());

    let sub1 = mainStr.slice(offset, offset + length);
    let sub2 = str.slice(0, length);
    if (caseInsensitive) {
      sub1 = sub1.toLowerCase();
      sub2 = sub2.toLowerCase();
    }

    return sub1 < sub2 ? -1 : (sub1 > sub2 ? 1 : 0);
  }

  public static async base64_encode(ctx: PHPContext, stringArg?: any): Promise<string>{
    const val = await ctx.toVal(stringArg);
    if (Buffer.isBuffer(val)) {
      return val.toString("base64");
    }
    const str = await ctx.str(val);
    return Buffer.from(str, "binary").toString("base64");
  }

  public static async base64_decode(ctx: PHPContext, stringArg?: any): Promise<string>{
    const val = await ctx.toVal(stringArg);
    const str = await ctx.str(val);
    return Buffer.from(str, "base64").toString("binary");
  }

  /** Compares two "PHP-standardized" version number strings. */
  public static async version_compare(ctx: PHPContext, v1Arg?: PHPReference, v2Arg?: PHPReference, opArg?: PHPReference): Promise<any>{
    const v1 = String(await v1Arg?.get() ?? "");
    const v2 = String(await v2Arg?.get() ?? "");
    const rawOp = await opArg?.get();
    const op = rawOp !== undefined ? String(rawOp) : undefined;
    const parse = (v: string) => (v || "").split(".").map((n) => parseInt(n, 10) || 0);
    const p1 = parse(v1);
    const p2 = parse(v2);
    const max = Math.max(p1.length, p2.length);
    let comp = 0;
    for (let i = 0; i < max; i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) { comp = 1; break; }
      if (n1 < n2) { comp = -1; break; }
    }
    if (!op) return comp;
    switch (op) {
      case "<": case "lt": return comp < 0;
      case "<=": case "le": return comp <= 0;
      case ">": case "gt": return comp > 0;
      case ">=": case "ge": return comp >= 0;
      case "==": case "=": case "eq": return comp === 0;
      case "!=": case "<>": case "ne": return comp !== 0;
      default: return false;
    }
  }

  /**
   * Parses encoded query string into variables.
   * @param result Output variable passed by reference to receive parsed key-value pairs.
   */
  public static async parse_str(ctx: PHPContext, queryArg?: PHPReference, result?: PHPReference): Promise<void>{
    const query = String(await queryArg?.get() ?? "");
    const parsed: Record<string, any> = Object.create(null);
    for (const [name, value] of new URLSearchParams(query)) {
      const bracket = name.indexOf("[");
      const rawBase = bracket < 0 ? name : name.slice(0, bracket);
      const base = rawBase.replace(/[ .]/g, "_");
      if (!base) continue;
      const subKeys = Array.from(
        name.slice(bracket < 0 ? name.length : bracket).matchAll(/\[([^\]]*)\]/g),
        (match) => match[1]
      );
      const keys = [base, ...subKeys];
      let target = parsed;
      keys.forEach((part, index) => {
        const key = part === ""
          ? String(Math.max(-1, ...Object.keys(target).filter((entry) => /^(0|[1-9]\d*)$/.test(entry)).map(Number)) + 1)
          : part;
        if (index === keys.length - 1) {
          target[key] = value;
        } else {
          if (!target[key] || typeof target[key] !== "object") {
            target[key] = Object.create(null);
          }
          target = target[key];
        }
      });
    }
    const normalize = (value: any): any => {
      if (!value || typeof value !== "object") return value;
      const keys = Object.keys(value);
      if (keys.length > 0 && keys.every((key, index) => key === String(index))) {
        return keys.map((key) => normalize(value[key]));
      }
      const obj: Record<string, any> = {};
      for (const key of keys) {
        Object.defineProperty(obj, key, { value: normalize(value[key]), enumerable: true, writable: true, configurable: true });
      }
      return obj;
    };
    const output = normalize(parsed);
    ctx.setInternalVar("lastParseStrResult", output);

    if (result && typeof result.set === "function") {
      await result.set(output);
    } else {
      for (const [k, v] of Object.entries(output)) {
        await ctx.setVar(k, v);
      }
    }
  }

  public static async strspn(ctx: PHPContext, stringArg?: PHPReference, charactersArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): Promise<number>{
    const str = String(await stringArg?.get() ?? "");
    const mask = String(await charactersArg?.get() ?? "");
    let offset = Number(await offsetArg?.get()) || 0;
    if (offset < 0) offset += str.length;
    if (offset < 0) offset = 0;
    const rawLength = await lengthArg?.get();
    let len = rawLength !== undefined && rawLength !== null ? Number(rawLength) : str.length - offset;
    if (len < 0) len += str.length - offset;
    const sub = str.substring(offset, offset + Math.max(0, len));
    const maskSet = new Set(mask);
    let count = 0;
    for (const char of sub) {
      if (maskSet.has(char)) count++;
      else break;
    }
    return count;
  }

  public static async strcspn(ctx: PHPContext, stringArg?: PHPReference, charactersArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): Promise<number>{
    const str = String(await stringArg?.get() ?? "");
    const mask = String(await charactersArg?.get() ?? "");
    let offset = Number(await offsetArg?.get()) || 0;
    if (offset < 0) offset += str.length;
    if (offset < 0) offset = 0;
    const rawLength = await lengthArg?.get();
    let len = rawLength !== undefined && rawLength !== null ? Number(rawLength) : str.length - offset;
    if (len < 0) len += str.length - offset;
    const sub = str.substring(offset, offset + Math.max(0, len));
    const maskSet = new Set(mask);
    let count = 0;
    for (const char of sub) {
      if (!maskSet.has(char)) count++;
      else break;
    }
    return count;
  }

  public static async vsprintf(ctx: PHPContext, formatArg?: PHPReference, valuesArg?: PHPReference): Promise<string>{
    const format = String(await formatArg?.get() ?? "");
    const values = await valuesArg?.get();
    const arr = Array.isArray(values) ? values : (typeof values === "object" && values !== null ? Object.values(values) : []);
    const argsRefs = arr.map((v) => new PHPLiteral(v));
    return StringRuntime.sprintf(ctx, new PHPLiteral(format), ...argsRefs);
  }

  public static async str_starts_with(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference): Promise<boolean>{
    const haystack = String(await haystackArg?.get() ?? "");
    const needle = String(await needleArg?.get() ?? "");
    if (needle === "") return true;
    return haystack.startsWith(needle);
  }

  public static async str_ends_with(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference): Promise<boolean>{
    const haystack = String(await haystackArg?.get() ?? "");
    const needle = String(await needleArg?.get() ?? "");
    if (needle === "") return true;
    return haystack.endsWith(needle);
  }

  public static async str_contains(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference): Promise<boolean>{
    const haystack = String(await haystackArg?.get() ?? "");
    const needle = String(await needleArg?.get() ?? "");
    if (needle === "") return true;
    return haystack.includes(needle);
  }

  /** Search a string for any of a set of characters. */
  public static async strpbrk(ctx: PHPContext, stringArg?: any, charlistArg?: any): Promise<string | false>{
    const s = await ctx.toVal(stringArg);
    const charlist = await ctx.toVal(charlistArg);

    const str = await ctx.str(s);
    const chars = await ctx.str(charlist);

    for (let i = 0; i < str.length; i++) {
      if (chars.includes(str[i])) {
        return str.substring(i);
      }
    }
    return false;
  }

  public static async vprintf(ctx: PHPContext, formatArg?: PHPReference, valuesArg?: PHPReference): Promise<number>{
    const res = await StringRuntime.vsprintf(ctx, formatArg, valuesArg);
    await ctx.echo(res);
    return res.length;
  }

  static functions = {
    "str_starts_with": StringRuntime.str_starts_with,
    "str_ends_with": StringRuntime.str_ends_with,
    "str_contains": StringRuntime.str_contains,
    "parse_str": StringRuntime.parse_str,
    "version_compare": StringRuntime.version_compare,
    "unpack": StringRuntime.unpack,
    "pack": StringRuntime.pack,
    "strlen": StringRuntime.strlen,
    "substr_count": StringRuntime.substr_count,
    "substr": StringRuntime.substr,
    "substr_compare": StringRuntime.substr_compare,
    "substr_replace": StringRuntime.substr_replace,
    "strpos": StringRuntime.strpos,
    "stripos": StringRuntime.stripos,
    "strrpos": StringRuntime.strrpos,
    "strripos": StringRuntime.strripos,
    "strstr": StringRuntime.strstr,
    "stristr": StringRuntime.stristr,
    "str_replace": StringRuntime.str_replace,
    "strtr": StringRuntime.strtr,
    "str_ireplace": StringRuntime.str_ireplace,
    "sprintf": StringRuntime.sprintf,
    "printf": StringRuntime.printf,
    "vsprintf": StringRuntime.vsprintf,
    "vprintf": StringRuntime.vprintf,
    "number_format": StringRuntime.number_format,
    "strspn": StringRuntime.strspn,
    "strcspn": StringRuntime.strcspn,
    "strpbrk": StringRuntime.strpbrk,
    "explode": StringRuntime.explode,
    "implode": StringRuntime.implode,
    "trim": StringRuntime.trim,
    "ltrim": StringRuntime.ltrim,
    "rtrim": StringRuntime.rtrim,
    "strip_tags": StringRuntime.strip_tags,
    "strtolower": StringRuntime.strtolower,
    "strtoupper": StringRuntime.strtoupper,
    "ucfirst": StringRuntime.ucfirst,
    "lcfirst": StringRuntime.lcfirst,
    "ucwords": StringRuntime.ucwords,
    "strcmp": StringRuntime.strcmp,
    "strncmp": StringRuntime.strncmp,
    "strcasecmp": StringRuntime.strcasecmp,
    "strncasecmp": StringRuntime.strncasecmp,
    "strnatcmp": StringRuntime.strnatcmp,
    "strnatcasecmp": StringRuntime.strnatcasecmp,
    "addslashes": StringRuntime.addslashes,
    "addcslashes": StringRuntime.addcslashes,
    "stripslashes": StringRuntime.stripslashes,
    "stripcslashes": StringRuntime.stripcslashes,
    "htmlspecialchars": StringRuntime.htmlspecialchars,
    "htmlspecialchars_decode": StringRuntime.htmlspecialchars_decode,
    "htmlentities": StringRuntime.htmlentities,
    "html_entity_decode": StringRuntime.html_entity_decode,
    "strtok": StringRuntime.strtok,
    "nl2br": StringRuntime.nl2br,
    "str_repeat": StringRuntime.str_repeat,
    "str_pad": StringRuntime.str_pad,
    "str_split": StringRuntime.str_split,
    "strrev": StringRuntime.strrev,
    "chr": StringRuntime.chr,
    "ord": StringRuntime.ord,
    "bin2hex": StringRuntime.bin2hex,
    "hex2bin": StringRuntime.hex2bin,
    "base64_encode": StringRuntime.base64_encode,
    "base64_decode": StringRuntime.base64_decode,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(StringRuntime.functions);
  }
}

defineFunction(StringRuntime.parse_str, {
  name: "parse_str",
  parameters: [{ name: "query" }, { name: "result", byref: true }],
});
