import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
import { defineFunction } from "./Reflection";

export class StringRuntime {

  /** Gets string length. */
  public static strlen(ctx: PHPContext, str: any): number {
    if (Buffer.isBuffer(str)) return str.length;
    return String(str ?? "").length;
  }

  /** Count the number of substring occurrences. */
  public static substr_count(ctx: PHPContext, haystack: any, needle: any, offset = 0, length?: number): number {
    const source = String(haystack ?? "").slice(offset, length === undefined ? undefined : offset + length);
    const search = String(needle ?? "");
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
  public static substr(ctx: PHPContext, str: string, start: number, length?: number): string {
    const s = String(str ?? "");
    if (start < 0) start = s.length + start;
    if (length !== undefined) {
      if (length < 0) return s.substring(start, s.length + length);
      return s.substring(start, start + length);
    }
    return s.substring(start);
  }

  /** Replace text within a portion of a string. */
  public static substr_replace(ctx: PHPContext, subject: any, replacement: any, offset: any, length?: any): string | string[] {
    if (Array.isArray(subject)) {
      return subject.map((value, index) => StringRuntime.substr_replace(
        ctx,
        value,
        Array.isArray(replacement) ? replacement[index] ?? "" : replacement,
        Array.isArray(offset) ? offset[index] ?? 0 : offset,
        Array.isArray(length) ? length[index] : length
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
  public static strpos(ctx: PHPContext, haystack: string, needle: string, offset = 0): number | false {
    const idx = String(haystack ?? "").indexOf(String(needle ?? ""), offset);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the first occurrence of a case-insensitive substring in a string. */
  public static stripos(ctx: PHPContext, haystack: string, needle: string, offset = 0): number | false {
    const idx = String(haystack ?? "").toLowerCase().indexOf(String(needle ?? "").toLowerCase(), offset);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the last occurrence of a substring in a string. */
  public static strrpos(ctx: PHPContext, haystack: string, needle: string, offset = 0): number | false {
    const idx = String(haystack ?? "").lastIndexOf(String(needle ?? ""), offset || undefined);
    return idx === -1 ? false : idx;
  }

  /** Find the position of the last occurrence of a case-insensitive substring in a string. */
  public static strripos(ctx: PHPContext, haystack: string, needle: string, offset = 0): number | false {
    const idx = String(haystack ?? "").toLowerCase().lastIndexOf(String(needle ?? "").toLowerCase(), offset || undefined);
    return idx === -1 ? false : idx;
  }

  /** Find the first occurrence of a string. */
  public static strstr(ctx: PHPContext, haystack: string, needle: string, beforeNeedle = false): string | false {
    const s = String(haystack ?? "");
    const n = String(needle ?? "");
    const idx = s.indexOf(n);
    if (idx === -1) return false;
    return beforeNeedle ? s.substring(0, idx) : s.substring(idx);
  }

  /**
   * Replace all occurrences of the search string with the replacement string.
   * @param countRef Output variable passed by reference to receive replacement count.
   */
  public static str_replace(ctx: PHPContext, search: any, replace: any, subject: any, countRef?: any): any {
    var replaceCount = 0;
    if (Array.isArray(subject)) {
      const res = subject.map((s) => StringRuntime.str_replace(ctx, search, replace, s, { set: (val: number) => { replaceCount += val; } }));
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
  public static strtr(ctx: PHPContext, subject: any, from: any, to?: any): string {
    let result = String(subject ?? "");
    if (from && typeof from === "object" && !Array.isArray(from)) {
      for (const [search, replacement] of Object.entries(from)) result = result.split(search).join(String(replacement));
      return result;
    }
    const search = String(from ?? "");
    const replacement = String(to ?? "");
    return result.split(search).join(replacement);
  }

  /** Case-insensitive version of str_replace. */
  public static str_ireplace(ctx: PHPContext, search: any, replace: any, subject: any): any {
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
  public static sprintf(ctx: PHPContext, fmt: string, ...args: any[]): string {
    let argIndex = 0;
    return String(fmt ?? "").replace(/%(\d+\$)?([-+0' ])?(\d+)?(\.\d+)?([%sbcdeufFoghxX])/g, (match, param, flags, width, precision, type) => {
      if (type === "%") return "%";

      let idx = argIndex;
      if (param) {
        idx = parseInt(param.slice(0, -1), 10) - 1;
      } else {
        argIndex++;
      }

      let val = args[idx];
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
  public static async printf(ctx: PHPContext, fmt: string, ...args: any[]): Promise<number> {
    const output = StringRuntime.sprintf(ctx, fmt, ...args);
    await ctx.echo(output);
    return output.length;
  }

  /** Split a string by a string. */
  public static explode(ctx: PHPContext, delimiter: string, string: string, limit?: number): string[] {
    const res = String(string ?? "").split(delimiter);
    if (limit !== undefined && limit > 0 && res.length > limit) {
      return [...res.slice(0, limit - 1), res.slice(limit - 1).join(delimiter)];
    }
    return res;
  }

  /** Join array elements with a string. */
  public static implode(ctx: PHPContext, glue: string, pieces: any[]): string {
    return (pieces || []).join(glue);
  }

  /** Strip whitespace (or other characters) from the beginning and end of a string. */
  public static trim(ctx: PHPContext, str: string, charlist?: string): string {
    let s = String(str ?? "");
    if (!charlist) return s.trim();
    const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`^[${mask}]+|[${mask}]+$`, "g"), "");
  }

  /** Strip whitespace (or other characters) from the beginning of a string. */
  public static ltrim(ctx: PHPContext, str: string, charlist?: string): string {
    let s = String(str ?? "");
    if (!charlist) return s.trimStart();
    const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`^[${mask}]+`, "g"), "");
  }

  /** Strip whitespace (or other characters) from the end of a string. */
  public static rtrim(ctx: PHPContext, str: string, charlist?: string): string {
    let s = String(str ?? "");
    if (!charlist) return s.trimEnd();
    const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`[${mask}]+$`, "g"), "");
  }

  /** Make a string lowercase. */
  public static strtolower(ctx: PHPContext, str: string): string { return String(str ?? "").toLowerCase(); }
  /** Make a string uppercase. */
  public static strtoupper(ctx: PHPContext, str: string): string { return String(str ?? "").toUpperCase(); }
  /** Make a string's first character uppercase. */
  public static ucfirst(ctx: PHPContext, str: string): string {
    const s = String(str ?? "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /** Make a string's first character lowercase. */
  public static lcfirst(ctx: PHPContext, str: string): string {
    const s = String(str ?? "");
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  /** Uppercase the first character of each word in a string. */
  public static ucwords(ctx: PHPContext, str: string): string {
    return String(str ?? "").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /** Binary safe string comparison. */
  public static strcmp(ctx: PHPContext, str1: string, str2: string): number {
    const s1 = String(str1 ?? "");
    const s2 = String(str2 ?? "");
    return s1.localeCompare(s2);
  }

  /** Binary safe string comparison of the first n characters. */
  public static strncmp(ctx: PHPContext, str1: any, str2: any, length: number): number {
    return StringRuntime.strcmp(ctx, String(str1 ?? "").slice(0, length), String(str2 ?? "").slice(0, length));
  }

  /** Quote string with slashes. */
  public static addslashes(ctx: PHPContext, str: string): string {
    return String(str ?? "").replace(/[\\\"']/g, "\\$&").replace(/\u0000/g, "\\0");
  }

  public static addcslashes(ctx: PHPContext, str: string, charlist: string): string {
    const string = String(str ?? "");
    const chars = new Set<string>();
    const list = String(charlist ?? "");
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
  public static stripslashes(ctx: PHPContext, str: string): string {
    return String(str ?? "").replace(/\\(['"\\0])/g, "$1");
  }

  /** Convert special characters to HTML entities. */
  public static htmlspecialchars(ctx: PHPContext, str: string): string {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /** Convert special HTML entities back to characters. */
  public static htmlspecialchars_decode(ctx: PHPContext, str: string): string {
    return String(str ?? "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  /** Inserts HTML line breaks before all newlines in a string. */
  public static nl2br(ctx: PHPContext, str: string, isXhtml = true): string {
    const breakTag = isXhtml ? "<br />" : "<br>";
    return String(str ?? "").replace(/(\r\n|\n\r|\r|\n)/g, breakTag + "$1");
  }

  /** Repeat a string. */
  public static str_repeat(ctx: PHPContext, input: string, multiplier: number): string {
    return String(input ?? "").repeat(Math.max(0, multiplier));
  }

  /** Pad a string to a certain length with another string. */
  public static str_pad(ctx: PHPContext, input: string, padLength: number, padString = " ", padType = 1): string {
    let s = String(input ?? "");
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
  public static str_split(ctx: PHPContext, string: string, length = 1): string[] {
    const s = String(string ?? "");
    const res: string[] = [];
    for (let i = 0; i < s.length; i += length) {
      res.push(s.substring(i, i + length));
    }
    return res;
  }

  /** Reverse a string. */
  public static strrev(ctx: PHPContext, string: string): string {
    return String(string ?? "").split("").reverse().join("");
  }

  /** Generate a single-byte string from a number. */
  public static chr(ctx: PHPContext, ascii: number): string {
    return String.fromCharCode(ascii);
  }

  /** Convert the first byte of a string to a value between 0 and 255. */
  public static ord(ctx: PHPContext, character: string): number {
    return String(character ?? "").charCodeAt(0) || 0;
  }

  /** Convert binary data into hexadecimal representation. */
  public static bin2hex(ctx: PHPContext, string: string): string {
    return Buffer.from(String(string ?? "")).toString("hex");
  }

  /** Decodes a hexadecimally encoded binary string. */
  public static hex2bin(ctx: PHPContext, hexString: string): string {
    return Buffer.from(String(hexString ?? ""), "hex").toString("utf8");
  }

  /** Compares two "PHP-standardized" version number strings. */
  public static version_compare(ctx: PHPContext, v1: string, v2: string, op?: string): any {
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
  public static parse_str(ctx: PHPContext, query: string, result?: any): void {
    const parsed: Record<string, any> = Object.create(null);
    for (const [name, value] of new URLSearchParams(String(query ?? ""))) {
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
    } else if (result !== undefined && result !== null && typeof result === "object") {
      for (const key of Object.keys(result)) delete result[key];
      Object.assign(result, output);
    } else {
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
    "printf": StringRuntime.printf,
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

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(StringRuntime.functions);
  }
}

defineFunction(StringRuntime.parse_str, {
  name: "parse_str",
  parameters: [{ name: "query" }, { name: "result", byref: true }],
});

defineFunction(StringRuntime.str_replace, {
  name: "str_replace",
  parameters: [{ name: "search" }, { name: "replace" }, { name: "subject" }, { name: "count", byref: true }],
});
