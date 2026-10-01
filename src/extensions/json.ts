import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";

export class JSONExtension extends PHPExtension {
  public readonly name = "json";

  public onInit(engine: PHPEngine): void {
    this.constants = {
      JSON_PRETTY_PRINT: 128,
      JSON_UNESCAPED_SLASHES: 64,
    };

    this.functions = {
      json_encode: (ctx: PHPContext, value: any, flags: number = 0) => {
        try {
          if (flags & 128) {
            return JSON.stringify(value, null, 2);
          }
          return JSON.stringify(value);
        } catch {
          return false;
        }
      },
      json_decode: (ctx: PHPContext, jsonStr: string, assoc: boolean = false) => {
        try {
          return JSON.parse(jsonStr);
        } catch {
          return null;
        }
      },
    };
  }
}
