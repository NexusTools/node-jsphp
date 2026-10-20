import * as fs from "fs";
import * as path from "path";
import { PHPExtension } from "../PHPExtension.js";
import { PHPTypeError } from "../runtime/PHPError.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME } from "../runtime/Reflection.js";
function unwrap(value) {
    return value instanceof PHPReference ? value.get() : value;
}
function resolveDirectory(ctx, directory) {
    const value = String(unwrap(directory) ?? "");
    return path.isAbsolute(value) ? value : path.resolve(ctx.cwd || process.cwd(), value);
}
export class SPLFileInfo {
    static [SYMBOL_PHP_NAME] = "SplFileInfo";
    $filePath;
    static async __$$__new(ctx, filePath) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, filePath);
        return instance;
    }
    async __construct(ctx, filePath) {
        this.$filePath = new PHPVariable(String(unwrap(filePath) ?? ""));
    }
    getpathname(ctx) {
        return String(this.$filePath.get());
    }
    isdir(ctx) {
        try {
            return fs.statSync(String(this.$filePath.get())).isDirectory();
        }
        catch {
            return false;
        }
    }
    __tostring(ctx) {
        return this.getpathname(ctx);
    }
    toString() {
        return String(this.$filePath.get());
    }
}
export class RecursiveDirectoryIterator {
    static [SYMBOL_PHP_NAME] = "RecursiveDirectoryIterator";
    static __php_constants = new Map([
        ["current_as_fileinfo", 0],
        ["key_as_pathname", 256],
        ["key_as_filename", 512],
        ["follow_symlink", 16384],
        ["skip_dots", 4096],
        ["unix_pathnames", 8192],
    ]);
    static async __$$__new(ctx, directory) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, directory);
        return instance;
    }
    async __construct(ctx, directory) {
        const rootPath = resolveDirectory(ctx, directory);
        Object.defineProperty(this, "__rootPath", { value: rootPath, enumerable: false });
        for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
            const entryPath = path.join(rootPath, entry.name);
            Object.defineProperty(this, entryPath, {
                value: await SPLFileInfo.__$$__new(ctx, entryPath),
                enumerable: true,
                configurable: true,
            });
        }
    }
}
export class RecursiveIteratorIterator {
    static [SYMBOL_PHP_NAME] = "RecursiveIteratorIterator";
    static __php_constants = new Map([
        ["leaves_only", 0],
        ["self_first", 1],
        ["child_first", 2],
    ]);
    static async __$$__new(ctx, iterator) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, iterator);
        return instance;
    }
    async __construct(ctx, iterator) {
        const source = unwrap(iterator);
        const rootPath = source?.__rootPath;
        if (typeof rootPath !== "string") {
            if (source && typeof source === "object")
                Object.assign(this, source);
            return;
        }
        const visited = new Set();
        const visit = async (directory) => {
            const realDirectory = fs.realpathSync(directory);
            if (visited.has(realDirectory))
                return;
            visited.add(realDirectory);
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                const entryPath = path.join(directory, entry.name);
                Object.defineProperty(this, entryPath, {
                    value: await SPLFileInfo.__$$__new(ctx, entryPath),
                    enumerable: true,
                    configurable: true,
                });
                if (entry.isDirectory() && !entry.isSymbolicLink())
                    await visit(entryPath);
            }
        };
        await visit(rootPath);
    }
}
export class RecursiveRegexIterator {
    static [SYMBOL_PHP_NAME] = "RecursiveRegexIterator";
    static __php_constants = new Map([
        ["get_match", 0],
        ["all_matches", 1],
        ["split", 2],
        ["replace", 3],
    ]);
}
export class FilesystemIterator {
    static [SYMBOL_PHP_NAME] = "FilesystemIterator";
    static __php_constants = new Map([
        ["current_as_fileinfo", 0],
        ["key_as_pathname", 256],
        ["key_as_filename", 512],
        ["follow_symlink", 16384],
        ["skip_dots", 4096],
        ["unix_pathnames", 8192],
    ]);
}
export class RegexIterator {
    static [SYMBOL_PHP_NAME] = "RegexIterator";
    static __php_constants = new Map([
        ["get_match", 0],
        ["all_matches", 1],
        ["split", 2],
        ["replace", 3],
    ]);
    static async __$$__new(ctx, iterator, patternArg, modeArg) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, iterator, patternArg, modeArg);
        return instance;
    }
    async __construct(ctx, iterator, patternArg, modeArg) {
        const source = unwrap(iterator);
        const pattern = String(unwrap(patternArg) ?? "");
        const delimiter = pattern[0];
        const delimiterIndex = pattern.lastIndexOf(delimiter);
        const expression = delimiterIndex > 0 ? pattern.slice(1, delimiterIndex) : pattern;
        const modifiers = delimiterIndex > 0 ? pattern.slice(delimiterIndex + 1) : "";
        const regex = new RegExp(expression, modifiers.includes("i") ? "i" : "");
        const mode = Number(unwrap(modeArg) ?? 0);
        if (!source || typeof source !== "object")
            return;
        for (const [key, value] of Object.entries(source)) {
            const match = regex.exec(key);
            if (match) {
                Object.defineProperty(this, key, {
                    value: mode === 0 ? Array.from(match) : value,
                    enumerable: true,
                    configurable: true,
                });
            }
        }
    }
}
export class SPLExtension extends PHPExtension {
    name = "spl";
    objectIds = new WeakMap();
    nextObjectId = 1;
    getAutoloaders(ctx) {
        let list = ctx.getInternalVar("spl_autoloaders");
        if (!list) {
            list = [];
            ctx.setInternalVar("spl_autoloaders", list);
        }
        return list;
    }
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
        this.classes = {
            splfileinfo: SPLFileInfo,
            recursivedirectoryiterator: RecursiveDirectoryIterator,
            recursiveiteratoriterator: RecursiveIteratorIterator,
            recursiveregexiterator: RecursiveRegexIterator,
            filesystemiterator: FilesystemIterator,
            regexiterator: RegexIterator,
        };
        engine.registerClassResolver(async (ctx, requestedName) => {
            const autoloaders = this.getAutoloaders(ctx);
            for (let callback of autoloaders) {
                callback = callback instanceof PHPReference ? callback.get() : callback;
                if (typeof callback === "string") {
                    const fn = ctx.functions[callback.toLowerCase()] || ctx.functionMissing(callback);
                    await fn(ctx, new PHPLiteral(requestedName));
                }
                else if (Array.isArray(callback) && callback.length === 2) {
                    const target0 = callback[0] instanceof PHPReference ? callback[0].get() : callback[0];
                    const mName = String(callback[1] instanceof PHPReference ? callback[1].get() : callback[1]).toLowerCase();
                    if (typeof target0 === "string") {
                        const clsName = target0.toLowerCase();
                        const cls = ctx.classes[clsName] || engine.classes[clsName] || (await ctx.resolveClass(clsName, target0));
                        if (cls && typeof cls[mName] === "function") {
                            await cls[mName](ctx, new PHPLiteral(requestedName));
                        }
                    }
                    else if (target0 && typeof target0 === "object") {
                        if (typeof target0[mName] === "function") {
                            await target0[mName](ctx, new PHPLiteral(requestedName));
                        }
                    }
                }
                else if (typeof callback === "function")
                    await callback.apply(ctx, [ctx, new PHPLiteral(requestedName)]);
                const lowerReq = String(requestedName).toLowerCase();
                if (lowerReq in engine.classes || lowerReq in ctx.classes || lowerReq in engine.interfaces || lowerReq in ctx.interfaces)
                    return;
            }
        });
        this.functions = {
            spl_object_id: (ctx, value) => this.getObjectId(value, "spl_object_id"),
            spl_object_hash: (ctx, value) => this.getObjectId(value, "spl_object_hash").toString(16).padStart(32, "0"),
            spl_autoload_register: (ctx, callbackArg) => {
                const callback = callbackArg instanceof PHPReference ? callbackArg.get() : callbackArg;
                if (callback !== undefined && callback !== null) {
                    this.getAutoloaders(ctx).push(callback);
                    return true;
                }
                return false;
            },
            spl_autoload_unregister: (ctx, callbackArg) => {
                const callback = callbackArg instanceof PHPReference ? callbackArg.get() : callbackArg;
                const list = this.getAutoloaders(ctx);
                const filtered = list.filter((cb) => cb !== callback);
                ctx.setInternalVar("spl_autoloaders", filtered);
                return true;
            },
            spl_autoload_functions: (ctx) => this.getAutoloaders(ctx),
        };
    }
}
//# sourceMappingURL=spl.js.map