"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPExtension = void 0;
const Reflection_1 = require("./runtime/reflection/Reflection");
class PHPExtension {
    version = "8.5.0";
    constants = {};
    functions = {};
    classes = {};
    registerFunction(name, fn, params = [], visibility = "public") {
        const fnWithMeta = (0, Reflection_1.defineFunction)(fn, { name, visibility, parameters: params });
        this.functions[name.toLowerCase()] = fnWithMeta;
    }
    onInit(engine) {
        // Optional extension initialization hook
    }
}
exports.PHPExtension = PHPExtension;
//# sourceMappingURL=PHPExtension.js.map