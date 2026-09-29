export class StringRuntime {
  public static strlen(str: any): number {
    if (Buffer.isBuffer(str)) return str.length;
    return String(str ?? "").length;
  }

  public static substr(str: string, start: number, length?: number): string {
    const s = String(str ?? "");
    if (start < 0) start = s.length + start;
    if (length !== undefined) {
      if (length < 0) return s.substring(start, s.length + length);
      return s.substring(start, start + length);
    }
    return s.substring(start);
  }

  public static strpos(haystack: string, needle: string, offset = 0): number | false {
    const idx = String(haystack ?? "").indexOf(String(needle ?? ""), offset);
    return idx === -1 ? false : idx;
  }

  public static stripos(haystack: string, needle: string, offset = 0): number | false {
    const idx = String(haystack ?? "").toLowerCase().indexOf(String(needle ?? "").toLowerCase(), offset);
    return idx === -1 ? false : idx;
  }

  public static strrpos(haystack: string, needle: string, offset = 0): number | false {
    const idx = String(haystack ?? "").lastIndexOf(String(needle ?? ""), offset || undefined);
    return idx === -1 ? false : idx;
  }

  public static strripos(haystack: string, needle: string, offset = 0): number | false {
    const idx = String(haystack ?? "").toLowerCase().lastIndexOf(String(needle ?? "").toLowerCase(), offset || undefined);
    return idx === -1 ? false : idx;
  }

  public static strstr(haystack: string, needle: string, beforeNeedle = false): string | false {
    const s = String(haystack ?? "");
    const n = String(needle ?? "");
    const idx = s.indexOf(n);
    if (idx === -1) return false;
    return beforeNeedle ? s.substring(0, idx) : s.substring(idx);
  }

  public static str_replace(search: any, replace: any, subject: any): any {
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

  public static str_ireplace(search: any, replace: any, subject: any): any {
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

  public static sprintf(fmt: string, ...args: any[]): string {
    let i = 0;
    return String(fmt ?? "").replace(/%([%d s f g x X])/g, (_, spec) => {
      if (spec === "%") return "%";
      const val = args[i++];
      if (spec === "d") return String(parseInt(val, 10) || 0);
      if (spec === "f" || spec === "g") return String(parseFloat(val) || 0);
      if (spec === "x") return (parseInt(val, 10) || 0).toString(16);
      if (spec === "X") return (parseInt(val, 10) || 0).toString(16).toUpperCase();
      return String(val ?? "");
    });
  }

  public static explode(delimiter: string, string: string, limit?: number): string[] {
    const res = String(string ?? "").split(delimiter);
    if (limit !== undefined && limit > 0 && res.length > limit) {
      return [...res.slice(0, limit - 1), res.slice(limit - 1).join(delimiter)];
    }
    return res;
  }

  public static implode(glue: string, pieces: any[]): string {
    return (pieces || []).join(glue);
  }

  public static trim(str: string, charlist?: string): string {
    let s = String(str ?? "");
    if (!charlist) return s.trim();
    const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`^[${mask}]+|[${mask}]+$`, "g"), "");
  }

  public static ltrim(str: string, charlist?: string): string {
    let s = String(str ?? "");
    if (!charlist) return s.trimStart();
    const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`^[${mask}]+`, "g"), "");
  }

  public static rtrim(str: string, charlist?: string): string {
    let s = String(str ?? "");
    if (!charlist) return s.trimEnd();
    const mask = charlist.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return s.replace(new RegExp(`[${mask}]+$`, "g"), "");
  }

  public static strtolower(str: string): string { return String(str ?? "").toLowerCase(); }
  public static strtoupper(str: string): string { return String(str ?? "").toUpperCase(); }
  public static ucfirst(str: string): string {
    const s = String(str ?? "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  public static lcfirst(str: string): string {
    const s = String(str ?? "");
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  public static ucwords(str: string): string {
    return String(str ?? "").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  public static strcmp(str1: string, str2: string): number {
    const s1 = String(str1 ?? "");
    const s2 = String(str2 ?? "");
    return s1.localeCompare(s2);
  }

  public static addslashes(str: string): string {
    return String(str ?? "").replace(/[\\\"']/g, "\\$&").replace(/\u0000/g, "\\0");
  }

  public static stripslashes(str: string): string {
    return String(str ?? "").replace(/\\(['"\\0])/g, "$1");
  }

  public static htmlspecialchars(str: string): string {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  public static htmlspecialchars_decode(str: string): string {
    return String(str ?? "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  public static nl2br(str: string, isXhtml = true): string {
    const breakTag = isXhtml ? "<br />" : "<br>";
    return String(str ?? "").replace(/(\r\n|\n\r|\r|\n)/g, breakTag + "$1");
  }

  public static str_repeat(input: string, multiplier: number): string {
    return String(input ?? "").repeat(Math.max(0, multiplier));
  }

  public static str_pad(input: string, padLength: number, padString = " ", padType = 1): string {
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

  public static str_split(string: string, length = 1): string[] {
    const s = String(string ?? "");
    const res: string[] = [];
    for (let i = 0; i < s.length; i += length) {
      res.push(s.substring(i, i + length));
    }
    return res;
  }

  public static strrev(string: string): string {
    return String(string ?? "").split("").reverse().join("");
  }

  public static chr(ascii: number): string {
    return String.fromCharCode(ascii);
  }

  public static ord(character: string): number {
    return String(character ?? "").charCodeAt(0) || 0;
  }

  public static bin2hex(string: string): string {
    return Buffer.from(String(string ?? "")).toString("hex");
  }

  public static hex2bin(hexString: string): string {
    return Buffer.from(String(hexString ?? ""), "hex").toString("utf8");
  }

  public static version_compare(v1: string, v2: string, op?: string): any {
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
}
