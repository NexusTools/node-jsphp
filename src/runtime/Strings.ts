import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable";
import { PHPObject } from "./PHPObject";
import { defineFunction } from "./Reflection";

export class StringRuntime {

  /** Gets string length. */
  public static strlen(ctx: PHPContext, strArg?: PHPReference): number {
    const str = strArg?.get();
    if (Buffer.isBuffer(str)) return str.length;
    return String(str ?? "").length;
  }

  /** Count the number of substring occurrences. */
  public static substr_count(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): number {
    const offset = Number(offsetArg?.get()) || 0;
    const length = lengthArg?.get() !== undefined ? Number(lengthArg.get()) : undefined;
    const source = String(haystackArg?.get() ?? "").slice(offset, length === undefined ? undefined : offset + length);
    const search = String(needleArg?.get() ?? "");
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
  public static substr(ctx: PHPContext, strArg?: PHPReference, startArg?: PHPReference, lengthArg?: PHPReference): string {
    const s = String(strArg?.get() ?? "");
    let start = Number(startArg?.get()) || 0;
    const length = lengthArg?.get() !== undefined ? Number(lengthArg.get()) : undefined;
    if (start < 0) start = s.length + start;
    if (length !== undefined) {
      if (length < 0) return s.substring(start, s.length + length);
      return s.substring(start, start + length);
    }
    return s.substring(start);
  }

  /** Replace text within a portion of a string. */
  public static substr_replace(ctx: PHPContext, subjectArg?: PHPReference, replacementArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): string | string[] {
    const subject = subjectArg?.get();
    const replacement = replacementArg?.get();
    const offset = offsetArg?.get();
    const length = lengthArg?.get();

    if (Array.isArray(subject)) {
      return subject.map((value, index) => StringRuntime.substr_replace(
        ctx,
        new PHPLiteral(value),
        new PHPLiteral(Array.isArray(replacement) ? replacement[index] ?? "" : replacement),
        new PHPLiteral(Array.isArray(offset) ? offset[index] ?? 0 : offset),
        new PHPLiteral(Array.isArray(length) ? length[index] : length)
      ) as string);
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
  public static strpos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): number | false {
    const haystack = String(haystackArg?.get() ?? "");
    const needle = String(needleArg?.get() ?? "");
    const offset = Number(offsetArg?.get()) || 0;
    const idx = haystack.indexOf(needle, offset);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the first occurrence of a case-insensitive substring in a string. */
  public static stripos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): number | false {
    const haystack = String(haystackArg?.get() ?? "").toLowerCase();
    const needle = String(needleArg?.get() ?? "").toLowerCase();
    const offset = Number(offsetArg?.get()) || 0;
    const idx = haystack.indexOf(needle, offset);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the last occurrence of a substring in a string. */
  public static strrpos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): number | false {
    const haystack = String(haystackArg?.get() ?? "");
    const needle = String(needleArg?.get() ?? "");
    const offset = Number(offsetArg?.get()) || 0;
    const idx = haystack.lastIndexOf(needle, offset || undefined);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the last occurrence of a case-insensitive substring in a string. */
  public static strripos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): number | false {
    const haystack = String(haystackArg?.get() ?? "").toLowerCase();
    const needle = String(needleArg?.get() ?? "").toLowerCase();
    const offset = Number(offsetArg?.get()) || 0;
    const idx = haystack.lastIndexOf(needle, offset || undefined);
    return idx === -1 ? false : idx;
  }

  /** Find the first occurrence of a string. */
  public static strstr(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, beforeNeedleArg?: PHPReference): string | false {
    const s = String(haystackArg?.get() ?? "");
    const n = String(needleArg?.get() ?? "");
    const beforeNeedle = Boolean(beforeNeedleArg?.get());
    const idx = s.indexOf(n);
    if (idx === -1) return false;
    return beforeNeedle ? s.substring(0, idx) : s.substring(idx);
  }

  /**
   * Replace all occurrences of the search string with the replacement string.
   * @param countRef Output variable passed by reference to receive replacement count.
   */
  public static str_replace(ctx: PHPContext, searchArg?: PHPReference, replaceArg?: PHPReference, subjectArg?: PHPReference, countRef?: PHPReference): any {
    const search = searchArg?.get();
    const replace = replaceArg?.get();
    const subject = subjectArg?.get();
    var replaceCount = 0;

    if (Array.isArray(subject)) {
      const res = subject.map((s) => StringRuntime.str_replace(ctx, new PHPLiteral(search), new PHPLiteral(replace), new PHPLiteral(s), countRef));
      if (countRef && typeof countRef.set === "function") countRef.set(replaceCount);
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
      countRef.set(replaceCount);
    }
    return s;
  }

  /** Translate characters or replace substrings. */
  public static strtr(ctx: PHPContext, subjectArg?: PHPReference, fromArg?: PHPReference, toArg?: PHPReference): string {
    let result = String(subjectArg?.get() ?? "");
    const from = fromArg?.get();
    const to = toArg?.get();

    if (from && typeof from === "object" && !Array.isArray(from)) {
      for (const [search, replacement] of Object.entries(from)) result = result.split(search).join(String(replacement));
      return result;
    }
    const search = String(from ?? "");
    const replacement = String(to ?? "");
    return result.split(search).join(replacement);
  }

  /** Case-insensitive version of str_replace. */
  public static str_ireplace(ctx: PHPContext, searchArg?: PHPReference, replaceArg?: PHPReference, subjectArg?: PHPReference, countRef?: PHPReference): any {
    const search = searchArg?.get();
    const replace = replaceArg?.get();
    const subject = subjectArg?.get();

    if (Array.isArray(subject)) {
      return subject.map((s) => StringRuntime.str_ireplace(ctx, new PHPLiteral(search), new PHPLiteral(replace), new PHPLiteral(s), countRef));
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
  public static sprintf(ctx: PHPContext, fmtArg?: PHPReference, ...args: PHPReference[]): string {
    const fmt = String(fmtArg?.get() ?? "");
    let argIndex = 0;
    return fmt.replace(/%(\d+\$)?([-+0' ])?(\d+)?(\.\d+)?([%sbcdeufFoghxX])/g, (match, param, flags, width, precision, type) => {
      if (type === "%") return "%";

      let idx = argIndex;
      if (param) {
        idx = parseInt(param.slice(0, -1), 10) - 1;
      } else {
        argIndex++;
      }

      let val = args[idx]?.get();
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
        const padding = padChar.repeat(padLen);
        str = leftAlign ? str + padding : padding + str;
      }

      return str;
    });
  }

  /** Output a formatted string. */
  public static async printf(ctx: PHPContext, fmtArg?: PHPReference, ...args: PHPReference[]): Promise<number> {
    const output = StringRuntime.sprintf(ctx, fmtArg, ...args);
    await ctx.echo(output);
    return output.length;
  }

  /** Split a string by a string. */
  public static explode(ctx: PHPContext, delimiterArg?: PHPReference, stringArg?: PHPReference, limitArg?: PHPReference): string[] {
    const delimiter = String(delimiterArg?.get() ?? "");
    const string = String(stringArg?.get() ?? "");
    const limit = limitArg?.get() !== undefined ? Number(limitArg.get()) : undefined;
    const res = string.split(delimiter);
    if (limit !== undefined && limit > 0 && res.length > limit) {
      return [...res.slice(0, limit - 1), res.slice(limit - 1).join(delimiter)];
    }
    return res;
  }

  /** Join array elements with a string. */
  public static implode(ctx: PHPContext, glueArg?: PHPReference, piecesArg?: PHPReference): string {
    const val1 = glueArg?.get();
    const val2 = piecesArg?.get();

    let glue = "";
    let pieces: any[] = [];

    if (Array.isArray(val1) || (val1 && typeof val1 === "object" && !(val1 instanceof PHPObject))) {
      pieces = Array.isArray(val1) ? val1 : Object.values(val1);
      glue = val2 !== undefined && val2 !== null ? String(val2) : "";
    } else if (Array.isArray(val2) || (val2 && typeof val2 === "object" && !(val2 instanceof PHPObject))) {
      pieces = Array.isArray(val2) ? val2 : Object.values(val2);
      glue = val1 !== undefined && val1 !== null ? String(val1) : "";
    }

    return pieces.map((p) => String(p ?? "")).join(glue);
  }

  /** Strip whitespace (or other characters) from the beginning and end of a string. */
  public static trim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): string {
    let s = String(strArg?.get() ?? "");
    const charlist = charlistArg?.get();
    if (!charlist) return s.trim();
    const mask = String(charlist).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`^[${mask}]+|[${mask}]+$`, "g"), "");
  }

  /** Strip whitespace (or other characters) from the beginning of a string. */
  public static ltrim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): string {
    let s = String(strArg?.get() ?? "");
    const charlist = charlistArg?.get();
    if (!charlist) return s.trimStart();
    const mask = String(charlist).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`^[${mask}]+`, "g"), "");
  }

  /** Strip whitespace (or other characters) from the end of a string. */
  public static rtrim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): string {
    let s = String(strArg?.get() ?? "");
    const charlist = charlistArg?.get();
    if (!charlist) return s.trimEnd();
    const mask = String(charlist).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`[${mask}]+$`, "g"), "");
  }

  /** Strip HTML and PHP tags from a string. */
  public static strip_tags(ctx: PHPContext, strArg?: PHPReference, allowable_tagsArg?: PHPReference): string {
    const s = String(strArg?.get() ?? "");
    const allowable_tags = allowable_tagsArg?.get();
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
  public static strtolower(ctx: PHPContext, strArg?: PHPReference): string { return String(strArg?.get() ?? "").toLowerCase(); }
  /** Make a string uppercase. */
  public static strtoupper(ctx: PHPContext, strArg?: PHPReference): string { return String(strArg?.get() ?? "").toUpperCase(); }
  /** Make a string's first character uppercase. */
  public static ucfirst(ctx: PHPContext, strArg?: PHPReference): string {
    const s = String(strArg?.get() ?? "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /** Make a string's first character lowercase. */
  public static lcfirst(ctx: PHPContext, strArg?: PHPReference): string {
    const s = String(strArg?.get() ?? "");
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  /** Uppercase the first character of each word in a string. */
  public static ucwords(ctx: PHPContext, strArg?: PHPReference): string {
    return String(strArg?.get() ?? "").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /** Binary safe string comparison. */
  public static strcmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference): number {
    const s1 = String(str1Arg?.get() ?? "");
    const s2 = String(str2Arg?.get() ?? "");
    return s1.localeCompare(s2);
  }

  /** Binary safe string comparison of the first n characters. */
  public static strncmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference, lengthArg?: PHPReference): number {
    const length = Number(lengthArg?.get()) || 0;
    return StringRuntime.strcmp(ctx, new PHPLiteral(String(str1Arg?.get() ?? "").slice(0, length)), new PHPLiteral(String(str2Arg?.get() ?? "").slice(0, length)));
  }

  /** Quote string with slashes. */
  public static addslashes(ctx: PHPContext, strArg?: PHPReference): string {
    return String(strArg?.get() ?? "").replace(/[\\\"']/g, "\\$&").replace(/\u0000/g, "\\0");
  }

  public static addcslashes(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): string {
    const string = String(strArg?.get() ?? "");
    const list = String(charlistArg?.get() ?? "");
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
  public static stripslashes(ctx: PHPContext, strArg?: PHPReference): string {
    return String(strArg?.get() ?? "").replace(/\\(['"\\0])/g, "$1");
  }

  public static stripcslashes(ctx: PHPContext, strArg?: PHPReference): string {
    return StringRuntime.stripslashes(ctx, strArg);
  }

  /** Convert special characters to HTML entities. */
  public static htmlspecialchars(ctx: PHPContext, strArg?: PHPReference): string {
    return String(strArg?.get() ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /** Convert special HTML entities back to characters. */
  public static htmlspecialchars_decode(ctx: PHPContext, strArg?: PHPReference): string {
    return String(strArg?.get() ?? "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  public static htmlentities(ctx: PHPContext, strArg?: PHPReference): string {
    return StringRuntime.htmlspecialchars(ctx, strArg);
  }

  public static html_entity_decode(ctx: PHPContext, strArg?: PHPReference): string {
    return StringRuntime.htmlspecialchars_decode(ctx, strArg);
  }

  public static unpack(ctx: PHPContext, formatArg?: PHPReference, stringArg?: PHPReference, offsetArg?: PHPReference): Record<string, number> | false {
    const format = String(formatArg?.get() ?? "");
    const rawStr = stringArg?.get();
    const offset = Number(offsetArg?.get()) || 0;
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

  public static pack(ctx: PHPContext, formatArg?: PHPReference, ...args: PHPReference[]): string {
    const format = String(formatArg?.get() ?? "");
    const values = args.map((a) => a?.get());
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

  public static strtok(ctx: PHPContext, strArg?: PHPReference, tokenArg?: PHPReference): string | false {
    let str: string | undefined;
    let token: string | undefined;

    if (tokenArg === undefined) {
      token = String(strArg?.get() ?? "");
    } else {
      str = String(strArg?.get() ?? "");
      token = String(tokenArg?.get() ?? "");
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
  public static nl2br(ctx: PHPContext, strArg?: PHPReference, isXhtmlArg?: PHPReference): string {
    const isXhtml = isXhtmlArg?.get() !== undefined ? Boolean(isXhtmlArg.get()) : true;
    const breakTag = isXhtml ? "<br />" : "<br>";
    return String(strArg?.get() ?? "").replace(/(\r\n|\n\r|\r|\n)/g, breakTag + "$1");
  }

  /** Repeat a string. */
  public static str_repeat(ctx: PHPContext, inputArg?: PHPReference, multiplierArg?: PHPReference): string {
    const input = String(inputArg?.get() ?? "");
    const multiplier = Number(multiplierArg?.get()) || 0;
    return input.repeat(Math.max(0, multiplier));
  }

  /** Pad a string to a certain length with another string. */
  public static str_pad(ctx: PHPContext, inputArg?: PHPReference, padLengthArg?: PHPReference, padStringArg?: PHPReference, padTypeArg?: PHPReference): string {
    let s = String(inputArg?.get() ?? "");
    const padLength = Number(padLengthArg?.get()) || 0;
    const padString = padStringArg?.get() !== undefined ? String(padStringArg.get()) : " ";
    const padType = padTypeArg?.get() !== undefined ? Number(padTypeArg.get()) : 1;
    if (s.length >= padLength) return s;
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
  public static str_split(ctx: PHPContext, stringArg?: PHPReference, lengthArg?: PHPReference): string[] {
    const s = String(stringArg?.get() ?? "");
    const length = Number(lengthArg?.get()) || 1;
    const res: string[] = [];
    for (let i = 0; i < s.length; i += length) {
      res.push(s.substring(i, i + length));
    }
    return res;
  }

  /** Reverse a string. */
  public static strrev(ctx: PHPContext, stringArg?: PHPReference): string {
    return String(stringArg?.get() ?? "").split("").reverse().join("");
  }

  /** Generate a single-byte string from a number. */
  public static chr(ctx: PHPContext, asciiArg?: PHPReference): string {
    const ascii = Number(asciiArg?.get()) || 0;
    return String.fromCharCode(ascii);
  }

  /** Convert the first byte of a string to a value between 0 and 255. */
  public static ord(ctx: PHPContext, characterArg?: PHPReference): number {
    return String(characterArg?.get() ?? "").charCodeAt(0) || 0;
  }

  /** Convert binary data into hexadecimal representation. */
  public static bin2hex(ctx: PHPContext, stringArg?: PHPReference): string {
    return Buffer.from(String(stringArg?.get() ?? "")).toString("hex");
  }

  /** Decodes a hexadecimally encoded binary string. */
  public static hex2bin(ctx: PHPContext, hexStringArg?: PHPReference): string {
    return Buffer.from(String(hexStringArg?.get() ?? ""), "hex").toString("utf8");
  }

  /** Compares two "PHP-standardized" version number strings. */
  public static version_compare(ctx: PHPContext, v1Arg?: PHPReference, v2Arg?: PHPReference, opArg?: PHPReference): any {
    const v1 = String(v1Arg?.get() ?? "");
    const v2 = String(v2Arg?.get() ?? "");
    const op = opArg?.get() !== undefined ? String(opArg.get()) : undefined;
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
  public static parse_str(ctx: PHPContext, queryArg?: PHPReference, result?: PHPReference): void {
    const query = String(queryArg?.get() ?? "");
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
        obj[key] = normalize(value[key]);
      }
      return obj;
    };
    const output = normalize(parsed);
    ctx.setInternalVar("lastParseStrResult", output);

    if (result && typeof result.set === "function") {
      result.set(output);
    } else {
      for (const [k, v] of Object.entries(output)) {
        ctx.setVar(k, v);
      }
    }
  }

  static functions = {
    "parse_str": StringRuntime.parse_str,
    "version_compare": StringRuntime.version_compare,
    "unpack": StringRuntime.unpack,
    "pack": StringRuntime.pack,
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
    "printf": StringRuntime.printf,
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
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(StringRuntime.functions);
  }
}

defineFunction(StringRuntime.parse_str, {
  name: "parse_str",
  parameters: [{ name: "query" }, { name: "result", byref: true }],
});
