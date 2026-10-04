import { PHPEngine } from "./PHPEngine.js";
import { defineFunction } from "./runtime/Reflection.js";
export class PHPExtension {
    version = PHPEngine.VERSION;
    constants = {};
    functions = {};
    classes = {};
    registerFunction(name, fn, params = [], visibility = "public") {
        const fnWithMeta = defineFunction(fn, { name, visibility, parameters: params });
        this.functions[name.toLowerCase()] = fnWithMeta;
    }
}
//# sourceMappingURL=PHPExtension.js.map