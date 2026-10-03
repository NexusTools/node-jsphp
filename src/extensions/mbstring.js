"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MbstringExtension = void 0;
const PHPExtension_1 = require("../PHPExtension");
const PHPVariable_1 = require("../runtime/PHPVariable");
class MbstringExtension extends PHPExtension_1.PHPExtension {
    name = "mbstring";
    unwrap(val) {
        return val instanceof PHPVariable_1.PHPVariable ? val.get() : val;
    }
    onInit(engine) {
        const unwrap = this.unwrap;
        this.functions = {
            mb_strlen: (ctx, strArg) => String(unwrap(strArg) ?? "").length,
            mb_substr: (ctx, strArg, startArg, lengthArg) => {
                const s = String(unwrap(strArg) ?? "");
                const start = Number(unwrap(startArg)) || 0;
                const lengthVal = unwrap(lengthArg);
                const length = lengthVal !== undefined && lengthVal !== null ? Number(lengthVal) : undefined;
                return length !== undefined ? s.substring(start, start + length) : s.substring(start);
            },
            mb_strtolower: (ctx, strArg) => String(unwrap(strArg) ?? "").toLowerCase(),
            mb_strtoupper: (ctx, strArg) => String(unwrap(strArg) ?? "").toUpperCase(),
            mb_check_encoding: (ctx, valueArg, encodingArg) => true,
            mb_detect_encoding: (ctx, strArg, encodingListArg, strictArg) => "UTF-8",
            mb_convert_encoding: (ctx, strArg, toEncodingArg, fromEncodingArg) => {
                const str = unwrap(strArg);
                if (Array.isArray(str))
                    return str.map((s) => String(s ?? ""));
                return String(str ?? "");
            },
            mb_internal_encoding: (ctx, encodingArg) => unwrap(encodingArg) ? true : "UTF-8",
            mb_regex_encoding: (ctx, encodingArg) => unwrap(encodingArg) ? true : "UTF-8",
            mb_list_encodings: () => ["UTF-8", "ASCII", "ISO-8859-1"],
        };
    }
}
exports.MbstringExtension = MbstringExtension;
//# sourceMappingURL=mbstring.js.map