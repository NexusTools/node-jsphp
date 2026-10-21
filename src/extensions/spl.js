import * as fs from "fs/promises";
import * as path from "path";
import { PHPExtension } from "../PHPExtension.js";
import { PHPTypeError } from "../runtime/PHPError.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_NEW, normalizePhpRegistryName } from "../runtime/Reflection.js";
async function unwrap(value) {
    return value instanceof PHPReference ? await value.get() : value;
}
async function resolveDirectory(ctx, directory) {
    const value = String(await unwrap(directory) ?? "");
    return path.isAbsolute(value) ? value : path.resolve(ctx.cwd || process.cwd(), value);
}
export class SPLFileInfo {
    static [SYMBOL_PHP_NAME] = "SplFileInfo";
    $filePath;
    static async [SYMBOL_PHP_NEW](ctx, filePath) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, filePath);
        return instance;
    }
    async __construct(ctx, filePath) {
        this.$filePath = new PHPVariable(String(await unwrap(filePath) ?? ""));
    }
    async getpathname(ctx) {
        return String(await this.$filePath.get());
    }
    async isdir(ctx) {
        try {
            return (await fs.stat(String(await this.$filePath.get()))).isDirectory();
        }
        catch {
            return false;
        }
    }
    async __tostring(ctx) {
        return await this.getpathname(ctx);
    }
    toString() {
        return this.$filePath.toString();
    }
}
export class RecursiveDirectoryIterator {
    static [SYMBOL_PHP_NAME] = "RecursiveDirectoryIterator";
    static [SYMBOL_PHP_CONSTANTS] = {
        current_as_fileinfo: 0,
        key_as_pathname: 256,
        key_as_filename: 512,
        follow_symlink: 16384,
        skip_dots: 4096,
        unix_pathnames: 8192,
    };
    static async [SYMBOL_PHP_NEW](ctx, directory) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, directory);
        return instance;
    }
    async __construct(ctx, directory) {
        const rootPath = await resolveDirectory(ctx, directory);
        Object.defineProperty(this, "__rootPath", { value: rootPath, enumerable: false });
        for (const entry of await fs.readdir(rootPath, { withFileTypes: true })) {
            const entryPath = path.join(rootPath, entry.name);
            Object.defineProperty(this, entryPath, {
                value: await SPLFileInfo[SYMBOL_PHP_NEW](ctx, entryPath),
                enumerable: true,
                configurable: true,
            });
        }
    }
}
export class RecursiveIteratorIterator {
    static [SYMBOL_PHP_NAME] = "RecursiveIteratorIterator";
    static [SYMBOL_PHP_CONSTANTS] = {
        leaves_only: 0,
        self_first: 1,
        child_first: 2,
    };
    static async [SYMBOL_PHP_NEW](ctx, iterator) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, iterator);
        return instance;
    }
    async __construct(ctx, iterator) {
        const source = await unwrap(iterator);
        const rootPath = source?.__rootPath;
        if (typeof rootPath !== "string") {
            if (source && typeof source === "object")
                Object.assign(this, source);
            return;
        }
        const visited = new Set();
        const visit = async (directory) => {
            const realDirectory = await fs.realpath(directory);
            if (visited.has(realDirectory))
                return;
            visited.add(realDirectory);
            for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
                const entryPath = path.join(directory, entry.name);
                Object.defineProperty(this, entryPath, {
                    value: await SPLFileInfo[SYMBOL_PHP_NEW](ctx, entryPath),
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
    static [SYMBOL_PHP_CONSTANTS] = {
        get_match: 0,
        all_matches: 1,
        split: 2,
        replace: 3,
    };
    static async [SYMBOL_PHP_NEW](ctx, iterator, patternArg, modeArg) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, iterator, patternArg, modeArg);
        return instance;
    }
    async __construct(ctx, iterator, patternArg, modeArg) { }
}
export class FilesystemIterator {
    static [SYMBOL_PHP_NAME] = "FilesystemIterator";
    static [SYMBOL_PHP_CONSTANTS] = {
        current_as_fileinfo: 0,
        key_as_pathname: 256,
        key_as_filename: 512,
        follow_symlink: 16384,
        skip_dots: 4096,
        unix_pathnames: 8192,
    };
    static async [SYMBOL_PHP_NEW](ctx, directory, flagsArg) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, directory, flagsArg);
        return instance;
    }
    async __construct(ctx, directory, flagsArg) {
        const source = await unwrap(directory);
        if (source && typeof source === "object")
            Object.assign(this, source);
    }
}
export class RegexIterator {
    static [SYMBOL_PHP_NAME] = "RegexIterator";
    static [SYMBOL_PHP_CONSTANTS] = {
        get_match: 0,
        all_matches: 1,
        split: 2,
        replace: 3,
    };
    static async [SYMBOL_PHP_NEW](ctx, iterator, patternArg, modeArg) {
        const instance = Object.create(this.prototype);
        await instance.__construct(ctx, iterator, patternArg, modeArg);
        return instance;
    }
    async __construct(ctx, iterator, patternArg, modeArg) {
        const source = await unwrap(iterator);
        const pattern = String(await unwrap(patternArg) ?? "");
        const delimiter = pattern[0];
        const delimiterIndex = pattern.lastIndexOf(delimiter);
        const expression = delimiterIndex > 0 ? pattern.slice(1, delimiterIndex) : pattern;
        const modifiers = delimiterIndex > 0 ? pattern.slice(delimiterIndex + 1) : "";
        const regex = new RegExp(expression, modifiers.includes("i") ? "i" : "");
        const mode = Number(await unwrap(modeArg) ?? 0);
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
    objectIdSymbol = Symbol("spl.objectId");
    objectIds = [];
    nextObjectId = 1;
    getAutoloaders(ctx) {
        let list = ctx.getInternalVar("spl_autoloaders");
        if (!list) {
            list = [];
            ctx.setInternalVar("spl_autoloaders", list);
        }
        return list;
    }
    async getObjectId(valueArg, functionName) {
        const value = valueArg instanceof PHPReference ? await valueArg.get() : valueArg;
        if (value === null || (typeof value !== "object" && typeof value !== "function") || Array.isArray(value)) {
            throw new PHPTypeError(`${functionName}(): Argument #1 ($object) must be of type object`);
        }
        const existingId = value[this.objectIdSymbol];
        if (typeof existingId === "number")
            return existingId;
        const existing = this.objectIds.find((entry) => entry.object === value);
        if (existing)
            return existing.id;
        const objectId = this.nextObjectId++;
        if (Object.isExtensible(value)) {
            Object.defineProperty(value, this.objectIdSymbol, { value: objectId });
        }
        else {
            this.objectIds.push({ object: value, id: objectId });
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
                callback = callback instanceof PHPReference ? await callback.get() : callback;
                if (typeof callback === "string") {
                    const fn = ctx.functions[normalizePhpRegistryName(callback)] || ctx.functionMissing(callback);
                    await fn(ctx, new PHPLiteral(requestedName));
                }
                else if (Array.isArray(callback) && callback.length === 2) {
                    const target0 = callback[0] instanceof PHPReference ? await callback[0].get() : callback[0];
                    const mName = String(callback[1] instanceof PHPReference ? await callback[1].get() : callback[1]).toLowerCase();
                    if (typeof target0 === "string") {
                        const clsName = normalizePhpRegistryName(target0);
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
            spl_object_id: async (ctx, value) => await this.getObjectId(value, "spl_object_id"),
            spl_object_hash: async (ctx, value) => (await this.getObjectId(value, "spl_object_hash")).toString(16).padStart(32, "0"),
            spl_autoload_register: async (ctx, callbackArg) => {
                const callback = callbackArg instanceof PHPReference ? await callbackArg.get() : callbackArg;
                if (callback !== undefined && callback !== null) {
                    this.getAutoloaders(ctx).push(callback);
                    return true;
                }
                return false;
            },
            spl_autoload_unregister: async (ctx, callbackArg) => {
                const callback = callbackArg instanceof PHPReference ? await callbackArg.get() : callbackArg;
                const list = this.getAutoloaders(ctx);
                const filtered = list.filter((cb) => cb !== callback);
                ctx.setInternalVar("spl_autoloaders", filtered);
                return true;
            },
            spl_autoload_functions: async (ctx) => this.getAutoloaders(ctx),
        };
    }
}
//# sourceMappingURL=spl.js.map