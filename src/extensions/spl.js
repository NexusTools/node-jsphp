"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPLExtension = void 0;
const PHPExtension_1 = require("../PHPExtension");
const PHPError_1 = require("../runtime/PHPError");
const PHPVariable_1 = require("../runtime/PHPVariable");
class SPLExtension extends PHPExtension_1.PHPExtension {
    name = "spl";
    autoloaders = [];
    objectIds = new WeakMap();
    nextObjectId = 1;
    getObjectId(valueArg, functionName) {
        const value = valueArg && typeof valueArg === "object" && typeof valueArg.get === "function" ? valueArg.get() : valueArg;
        if (value === null || (typeof value !== "object" && typeof value !== "function") || Array.isArray(value)) {
            throw new PHPError_1.PHPTypeError(`${functionName}(): Argument #1 ($object) must be of type object`);
        }
        let objectId = this.objectIds.get(value);
        if (objectId === undefined) {
            objectId = this.nextObjectId++;
            this.objectIds.set(value, objectId);
        }
        return objectId;
    }
    onInit(engine) {
        engine.registerClassResolver(async (ctx, requestedName) => {
            for (const callback of this.autoloaders) {
                if (typeof callback === "string")
                    await ctx.callFunction(callback.toLowerCase(), [new PHPVariable_1.PHPLiteral(requestedName)]);
                else if (Array.isArray(callback) && callback.length === 2)
                    await ctx.callStaticMethod(String(callback[0]).toLowerCase(), String(callback[1]).toLowerCase(), [new PHPVariable_1.PHPLiteral(requestedName)], undefined, String(callback[0]));
                else if (typeof callback === "function")
                    await callback.apply(ctx, [ctx, new PHPVariable_1.PHPLiteral(requestedName)]);
                if (String(requestedName).toLowerCase() in engine.classes || String(requestedName).toLowerCase() in ctx.classes)
                    return;
            }
        });
        this.functions = {
            spl_object_id: (ctx, value) => this.getObjectId(value, "spl_object_id"),
            spl_object_hash: (ctx, value) => this.getObjectId(value, "spl_object_hash").toString(16).padStart(32, "0"),
            spl_autoload_register: (ctx, callbackArg) => {
                const callback = callbackArg?.get();
                if (callback !== undefined && callback !== null) {
                    this.autoloaders.push(callback);
                    return true;
                }
                return false;
            },
            spl_autoload_unregister: (ctx, callbackArg) => {
                const callback = callbackArg?.get();
                this.autoloaders = this.autoloaders.filter((cb) => cb !== callback);
                return true;
            },
            spl_autoload_functions: () => this.autoloaders,
        };
    }
}
exports.SPLExtension = SPLExtension;
//# sourceMappingURL=spl.js.map