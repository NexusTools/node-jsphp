export class ArrayRuntime {
  public static count(arrayOrCountable: any): number {
    if (!arrayOrCountable) return 0;
    if (Array.isArray(arrayOrCountable)) return arrayOrCountable.length;
    if (typeof arrayOrCountable === "object") return Object.keys(arrayOrCountable).length;
    return 1;
  }

  public static array_merge(...arrays: any[]): any {
    if (arrays.every((a) => Array.isArray(a))) {
      return ([] as any[]).concat(...arrays);
    }
    const result: Record<string, any> = {};
    for (const arr of arrays) {
      if (arr && typeof arr === "object") {
        Object.assign(result, arr);
      }
    }
    return result;
  }

  public static in_array(needle: any, haystack: any, strict: boolean = false): boolean {
    if (!haystack) return false;
    const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
    if (strict) {
      return values.includes(needle);
    }
    return values.some((v) => v == needle);
  }
}
