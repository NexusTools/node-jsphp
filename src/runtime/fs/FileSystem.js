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
class FileSystemRuntime {
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
        let base = path.basename(filepath);
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