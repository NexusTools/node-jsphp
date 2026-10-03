"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPExtension = void 0;
const PHPEngine_1 = require("./PHPEngine");
const Reflection_1 = require("./runtime/Reflection");
class PHPExtension {
    version = PHPEngine_1.PHPEngine.VERSION;
    constants = {};
    functions = {};
    classes = {};
    registerFunction(name, fn, params = [], visibility = "public") {
        const fnWithMeta = (0, Reflection_1.defineFunction)(fn, { name, visibility, parameters: params });
        this.functions[name.toLowerCase()] = fnWithMeta;
    }
}
exports.PHPExtension = PHPExtension;
//# sourceMappingURL=PHPExtension.js.map