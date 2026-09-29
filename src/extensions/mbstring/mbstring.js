"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MbstringExtension = void 0;
const PHPExtension_1 = require("../../PHPExtension");
class MbstringExtension extends PHPExtension_1.PHPExtension {
    name = "mbstring";
    onInit(engine) {
        this.functions = {
            mb_strlen: (ctx, str) => String(str || "").length,
            mb_substr: (ctx, str, start, length) => {
                const s = String(str || "");
                return length !== undefined ? s.substring(start, start + length) : s.substring(start);
            },
            mb_strtolower: (ctx, str) => String(str || "").toLowerCase(),
            mb_strtoupper: (ctx, str) => String(str || "").toUpperCase(),
        };
    }
}
exports.MbstringExtension = MbstringExtension;
//# sourceMappingURL=mbstring.js.map