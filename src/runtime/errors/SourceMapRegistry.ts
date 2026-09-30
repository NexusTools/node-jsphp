import * as path from "path";

export interface PHPLineLocation {
  file: string;
  line: number;
  function?: string;
  class?: string;
}

export class SourceMapRegistry {
  private static fileLineMaps: Map<string, Map<number, PHPLineLocation>> = new Map();
  private static funcToFileMaps: Map<string, string> = new Map();
  private static recentLineMaps: { file: string; map: Map<number, PHPLineLocation> }[] = [];

  public static register(filepath: string, lineMap: Map<number, PHPLineLocation>): void {
    if (filepath && filepath !== "eval") {
      const resolved = path.resolve(filepath);
      this.fileLineMaps.set(resolved, lineMap);
      this.recentLineMaps.push({ file: resolved, map: lineMap });

      for (const loc of lineMap.values()) {
        if (loc.function) {
          this.funcToFileMaps.set(loc.function.toLowerCase(), resolved);
        }
      }
    } else {
      this.recentLineMaps.push({ file: "eval", map: lineMap });
    }
  }

  public static lookup(funcNameHint: string | null, jsLine: number): PHPLineLocation | undefined {
    const candidates = [jsLine, jsLine - 2, jsLine - 1, jsLine + 1, jsLine + 2];

    if (funcNameHint) {
      const cleanHint = funcNameHint.toLowerCase().replace(/^__fn_/, "").replace(/^method_/, "").replace(/^class_/, "");
      const file = this.funcToFileMaps.get(cleanHint);
      if (file) {
        const map = this.fileLineMaps.get(file);
        if (map) {
          for (const cand of candidates) {
            if (map.has(cand)) return map.get(cand);
          }
          let bestKey = -1;
          for (const k of map.keys()) {
            if (k <= jsLine && k > bestKey) bestKey = k;
          }
          if (bestKey !== -1) return map.get(bestKey);
        }
      }
    }

    // Search recent line maps in reverse
    for (let i = this.recentLineMaps.length - 1; i >= 0; i--) {
      const entry = this.recentLineMaps[i];
      for (const cand of candidates) {
        if (entry.map.has(cand)) return entry.map.get(cand);
      }
    }

    return undefined;
  }
}
