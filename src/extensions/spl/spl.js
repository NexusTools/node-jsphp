"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPLExtension = void 0;
const PHPExtension_1 = require("../../PHPExtension");
class SPLExtension extends PHPExtension_1.PHPExtension {
    name = "spl";
    autoloaders = [];
    onInit(engine) {
        this.functions = {
            spl_autoload_register: (ctx, callback) => {
                if (typeof callback === "function") {
                    this.autoloaders.push(callback);
                    return true;
                }
                return false;
            },
            spl_autoload_unregister: (ctx, callback) => {
                const idx = this.autoloaders.indexOf(callback);
                if (idx !== -1) {
                    this.autoloaders.splice(idx, 1);
                    return true;
                }
                return false;
            },
        };
    }
}
exports.SPLExtension = SPLExtension;
//# sourceMappingURL=spl.js.map