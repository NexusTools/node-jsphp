export class ArrayRuntime {
  public static count(arrayOrCountable: any): number {
    if (!arrayOrCountable) return 0;
    if (Array.isArray(arrayOrCountable)) return arrayOrCountable.length;
    if (typeof arrayOrCountable === "object") return Object.keys(arrayOrCountable).length;
    return 1;
  }

  public static array_keys(input: any): any[] {
    if (!input || typeof input !== "object") return [];
    if (Array.isArray(input)) return input.map((_, i) => i);
    return Object.keys(input);
  }

  public static array_values(input: any): any[] {
    if (!input || typeof input !== "object") return [];
    if (Array.isArray(input)) return [...input];
    return Object.values(input);
  }

  public static array_flip(input: any): Record<string, any> {
    const res: Record<string, any> = {};
    if (!input || typeof input !== "object") return res;
    for (const [k, v] of Object.entries(input)) {
      res[String(v)] = k;
    }
    return res;
  }

  public static array_reverse(array: any[]): any[] {
    if (!Array.isArray(array)) return [];
    return [...array].reverse();
  }

  public static in_array(needle: any, haystack: any, strict = false): boolean {
    if (!haystack) return false;
    const values = Array.isArray(haystack) ? haystack : Object.values(haystack);
    if (strict) {
      return values.includes(needle);
    }
    return values.some((v) => v == needle);
  }

  public static array_search(needle: any, haystack: any, strict = false): any | false {
    if (!haystack || typeof haystack !== "object") return false;
    const entries = Array.isArray(haystack)
      ? haystack.map((v, i) => [i, v])
      : Object.entries(haystack);

    for (const [k, v] of entries) {
      if (strict ? v === needle : v == needle) {
        return k;
      }
    }
    return false;
  }

  public static array_key_exists(key: any, search: any): boolean {
    if (!search || typeof search !== "object") return false;
    return key in search;
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

  public static array_combine(keys: any[], values: any[]): Record<string, any> | false {
    if (!Array.isArray(keys) || !Array.isArray(values) || keys.length !== values.length) {
      return false;
    }
    const res: Record<string, any> = {};
    keys.forEach((k, i) => {
      res[String(k)] = values[i];
    });
    return res;
  }

  public static array_slice(array: any[], offset: number, length?: number): any[] {
    if (!Array.isArray(array)) return [];
    if (length !== undefined) {
      return array.slice(offset, offset + length);
    }
    return array.slice(offset);
  }

  public static array_push(array: any[], ...varargs: any[]): number {
    if (!Array.isArray(array)) return 0;
    array.push(...varargs);
    return array.length;
  }

  public static array_pop(array: any[]): any {
    if (!Array.isArray(array)) return null;
    return array.pop();
  }

  public static array_shift(array: any[]): any {
    if (!Array.isArray(array)) return null;
    return array.shift();
  }

  public static array_unshift(array: any[], ...varargs: any[]): number {
    if (!Array.isArray(array)) return 0;
    array.unshift(...varargs);
    return array.length;
  }

  public static array_unique(array: any[]): any[] {
    if (!Array.isArray(array)) return [];
    return Array.from(new Set(array));
  }

  public static array_column(array: any[], columnKey: string | number): any[] {
    if (!Array.isArray(array)) return [];
    return array.map((item) => item?.[columnKey]).filter((v) => v !== undefined);
  }

  public static sort(array: any[]): boolean {
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    return true;
  }

  public static rsort(array: any[]): boolean {
    if (!Array.isArray(array)) return false;
    array.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return true;
  }
}
