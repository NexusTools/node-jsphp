"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemRuntime = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const glob_1 = require("glob");
class FileSystemRuntime {
    static register(engine) {
        const register = engine.registerFunction.bind(engine);
        for (const [name, value] of Object.entries({ GLOB_ERR: 1, GLOB_MARK: 2, GLOB_NOSORT: 4, GLOB_NOCHECK: 16, GLOB_NOESCAPE: 64, GLOB_BRACE: 1024, GLOB_ONLYDIR: 8192 })) {
            engine.registerConstant(name, value);
        }
        register("glob", async (ctx, pattern, flags = 0) => FileSystemRuntime.glob(pattern, flags, ctx.cwd));
        register("fileowner", async (ctx, filename) => FileSystemRuntime.fileowner(path.resolve(ctx.cwd, filename)));
        register("fileperms", async (ctx, filename) => FileSystemRuntime.fileperms(path.resolve(ctx.cwd, filename)));
        register("file", async (ctx, path, flags = 0) => await FileSystemRuntime.file(path, flags));
        register("file_get_contents", async (ctx, path) => await FileSystemRuntime.file_get_contents(path));
        register("file_put_contents", async (ctx, path, data, flags = 0) => await FileSystemRuntime.file_put_contents(path, data, flags));
        register("file_exists", async (ctx, path) => await FileSystemRuntime.file_exists(path));
        register("is_dir", async (ctx, path) => await FileSystemRuntime.is_dir(path));
        register("is_file", async (ctx, path) => await FileSystemRuntime.is_file(path));
        register("is_readable", async (ctx, path) => await FileSystemRuntime.is_readable(path));
        register("is_writable", async (ctx, path) => await FileSystemRuntime.is_writable(path));
        register("filesize", async (ctx, path) => await FileSystemRuntime.filesize(path));
        register("filemtime", async (ctx, path) => await FileSystemRuntime.filemtime(path));
        register("realpath", async (ctx, path) => await FileSystemRuntime.realpath(path));
        register("basename", (ctx, path, suffix) => FileSystemRuntime.basename(path, suffix));
        register("dirname", (ctx, path) => FileSystemRuntime.dirname(path));
        register("pathinfo", (ctx, path, flags = 15) => FileSystemRuntime.pathinfo(path, flags));
        register("mkdir", async (ctx, path, mode = 0o777, recursive = false) => await FileSystemRuntime.mkdir(path, mode, recursive));
        register("rmdir", async (ctx, path) => await FileSystemRuntime.rmdir(path));
        register("unlink", async (ctx, path) => await FileSystemRuntime.unlink(path));
        register("rename", async (ctx, oldPath, newPath) => await FileSystemRuntime.rename(oldPath, newPath));
        register("copy", async (ctx, source, destination) => await FileSystemRuntime.copy(source, destination));
        register("tempnam", async (ctx, directory, prefix) => await FileSystemRuntime.tempnam(directory, prefix));
        register("sys_get_temp_dir", () => FileSystemRuntime.sys_get_temp_dir());
        register("scandir", async (ctx, path) => await FileSystemRuntime.scandir(path));
    }
    static async fileowner(filename) {
        try {
            return (await fs.stat(filename)).uid;
        }
        catch {
            return false;
        }
    }
    static async fileperms(filename) {
        try {
            return (await fs.stat(filename)).mode;
        }
        catch {
            return false;
        }
    }
    static async glob(pattern, flags = 0, cwd = process.cwd()) {
        try {
            const normalizedPattern = process.platform === "win32" ? pattern.replace(/\\/g, "/") : pattern;
            let matches = await (0, glob_1.glob)(normalizedPattern, {
                cwd,
                mark: Boolean(flags & 2),
                nobrace: !(flags & 1024),
                noext: true,
                windowsPathsNoEscape: process.platform === "win32" || Boolean(flags & 64),
            });
            if (flags & 8192) {
                const directories = await Promise.all(matches.map(async (entry) => {
                    try {
                        return (await fs.stat(path.resolve(cwd, entry))).isDirectory();
                    }
                    catch {
                        return false;
                    }
                }));
                matches = matches.filter((entry, index) => directories[index]);
            }
            matches = matches.map((entry) => entry.replace(/\\/g, "/"));
            if (!(flags & 4))
                matches.sort();
            return matches.length === 0 && (flags & 16) ? [pattern] : matches;
        }
        catch {
            return false;
        }
    }
    static async file(filepath, flags = 0) {
        try {
            const content = await fs.readFile(filepath, "utf8");
            const lines = content.split("\n").map((line, idx, arr) => (idx < arr.length - 1 ? line + "\n" : line));
            if (flags & 2) { // FILE_SKIP_EMPTY_LINES
                return lines.filter((l) => l.trim().length > 0);
            }
            return lines;
        }
        catch {
            return false;
        }
    }
    static async file_get_contents(filepath) {
        try {
            return await fs.readFile(filepath, "utf8");
        }
        catch {
            return false;
        }
    }
    static async file_put_contents(filepath, data, flags = 0) {
        try {
            const str = typeof data === "string" || Buffer.isBuffer(data) ? data : String(data ?? "");
            if (flags & 8) { // FILE_APPEND = 8
                await fs.appendFile(filepath, str);
            }
            else {
                await fs.writeFile(filepath, str);
            }
            return typeof str === "string" ? Buffer.byteLength(str) : str.length;
        }
        catch {
            return false;
        }
    }
    static async file_exists(filepath) {
        try {
            await fs.access(filepath);
            return true;
        }
        catch {
            return false;
        }
    }
    static async is_dir(filepath) {
        try {
            const stat = await fs.stat(filepath);
            return stat.isDirectory();
        }
        catch {
            return false;
        }
    }
    static async is_file(filepath) {
        try {
            const stat = await fs.stat(filepath);
            return stat.isFile();
        }
        catch {
            return false;
        }
    }
    static async is_readable(filepath) {
        try {
            await fs.access(filepath, fs.constants.R_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    static async is_writable(filepath) {
        try {
            await fs.access(filepath, fs.constants.W_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    static async filesize(filepath) {
        try {
            const stat = await fs.stat(filepath);
            return stat.size;
        }
        catch {
            return false;
        }
    }
    static async filemtime(filepath) {
        try {
            const stat = await fs.stat(filepath);
            return Math.floor(stat.mtimeMs / 1000);
        }
        catch {
            return false;
        }
    }
    static async realpath(filepath) {
        try {
            return await fs.realpath(filepath);
        }
        catch {
            return false;
        }
    }
    static basename(filepath, suffix) {
        const normalized = String(filepath ?? "").replace(/\\/g, "/");
        let base = path.basename(normalized);
        if (suffix && base.endsWith(suffix)) {
            base = base.substring(0, base.length - suffix.length);
        }
        return base;
    }
    static dirname(filepath) {
        return path.dirname(filepath);
    }
    static pathinfo(filepath, flags = 15) {
        const parsed = path.parse(filepath);
        return {
            dirname: parsed.dir,
            basename: parsed.base,
            extension: parsed.ext ? parsed.ext.substring(1) : "",
            filename: parsed.name,
        };
    }
    static async mkdir(dirpath, mode = 0o777, recursive = false) {
        try {
            await fs.mkdir(dirpath, { recursive, mode });
            return true;
        }
        catch {
            return false;
        }
    }
    static async rmdir(dirpath) {
        try {
            await fs.rmdir(dirpath);
            return true;
        }
        catch {
            return false;
        }
    }
    static async unlink(filepath) {
        try {
            await fs.unlink(filepath);
            return true;
        }
        catch {
            return false;
        }
    }
    static async rename(oldname, newname) {
        try {
            await fs.rename(oldname, newname);
            return true;
        }
        catch {
            return false;
        }
    }
    static async copy(source, dest) {
        try {
            await fs.copyFile(source, dest);
            return true;
        }
        catch {
            return false;
        }
    }
    static async tempnam(dir, prefix) {
        try {
            const name = path.join(dir, `${prefix}${Math.random().toString(36).substring(2)}`);
            await fs.writeFile(name, "");
            return name;
        }
        catch {
            return false;
        }
    }
    static sys_get_temp_dir() {
        return os.tmpdir();
    }
    static async scandir(dirpath) {
        try {
            return await fs.readdir(dirpath);
        }
        catch {
            return false;
        }
    }
}
exports.FileSystemRuntime = FileSystemRuntime;
//# sourceMappingURL=FileSystem.js.map