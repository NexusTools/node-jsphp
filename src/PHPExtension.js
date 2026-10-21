import { PHPEngine } from "./PHPEngine.js";
export class PHPExtension {
    version = PHPEngine.VERSION;
    constants = {};
    functions = {};
    classes = {};
    registerFunction(name, fn) { this.functions[name] = fn; }
}
//# sourceMappingURL=PHPExtension.js.map