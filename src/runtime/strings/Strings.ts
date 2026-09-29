export class StringRuntime {
  public static strlen(str: string): number {
    return String(str || "").length;
  }

  public static substr(str: string, start: number, length?: number): string {
    const s = String(str || "");
    if (length !== undefined) {
      return s.substring(start, start + length);
    }
    return s.substring(start);
  }

  public static strpos(haystack: string, needle: string, offset: number = 0): number | false {
    const idx = String(haystack || "").indexOf(String(needle || ""), offset);
    return idx === -1 ? false : idx;
  }

  public static explode(delimiter: string, string: string, limit?: number): string[] {
    const res = String(string || "").split(delimiter);
    if (limit !== undefined && limit > 0 && res.length > limit) {
      return [...res.slice(0, limit - 1), res.slice(limit - 1).join(delimiter)];
    }
    return res;
  }

  public static implode(glue: string, pieces: any[]): string {
    return (pieces || []).join(glue);
  }
}
