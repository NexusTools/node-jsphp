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
exports.StreamRuntime = exports.PHPStreamContext = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const url_1 = require("url");
class PHPStreamContext {
    options;
    constructor(options = {}) {
        this.options = options;
    }
}
exports.PHPStreamContext = PHPStreamContext;
class StreamRuntime {
    static stream_context_create(ctx, options = {}) {
        return new PHPStreamContext(options);
    }
    static async fopen(ctx, filename, mode) {
        try {
            const localPath = filename.startsWith("file://") ? (0, url_1.fileURLToPath)(filename) : path.resolve(ctx.cwd, filename);
            const normalizedMode = mode.replace(/[bt]/g, "");
            const flags = {
                r: "r", "r+": "r+", w: "w", "w+": "w+", a: "a", "a+": "a+",
                x: "wx", "x+": "wx+",
                c: fs.constants.O_WRONLY | fs.constants.O_CREAT,
                "c+": fs.constants.O_RDWR | fs.constants.O_CREAT,
            };
            if (flags[normalizedMode] === undefined)
                return false;
            return { handle: await fs.open(localPath, flags[normalizedMode]), isResource: true };
        }
        catch {
            return false;
        }
    }
    static async fclose(ctx, stream) {
        if (!stream?.isResource)
            return false;
        try {
            await stream.handle.close();
            stream.isResource = false;
            return true;
        }
        catch {
            return false;
        }
    }
    static async fread(ctx, stream, length) {
        if (!stream?.isResource || length < 0)
            return false;
        try {
            const buffer = Buffer.alloc(length);
            const { bytesRead } = await stream.handle.read(buffer, 0, length, null);
            return buffer.subarray(0, bytesRead).toString("utf8");
        }
        catch {
            return false;
        }
    }
    static async fwrite(ctx, stream, data, length) {
        if (!stream?.isResource)
            return false;
        try {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data ?? ""));
            const content = length === undefined ? buffer : buffer.subarray(0, Math.max(0, length));
            return (await stream.handle.write(content)).bytesWritten;
        }
        catch {
            return false;
        }
    }
    static async stream_get_contents(ctx, stream, maxLength = -1, offset = -1) {
        try {
            if (typeof stream === "string") {
                return await fs.readFile(stream, "utf8");
            }
            if (stream?.isResource && stream.handle) {
                if (maxLength < 0 && offset < 0)
                    return await stream.handle.readFile("utf8");
                const length = maxLength < 0 ? (await stream.handle.stat()).size : maxLength;
                const buffer = Buffer.alloc(length);
                const { bytesRead } = await stream.handle.read(buffer, 0, length, offset < 0 ? null : offset);
                return buffer.subarray(0, bytesRead).toString("utf8");
            }
            return "";
        }
        catch {
            return false;
        }
    }
    static stream_get_wrappers(ctx) {
        return ["file", "http", "https", "ftp", "ftps", "compress.zlib", "compress.bzip2", "php", "data", "glob", "phar"];
    }
    static stream_is_local(ctx, stream) {
        if (typeof stream === "string") {
            return !stream.includes("://") || stream.startsWith("file://");
        }
        return true;
    }
    static functions = {
        "fopen": StreamRuntime.fopen,
        "fclose": StreamRuntime.fclose,
        "fread": StreamRuntime.fread,
        "fwrite": StreamRuntime.fwrite,
        "fputs": StreamRuntime.fwrite,
        "stream_context_create": StreamRuntime.stream_context_create,
        "stream_get_contents": StreamRuntime.stream_get_contents,
        "stream_get_wrappers": StreamRuntime.stream_get_wrappers,
        "stream_is_local": StreamRuntime.stream_is_local,
    };
    static register(engine) {
        engine.registerFunctions(StreamRuntime.functions);
    }
}
exports.StreamRuntime = StreamRuntime;
//# sourceMappingURL=Streams.js.map