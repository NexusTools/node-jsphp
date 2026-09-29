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
                if (callback !== undefined && callback !== null) {
                    this.autoloaders.push(callback);
                    return true;
                }
                return false;
            },
            spl_autoload_unregister: (ctx, callback) => {
                this.autoloaders = this.autoloaders.filter((cb) => cb !== callback);
                return true;
            },
            spl_autoload_functions: () => this.autoloaders,
        };
    }
}
exports.SPLExtension = SPLExtension;
//# sourceMappingURL=spl.js.map