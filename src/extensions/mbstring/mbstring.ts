import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
import { PHPContext } from "../../PHPContext";

export class MbstringExtension extends PHPExtension {
  public readonly name = "mbstring";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      mb_strlen: (ctx: PHPContext, str: string) => String(str || "").length,
      mb_substr: (ctx: PHPContext, str: string, start: number, length?: number) => {
        const s = String(str || "");
        return length !== undefined ? s.substring(start, start + length) : s.substring(start);
      },
      mb_strtolower: (ctx: PHPContext, str: string) => String(str || "").toLowerCase(),
      mb_strtoupper: (ctx: PHPContext, str: string) => String(str || "").toUpperCase(),
    };
  }
}
