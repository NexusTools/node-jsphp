import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";

export class MbstringExtension extends PHPExtension {
  public readonly name = "mbstring";

  private unwrap(val: any): any {
    return val instanceof PHPReference ? val.get() : val;
  }

  public onInit(engine: PHPEngine): void {
    const unwrap = this.unwrap;
    this.functions = {
      mb_strlen: (ctx: PHPContext, strArg?: any) => String(unwrap(strArg) ?? "").length,
      mb_substr: (ctx: PHPContext, strArg?: any, startArg?: any, lengthArg?: any) => {
        const s = String(unwrap(strArg) ?? "");
        const start = Number(unwrap(startArg)) || 0;
        const lengthVal = unwrap(lengthArg);
        const length = lengthVal !== undefined && lengthVal !== null ? Number(lengthVal) : undefined;
        return length !== undefined ? s.substring(start, start + length) : s.substring(start);
      },
      mb_strtolower: (ctx: PHPContext, strArg?: any) => String(unwrap(strArg) ?? "").toLowerCase(),
      mb_strtoupper: (ctx: PHPContext, strArg?: any) => String(unwrap(strArg) ?? "").toUpperCase(),
      mb_check_encoding: (ctx: PHPContext, valueArg?: any, encodingArg?: any) => true,
      mb_detect_encoding: (ctx: PHPContext, strArg?: any, encodingListArg?: any, strictArg?: any) => "UTF-8",
      mb_convert_encoding: (ctx: PHPContext, strArg?: any, toEncodingArg?: any, fromEncodingArg?: any) => {
        const str = unwrap(strArg);
        if (Array.isArray(str)) return str.map((s) => String(s ?? ""));
        return String(str ?? "");
      },
      mb_internal_encoding: (ctx: PHPContext, encodingArg?: any) => unwrap(encodingArg) ? true : "UTF-8",
      mb_regex_encoding: (ctx: PHPContext, encodingArg?: any) => unwrap(encodingArg) ? true : "UTF-8",
      mb_list_encodings: () => ["UTF-8", "ASCII", "ISO-8859-1"],
    };
  }
}
