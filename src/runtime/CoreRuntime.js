import { PHPVariable } from "./PHPVariable.js";
import { PHPExit, PHPFatalError } from "./PHPError.js";
import { PHPObject } from "./PHPObject.js";
export class CoreRuntime {
    static functions = {
        "exit": (ctx, statusArg = 0) => {
            const status = statusArg instanceof PHPVariable ? statusArg.get() : statusArg;
            if (status !== undefined && status !== null && typeof status === "string" && Number.isNaN(Number(status))) {
                ctx.echo(status);
            }
            throw new PHPExit(typeof status === "number" ? status : (!isNaN(Number(status)) ? Number(status) : status));
        },
        "die": (ctx, statusArg = 0) => {
            const status = statusArg instanceof PHPVariable ? statusArg.get() : statusArg;
            if (status !== undefined && status !== null && typeof status === "string" && Number.isNaN(Number(status))) {
                ctx.echo(status);
            }
            throw new PHPExit(typeof status === "number" ? status : (!isNaN(Number(status)) ? Number(status) : status));
        },
        "call_user_func": async (ctx, callbackArg, ...args) => {
            const callback = callbackArg instanceof PHPVariable ? callbackArg.get() : callbackArg;
            if (!callback)
                return undefined;
            const callArgs = args.map((arg) => (arg instanceof PHPVariable ? arg : new PHPVariable(arg)));
            if (typeof callback === "function")
                return await callback.apply(ctx, [ctx, ...callArgs]);
            if (typeof callback === "string") {
                const lower = callback.toLowerCase();
                if (lower.includes("::")) {
                    const [cls, m] = lower.split("::");
                    return await ctx.callStaticMethod(cls, m, callArgs);
                }
                if (Object.hasOwn(ctx.functions, lower) || Object.hasOwn(ctx.engine.functions, lower)) {
                    return await ctx.callFunction(lower, callArgs);
                }
                return undefined;
            }
            if (Array.isArray(callback) && callback.length === 2) {
                const obj = callback[0] instanceof PHPVariable ? callback[0].get() : callback[0];
                const m = callback[1] instanceof PHPVariable ? callback[1].get() : callback[1];
                if (obj && m) {
                    if (typeof obj === "string") {
                        return await ctx.callStaticMethod(obj.toLowerCase(), String(m).toLowerCase(), callArgs);
                    }
                    return await ctx.callMethod(obj, String(m).toLowerCase(), callArgs);
                }
                return undefined;
            }
            if (callback instanceof PHPObject)
                return await ctx.callMethod(callback, "__invoke", callArgs);
            return undefined;
        },
        "call_user_func_array": async (ctx, callbackArg, argsArg = []) => {
            const callback = callbackArg instanceof PHPVariable ? callbackArg.get() : callbackArg;
            const rawArgs = argsArg instanceof PHPVariable ? argsArg.get() : argsArg;
            const arrArgs = Array.isArray(rawArgs) ? rawArgs : Object.values(rawArgs || {});
            const callArgs = arrArgs.map((arg) => (arg instanceof PHPVariable ? arg : new PHPVariable(arg)));
            if (!callback)
                return undefined;
            if (typeof callback === "function")
                return await callback.apply(ctx, [ctx, ...callArgs]);
            if (typeof callback === "string") {
                const lower = callback.toLowerCase();
                if (lower.includes("::")) {
                    const [cls, m] = lower.split("::");
                    return await ctx.callStaticMethod(cls, m, callArgs);
                }
                if (Object.hasOwn(ctx.functions, lower) || Object.hasOwn(ctx.engine.functions, lower)) {
                    return await ctx.callFunction(lower, callArgs);
                }
                return undefined;
            }
            if (Array.isArray(callback) && callback.length === 2) {
                const obj = callback[0] instanceof PHPVariable ? callback[0].get() : callback[0];
                const m = callback[1] instanceof PHPVariable ? callback[1].get() : callback[1];
                if (obj && m) {
                    if (typeof obj === "string") {
                        return await ctx.callStaticMethod(obj.toLowerCase(), String(m).toLowerCase(), callArgs);
                    }
                    return await ctx.callMethod(obj, String(m).toLowerCase(), callArgs);
                }
                return undefined;
            }
            if (callback instanceof PHPObject)
                return await ctx.callMethod(callback, "__invoke", callArgs);
            return undefined;
        },
        "func_get_args": (ctx) => {
            const args = ctx.getCurrentFunctionArgs();
            return args.map((a) => (a instanceof PHPVariable ? a.get() : a));
        },
        "func_get_arg": (ctx, indexArg) => {
            const index = Number(indexArg instanceof PHPVariable ? indexArg.get() : indexArg) || 0;
            const args = ctx.getCurrentFunctionArgs();
            const val = args[index];
            return val instanceof PHPVariable ? val.get() : val;
        },
        "func_num_args": (ctx) => {
            return ctx.getCurrentFunctionArgs().length;
        },
        "define": async (ctx, nameArg, valueArg) => {
            const name = nameArg instanceof PHPVariable ? nameArg.get() : nameArg;
            const value = valueArg instanceof PHPVariable ? valueArg.get() : valueArg;
            const lower = String(name ?? "").toLowerCase();
            if (ctx.hasConstant(lower)) {
                if (ctx.getConstant(lower) === value) {
                    return true;
                }
                await ctx.triggerError(`Constant ${name} already defined`, 2);
                return false;
            }
            ctx.defineConstant(name, value);
            return true;
        },
        "defined": (ctx, nameArg) => {
            const name = nameArg instanceof PHPVariable ? nameArg.get() : nameArg;
            return ctx.hasConstant(String(name ?? "").toLowerCase());
        },
        "extension_loaded": (ctx, nameArg) => {
            const name = nameArg instanceof PHPVariable ? nameArg.get() : nameArg;
            return Boolean(name && typeof name === "string" && ctx.engine.extensions.has(name.toLowerCase()));
        },
        "function_exists": (ctx, nameArg) => {
            const name = nameArg instanceof PHPVariable ? nameArg.get() : nameArg;
            return Boolean(name && typeof name === "string" && (name.toLowerCase() in ctx.functions));
        },
        "class_alias": async (ctx, original, alias, autoload = true) => {
            if (!original || !alias)
                return false;
            const lowerOrig = String(original).replace(/^\\/, "").toLowerCase();
            const lowerAlias = String(alias).replace(/^\\/, "").toLowerCase();
            let cls = ctx.classes[lowerOrig] || ctx.engine.classes[lowerOrig];
            if (!cls && ctx.isTruthy(autoload)) {
                try {
                    cls = await ctx.resolveClass(lowerOrig, original);
                }
                catch {
                    // Ignore
                }
            }
            if (cls) {
                ctx.classes[lowerAlias] = cls;
                ctx.engine.classes[lowerAlias] = cls;
                return true;
            }
            return false;
        },
        "class_exists": async (ctx, nameArg, autoloadArg) => {
            const name = nameArg && typeof nameArg === "object" && typeof nameArg.get === "function" ? nameArg.get() : nameArg;
            const autoload = autoloadArg !== undefined ? (autoloadArg && typeof autoloadArg === "object" && typeof autoloadArg.get === "function" ? autoloadArg.get() : autoloadArg) : true;
            if (!name || typeof name !== "string")
                return false;
            const lower = String(name).replace(/^\\/, "").toLowerCase();
            if (ctx.classes[lower] || ctx.engine.classes[lower])
                return true;
            if (ctx.isTruthy(autoload)) {
                try {
                    const res = await ctx.resolveClass(lower, name);
                    return Boolean(res);
                }
                catch {
                    return false;
                }
            }
            return false;
        },
        "interface_exists": async (ctx, nameArg, autoloadArg) => {
            const name = nameArg && typeof nameArg === "object" && typeof nameArg.get === "function" ? nameArg.get() : nameArg;
            const autoload = autoloadArg !== undefined ? (autoloadArg && typeof autoloadArg === "object" && typeof autoloadArg.get === "function" ? autoloadArg.get() : autoloadArg) : true;
            if (!name || typeof name !== "string")
                return false;
            const lower = String(name).replace(/^\\/, "").toLowerCase();
            if (ctx.classes[lower] || ctx.engine.classes[lower])
                return true;
            if (ctx.isTruthy(autoload)) {
                try {
                    const res = await ctx.resolveClass(lower, name);
                    return Boolean(res);
                }
                catch {
                    return false;
                }
            }
            return false;
        },
        "trait_exists": async (ctx, nameArg, autoloadArg) => {
            const name = nameArg && typeof nameArg === "object" && typeof nameArg.get === "function" ? nameArg.get() : nameArg;
            const autoload = autoloadArg !== undefined ? (autoloadArg && typeof autoloadArg === "object" && typeof autoloadArg.get === "function" ? autoloadArg.get() : autoloadArg) : true;
            if (!name || typeof name !== "string")
                return false;
            const lower = String(name).replace(/^\\/, "").toLowerCase();
            if (ctx.classes[lower] || ctx.engine.classes[lower])
                return true;
            if (ctx.isTruthy(autoload)) {
                try {
                    const res = await ctx.resolveClass(lower, name);
                    return Boolean(res);
                }
                catch {
                    return false;
                }
            }
            return false;
        },
        "constant": (ctx, nameArg) => {
            const name = nameArg instanceof PHPVariable ? nameArg.get() : nameArg;
            return ctx.getConstant(String(name ?? "").toLowerCase());
        },
        "assert": (ctx, assertionArg, descriptionArg) => {
            const assertion = assertionArg instanceof PHPVariable ? assertionArg.get() : assertionArg;
            const description = descriptionArg instanceof PHPVariable ? descriptionArg.get() : descriptionArg;
            if (!assertion) {
                if (description)
                    throw new PHPFatalError(`Assertion failed: ${description}`);
                return false;
            }
            return true;
        },
        "is_callable": (ctx, vArg) => {
            const v = vArg instanceof PHPVariable ? vArg.get() : vArg;
            if (typeof v === "function")
                return true;
            if (typeof v === "string") {
                const lower = v.toLowerCase();
                return Object.hasOwn(ctx.functions, lower) || Object.hasOwn(ctx.engine.functions, lower);
            }
            if (Array.isArray(v) && v.length === 2) {
                const obj = v[0] instanceof PHPVariable ? v[0].get() : v[0];
                const m = v[1] instanceof PHPVariable ? v[1].get() : v[1];
                if (typeof m === "string") {
                    if (typeof obj === "string") {
                        const cls = ctx.classes[obj.toLowerCase()] || ctx.engine.classes[obj.toLowerCase()];
                        return Boolean(cls && cls.methods && cls.methods.has(m.toLowerCase()));
                    }
                    if (obj instanceof PHPObject) {
                        return Boolean(obj.phpClass && obj.phpClass.methods && obj.phpClass.methods.has(m.toLowerCase()));
                    }
                }
            }
            if (v instanceof PHPObject) {
                return Boolean(v.phpClass && v.phpClass.methods && v.phpClass.methods.has("__invoke"));
            }
            return false;
        },
        "ini_get": (ctx, optionArg) => {
            const option = optionArg instanceof PHPVariable ? optionArg.get() : optionArg;
            const opt = (option || "").toLowerCase();
            if (opt === "display_errors")
                return "1";
            if (opt === "memory_limit")
                return "512M";
            if (opt === "max_execution_time")
                return "30";
            if (opt === "post_max_size")
                return "64M";
            if (opt === "upload_max_filesize")
                return "64M";
            if (opt === "date.timezone")
                return "UTC";
            return "";
        },
        "ini_set": (ctx, option, value) => "",
        "register_shutdown_function": (ctx, callback, ...args) => {
            const cb = callback && typeof callback === "object" && typeof callback.get === "function" ? callback.get() : callback;
            const list = ctx.getInternalVar("shutdownFunctions") || [];
            list.push({ callback: cb, args });
            ctx.setInternalVar("shutdownFunctions", list);
            return true;
        },
        "register_tick_function": (ctx, callback, ...args) => true,
        "unregister_tick_function": (ctx, callback) => true,
    };
    static register(engine) {
        engine.registerFunctions(CoreRuntime.functions);
    }
}
//# sourceMappingURL=CoreRuntime.js.map