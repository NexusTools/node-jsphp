"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONExtension = void 0;
const PHPExtension_1 = require("../../PHPExtension");
class JSONExtension extends PHPExtension_1.PHPExtension {
    name = "json";
    onInit(engine) {
        this.constants = {
            JSON_PRETTY_PRINT: 128,
            JSON_UNESCAPED_SLASHES: 64,
        };
        this.functions = {
            json_encode: (ctx, value, flags = 0) => {
                try {
                    if (flags & 128) {
                        return JSON.stringify(value, null, 2);
                    }
                    return JSON.stringify(value);
                }
                catch {
                    return false;
                }
            },
            json_decode: (ctx, jsonStr, assoc = false) => {
                try {
                    return JSON.parse(jsonStr);
                }
                catch {
                    return null;
                }
            },
        };
    }
}
exports.JSONExtension = JSONExtension;
//# sourceMappingURL=json.js.map