import * as path from "path";

export interface PHPLineLocation {
  file: string;
  line: number;
  function?: string;
  class?: string;
}

export class SourceMapRegistry {
  private static fileLineMaps: Map<string, Map<number, PHPLineLocation>> = new Map();
  private static globalLineMaps: Map<number, PHPLineLocation>[] = [];

  public static register(filepath: string, lineMap: Map<number, PHPLineLocation>): void {
    if (filepath && filepath !== "eval") {
      const resolved = path.resolve(filepath);
      this.fileLineMaps.set(resolved, lineMap);
    }
    this.globalLineMaps.push(lineMap);
  }

  public static lookup(filepath: string | null, jsLine: number): PHPLineLocation | undefined {
    if (filepath) {
      const resolved = path.resolve(filepath);
      const map = this.fileLineMaps.get(resolved);
      if (map && map.has(jsLine)) {
        return map.get(jsLine);
      }
    }

    // Fallback search across recent line maps
    for (let i = this.globalLineMaps.length - 1; i >= 0; i--) {
      const map = this.globalLineMaps[i];
      if (map.has(jsLine)) {
        return map.get(jsLine);
      }
    }

    return undefined;
  }
}
