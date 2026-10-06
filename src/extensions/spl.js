import { PHPExtension } from "../PHPExtension.js";
import { PHPTypeError } from "../runtime/PHPError.js";
import { PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
export class SPLExtension extends PHPExtension {
    name = "spl";
    autoloaders = [];
    objectIds = new WeakMap();
    nextObjectId = 1;
    getObjectId(valueArg, functionName) {
        const value = valueArg instanceof PHPReference ? valueArg.get() : valueArg;
        if (value === null || (typeof value !== "object" && typeof value !== "function") || Array.isArray(value)) {
            throw new PHPTypeError(`${functionName}(): Argument #1 ($object) must be of type object`);
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
                if (typeof callback === "string") {
                    const fn = ctx.functions[callback.toLowerCase()] || ctx.functionMissing(callback);
                    await fn(ctx, new PHPLiteral(requestedName));
                }
                else if (Array.isArray(callback) && callback.length === 2) {
                    const mName = String(callback[1]).toLowerCase();
                    if (typeof callback[0] === "object" && callback[0] !== null) {
                        if (typeof callback[0][mName] === "function") {
                            await callback[0][mName](ctx, new PHPLiteral(requestedName));
                        }
                    }
                    else {
                        const clsName = String(callback[0]).toLowerCase();
                        const cls = ctx.classes[clsName] || engine.classes[clsName] || (await ctx.resolveClass(clsName));
                        if (cls && typeof cls[mName] === "function") {
                            await cls[mName](ctx, new PHPLiteral(requestedName));
                        }
                    }
                }
                else if (typeof callback === "function")
                    await callback.apply(ctx, [ctx, new PHPLiteral(requestedName)]);
                if (String(requestedName).toLowerCase() in engine.classes || String(requestedName).toLowerCase() in ctx.classes)
                    return;
            }
        });
        this.functions = {
            spl_object_id: (ctx, value) => this.getObjectId(value, "spl_object_id"),
            spl_object_hash: (ctx, value) => this.getObjectId(value, "spl_object_hash").toString(16).padStart(32, "0"),
            spl_autoload_register: (ctx, callbackArg) => {
                const callback = callbackArg instanceof PHPReference ? callbackArg.get() : callbackArg;
                if (callback !== undefined && callback !== null) {
                    this.autoloaders.push(callback);
                    return true;
                }
                return false;
            },
            spl_autoload_unregister: (ctx, callbackArg) => {
                const callback = callbackArg instanceof PHPReference ? callbackArg.get() : callbackArg;
                this.autoloaders = this.autoloaders.filter((cb) => cb !== callback);
                return true;
            },
            spl_autoload_functions: () => this.autoloaders,
        };
    }
}
//# sourceMappingURL=spl.js.map