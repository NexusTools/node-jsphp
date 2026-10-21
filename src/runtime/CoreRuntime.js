import { serialize as phpSerialize, unserialize as phpUnserialize } from "php-serialize";
import { PHPReference, PHPVariable } from "./PHPVariable.js";
import { PHPExit, PHPFatalError, PHPError } from "./PHPError.js";
import { SYMBOL_PHP_CLASS, SYMBOL_PHP_NAME, SYMBOL_PHP_PROPERTIES, encodePhpMethodName, encodePhpPropertyName, normalizePhpRegistryName } from "./Reflection.js";
import { PHPEngine } from "../PHPEngine.js";
export class CoreRuntime {
    static functions = {
        "exit": async (ctx, statusArg = 0) => {
            const status = await ctx.toVal(statusArg);
            if (status !== undefined && status !== null && typeof status === "string" && Number.isNaN(Number(status))) {
                await ctx.echo(status);
            }
            throw new PHPExit(typeof status === "number" ? status : (!isNaN(Number(status)) ? Number(status) : status));
        },
        "die": async (ctx, statusArg = 0) => {
            const status = await ctx.toVal(statusArg);
            if (status !== undefined && status !== null && typeof status === "string" && Number.isNaN(Number(status))) {
                await ctx.echo(status);
            }
            throw new PHPExit(typeof status === "number" ? status : (!isNaN(Number(status)) ? Number(status) : status));
        },
        "call_user_func": async (ctx, callbackArg, ...args) => {
            const callback = await ctx.toVal(callbackArg);
            if (!callback)
                return undefined;
            const callArgs = args.map((arg) => (arg instanceof PHPReference ? arg : new PHPVariable(arg)));
            if (typeof callback === "function")
                return await callback.apply(ctx, [ctx, ...callArgs]);
            if (typeof callback === "string") {
                const lower = callback.toLowerCase();
                if (lower.includes("::")) {
                    const [rawClassName, m] = lower.split("::");
                    const clsName = normalizePhpRegistryName(rawClassName);
                    const cls = ctx.classes[clsName] ?? (await ctx.resolveMissingClass(clsName));
                    if (cls && typeof cls[m] === "function")
                        return await cls[m](ctx, ...callArgs);
                    return ctx.methodMissing(cls, m);
                }
                const fn = ctx.functions[normalizePhpRegistryName(callback)] || ctx.functionMissing(callback);
                return await fn(ctx, ...callArgs);
            }
            if (Array.isArray(callback) && callback.length === 2) {
                let obj = await ctx.toVal(callback[0]);
                if (obj && typeof obj === "object" && !obj[SYMBOL_PHP_NAME] && (obj.name || obj.value)) {
                    const strObj = await ctx.str(obj);
                    if (strObj && strObj !== "[object Object]")
                        obj = strObj;
                }
                const m = String(await ctx.toVal(callback[1])).toLowerCase();
                if (obj && m) {
                    if (typeof obj === "string") {
                        const className = normalizePhpRegistryName(obj);
                        const cls = ctx.classes[className] ?? (await ctx.resolveMissingClass(className));
                        if (cls && typeof cls[m] === "function")
                            return await cls[m](ctx, ...callArgs);
                        return ctx.methodMissing(cls, m);
                    }
                    if (typeof obj[m] === "function") {
                        return await obj[m](ctx, ...callArgs);
                    }
                    return ctx.methodMissing(obj, m);
                }
                return undefined;
            }
            if (callback && typeof callback === "object" && typeof callback.__invoke === "function")
                return await callback.__invoke(ctx, ...callArgs);
            return undefined;
        },
        "call_user_func_array": async (ctx, callbackArg, argsArg = []) => {
            const callback = await ctx.toVal(callbackArg);
            const rawArgs = await ctx.toVal(argsArg);
            const arrArgs = [];
            if (Array.isArray(rawArgs)) {
                arrArgs.push(...rawArgs);
            }
            else if (rawArgs && typeof rawArgs === "object") {
                let maxKey = -1;
                for (const k in rawArgs) {
                    const num = Number(k);
                    if (num >= 0 && Number.isInteger(num) && String(num) === k) {
                        if (num > maxKey)
                            maxKey = num;
                    }
                }
                for (let i = 0; i <= maxKey; i++) {
                    arrArgs.push(rawArgs[i]);
                }
            }
            const callArgs = arrArgs.map((arg) => (arg instanceof PHPReference ? arg : new PHPVariable(arg)));
            if (!callback)
                return undefined;
            if (typeof callback === "function")
                return await callback.apply(ctx, [ctx, ...callArgs]);
            if (typeof callback === "string") {
                const lower = callback.toLowerCase();
                if (lower.includes("::")) {
                    const [rawClassName, m] = lower.split("::");
                    const clsName = normalizePhpRegistryName(rawClassName);
                    const cls = ctx.classes[clsName] ?? (await ctx.resolveMissingClass(clsName));
                    if (cls && typeof cls[m] === "function")
                        return await cls[m](ctx, ...callArgs);
                    return ctx.methodMissing(cls, m);
                }
                const fn = ctx.functions[normalizePhpRegistryName(callback)] || ctx.functionMissing(callback);
                return await fn(ctx, ...callArgs);
            }
            if (Array.isArray(callback) && callback.length === 2) {
                let obj = await ctx.toVal(callback[0]);
                if (obj && typeof obj === "object" && !obj[SYMBOL_PHP_NAME] && (obj.name || obj.value)) {
                    const strObj = await ctx.str(obj);
                    if (strObj && strObj !== "[object Object]")
                        obj = strObj;
                }
                const m = String(await ctx.toVal(callback[1])).toLowerCase();
                if (obj && m) {
                    if (typeof obj === "string") {
                        const className = normalizePhpRegistryName(obj);
                        const cls = ctx.classes[className] ?? (await ctx.resolveMissingClass(className));
                        if (cls && typeof cls[m] === "function")
                            return await cls[m](ctx, ...callArgs);
                        return ctx.methodMissing(cls, m);
                    }
                    if (typeof obj[m] === "function") {
                        return await obj[m](ctx, ...callArgs);
                    }
                    return ctx.methodMissing(obj, m);
                }
                return undefined;
            }
            if (callback && typeof callback === "object" && typeof callback.__invoke === "function")
                return await callback.__invoke(ctx, ...callArgs);
            return undefined;
        },
        "func_get_args": async (ctx) => {
            const args = ctx.getCurrentFunctionArgs();
            return Promise.all(args.map((arg) => ctx.toVal(arg)));
        },
        "func_get_arg": async (ctx, indexArg) => {
            const index = Number(await ctx.toVal(indexArg)) || 0;
            const val = ctx.getCurrentFunctionArg(index);
            return ctx.toVal(val);
        },
        "func_num_args": async (ctx) => {
            return ctx.getCurrentFunctionArgCount();
        },
        "define": async (ctx, nameArg, valueArg) => {
            const name = await ctx.toVal(nameArg);
            const value = await ctx.toVal(valueArg);
            const lower = String(name ?? "").toLowerCase();
            if (ctx.hasConstant(lower)) {
                if (ctx.getConstant(lower) === value) {
                    return true;
                }
                await ctx.triggerError(`Constant ${name} already defined`, PHPError.E_WARNING);
                return false;
            }
            ctx.defineConstant(name, value);
            return true;
        },
        "defined": async (ctx, nameArg) => {
            const name = await ctx.toVal(nameArg);
            return ctx.hasConstant(String(name ?? ""));
        },
        "extension_loaded": async (ctx, nameArg) => {
            const name = await ctx.toVal(nameArg);
            return Boolean(name && typeof name === "string" && Object.hasOwn(ctx.engine.extensions, name.toLowerCase()));
        },
        "get_loaded_extensions": async (ctx, zendArg) => {
            return Object.keys(ctx.engine.extensions);
        },
        "phpversion": async (ctx, extensionArg) => {
            const extension = await ctx.toVal(extensionArg);
            if (!extension)
                return PHPEngine.VERSION;
            const extName = String(extension).toLowerCase();
            if (Object.hasOwn(ctx.engine.extensions, extName)) {
                return ctx.engine.extensions[extName]?.version || PHPEngine.VERSION;
            }
            return false;
        },
        "error_get_last": async (ctx) => {
            return ctx.lastError || null;
        },
        "function_exists": async (ctx, nameArg) => {
            const name = await ctx.toVal(nameArg);
            const functionName = typeof name === "string" ? normalizePhpRegistryName(name) : "";
            return Boolean(functionName && (Object.hasOwn(ctx.functions, functionName) || Object.hasOwn(ctx.engine.functions, functionName)));
        },
        "class_alias": async (ctx, original, alias, autoload = true) => {
            if (!original || !alias)
                return false;
            const lowerOrig = normalizePhpRegistryName(String(original));
            const lowerAlias = normalizePhpRegistryName(String(alias));
            let cls = ctx.classes[lowerOrig] || ctx.engine.classes[lowerOrig];
            if (!cls && await ctx.isTruthy(autoload)) {
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
            const name = await ctx.toVal(nameArg);
            const autoload = autoloadArg !== undefined ? await ctx.toVal(autoloadArg) : true;
            if (!name || typeof name !== "string")
                return false;
            const lower = normalizePhpRegistryName(String(name));
            if (ctx.classes[lower] || ctx.engine.classes[lower])
                return true;
            if (await ctx.isTruthy(autoload)) {
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
        "method_exists": async (ctx, objectOrClassArg, methodArg) => {
            const objectOrClass = await ctx.toVal(objectOrClassArg);
            const method = (await ctx.str(await ctx.toVal(methodArg))).toLowerCase();
            if (!objectOrClass || !method)
                return false;
            if (typeof objectOrClass === "string") {
                const className = normalizePhpRegistryName(objectOrClass);
                const cls = ctx.classes[className] || ctx.engine.classes[className] || (await ctx.resolveMissingClass(className));
                if (!cls)
                    return false;
                return typeof cls[encodePhpMethodName(method, true)] === "function" || typeof cls.prototype?.[encodePhpMethodName(method)] === "function";
            }
            if (typeof objectOrClass === "object") {
                const methodKey = encodePhpMethodName(method);
                if (typeof objectOrClass[methodKey] === "function")
                    return true;
                const classConstructor = objectOrClass[SYMBOL_PHP_CLASS] || objectOrClass.constructor;
                if (typeof classConstructor?.[encodePhpMethodName(method, true)] === "function")
                    return true;
                if (typeof classConstructor?.prototype?.[methodKey] === "function")
                    return true;
                const className = normalizePhpRegistryName(String(classConstructor?.[SYMBOL_PHP_NAME] || classConstructor?.name || ""));
                const cls = ctx.classes[className] || ctx.engine.classes[className];
                if (cls && typeof cls.prototype?.[methodKey] === "function")
                    return true;
            }
            return false;
        },
        "property_exists": async (ctx, objectOrClassArg, propertyArg) => {
            const objectOrClass = await ctx.toVal(objectOrClassArg);
            let prop = await ctx.str(await ctx.toVal(propertyArg));
            if (prop.startsWith("$"))
                prop = prop.slice(1);
            if (!objectOrClass || !prop)
                return false;
            if (typeof objectOrClass === "string") {
                const className = normalizePhpRegistryName(objectOrClass);
                const cls = ctx.classes[className] || ctx.engine.classes[className] || (await ctx.resolveMissingClass(className));
                if (!cls)
                    return false;
                const properties = cls[SYMBOL_PHP_PROPERTIES];
                return Object.hasOwn(properties || {}, prop);
            }
            if (typeof objectOrClass === "object") {
                if (encodePhpPropertyName(prop) in objectOrClass)
                    return true;
                const classConstructor = objectOrClass[SYMBOL_PHP_CLASS] || objectOrClass.constructor;
                const className = normalizePhpRegistryName(String(classConstructor?.[SYMBOL_PHP_NAME] || classConstructor?.name || ""));
                const cls = ctx.classes[className] || ctx.engine.classes[className];
                const properties = cls?.[SYMBOL_PHP_PROPERTIES];
                if (Object.hasOwn(properties || {}, prop))
                    return true;
            }
            return false;
        },
        "interface_exists": async (ctx, nameArg, autoloadArg) => {
            const name = await ctx.toVal(nameArg);
            const autoload = autoloadArg !== undefined ? await ctx.toVal(autoloadArg) : true;
            if (!name || typeof name !== "string")
                return false;
            const lower = normalizePhpRegistryName(String(name));
            if (ctx.interfaces[lower] || ctx.engine.interfaces[lower])
                return true;
            if (await ctx.isTruthy(autoload)) {
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
            const name = await ctx.toVal(nameArg);
            const autoload = autoloadArg !== undefined ? await ctx.toVal(autoloadArg) : true;
            if (!name || typeof name !== "string")
                return false;
            const lower = normalizePhpRegistryName(String(name));
            if (ctx.classes[lower] || ctx.engine.classes[lower])
                return true;
            if (await ctx.isTruthy(autoload)) {
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
        "constant": async (ctx, nameArg) => {
            const name = await ctx.toVal(nameArg);
            return ctx.getConstant(String(name ?? "").toLowerCase());
        },
        "filter_var": async (ctx, valueArg, filterArg, optionsArg) => {
            const val = await ctx.toVal(valueArg);
            const filter = Number(await ctx.toVal(filterArg)) || 516;
            if (val === null || val === undefined)
                return false;
            const strVal = String(val);
            if (filter === 274 || filter === 517) {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                return emailRegex.test(strVal) ? strVal : false;
            }
            if (filter === 273) {
                try {
                    new URL(strVal);
                    return strVal;
                }
                catch {
                    return false;
                }
            }
            if (filter === 257) {
                const num = Number(strVal);
                return !isNaN(num) && Number.isInteger(num) ? num : false;
            }
            if (filter === 258) {
                const lower = strVal.toLowerCase();
                if (["1", "true", "on", "yes"].includes(lower))
                    return true;
                if (["0", "false", "off", "no", ""].includes(lower))
                    return false;
                return false;
            }
            if (filter === 275) {
                const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                return ipv4Regex.test(strVal) ? strVal : false;
            }
            return strVal;
        },
        "serialize": async (ctx, valueArg) => {
            const value = await ctx.toVal(valueArg);
            try {
                return phpSerialize(value);
            }
            catch {
                return "";
            }
        },
        "unserialize": async (ctx, strArg) => {
            const str = await ctx.str(await ctx.toVal(strArg));
            if (!str)
                return false;
            try {
                return phpUnserialize(str);
            }
            catch {
                return false;
            }
        },
        "assert": async (ctx, assertionArg, descriptionArg) => {
            const assertion = await ctx.toVal(assertionArg);
            const description = await ctx.toVal(descriptionArg);
            if (!(await ctx.isTruthy(assertion))) {
                if (description)
                    throw new PHPFatalError(`Assertion failed: ${description}`);
                return false;
            }
            return true;
        },
        "is_callable": async (ctx, vArg) => {
            const v = await ctx.toVal(vArg);
            if (typeof v === "function")
                return true;
            if (typeof v === "string") {
                const lower = v.toLowerCase();
                if (lower.includes("::")) {
                    const [rawClassName, m] = lower.split("::");
                    const clsName = normalizePhpRegistryName(rawClassName);
                    const cls = ctx.classes[clsName] || ctx.engine.classes[clsName];
                    if (!cls)
                        return false;
                    return typeof cls[m] === "function" || typeof cls.__callStatic === "function";
                }
                const functionName = normalizePhpRegistryName(v);
                return Object.hasOwn(ctx.functions, functionName) || Object.hasOwn(ctx.engine.functions, functionName);
            }
            if (Array.isArray(v) && v.length === 2) {
                const obj = await ctx.toVal(v[0]);
                const m = await ctx.toVal(v[1]);
                if (typeof m === "string") {
                    const mLower = m.toLowerCase();
                    if (typeof obj === "string") {
                        const className = normalizePhpRegistryName(obj);
                        const cls = ctx.classes[className] || ctx.engine.classes[className];
                        if (!cls)
                            return false;
                        return typeof cls[mLower] === "function" || typeof cls.__callStatic === "function";
                    }
                    if (obj && typeof obj === "object") {
                        return typeof obj[m] === "function" || typeof obj[mLower] === "function" || typeof obj.__call === "function";
                    }
                }
            }
            if (v && typeof v === "object" && typeof v.__invoke === "function") {
                return true;
            }
            return false;
        },
        "ini_get": async (ctx, optionArg) => {
            const option = await ctx.toVal(optionArg);
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
        "ini_set": async (ctx, option, value) => "",
        "register_shutdown_function": async (ctx, callback, ...args) => {
            const cb = await ctx.toVal(callback);
            const list = ctx.getInternalVar("shutdownFunctions") || [];
            list.push({ callback: cb, args });
            ctx.setInternalVar("shutdownFunctions", list);
            return true;
        },
        "register_tick_function": async (ctx, callback, ...args) => true,
        "unregister_tick_function": async (ctx, callback) => true,
        "error_log": async (ctx, messageArg) => {
            const msg = String(await ctx.toVal(messageArg) ?? "");
            console.log("[PHP ERROR LOG]", msg);
            return true;
        },
        "debug_backtrace": async (ctx, optionsArg, limitArg) => {
            const trace = ctx.getPHPBacktrace();
            const limit = Number(await limitArg?.get()) || 0;
            return limit > 0 ? trace.slice(0, limit) : trace;
        },
        "debug_print_backtrace": async (ctx, optionsArg, limitArg) => {
            const trace = ctx.getPHPBacktrace();
            const limit = Number(await limitArg?.get()) || 0;
            const items = limit > 0 ? trace.slice(0, limit) : trace;
            let out = "";
            items.forEach((f, i) => {
                out += `#${i} ${f.file || ""}(${f.line || 0}): ${f.function || "{main}"}()\n`;
            });
            await ctx.echo(out);
        },
    };
    static constants = {
        debug_backtrace_provide_object: 1,
        debug_backtrace_ignore_args: 2,
        filter_validate_email: 274,
        filter_validate_url: 273,
        filter_validate_int: 257,
        filter_validate_boolean: 258,
        filter_validate_bool: 258,
        filter_validate_ip: 275,
        filter_default: 516,
        filter_flag_ipv4: 1,
        filter_flag_ipv6: 2,
    };
    static register(engine) {
        engine.registerConstants(CoreRuntime.constants);
        engine.registerFunctions(CoreRuntime.functions);
    }
}
//# sourceMappingURL=CoreRuntime.js.map