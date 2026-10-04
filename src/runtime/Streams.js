import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
export class PHPStreamContext {
    options;
    constructor(options = {}) {
        this.options = options;
    }
}
export class StreamRuntime {
    static stream_context_create(ctx, optionsArg) {
        const options = optionsArg?.get() || {};
        return new PHPStreamContext(options);
    }
    static async fopen(ctx, filenameArg, modeArg) {
        try {
            const filename = String(filenameArg?.get() ?? "");
            const mode = String(modeArg?.get() ?? "");
            const localPath = filename.startsWith("file://") ? fileURLToPath(filename) : path.resolve(ctx.cwd, filename);
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
    static async fclose(ctx, streamArg) {
        const stream = streamArg?.get();
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
    static async fread(ctx, streamArg, lengthArg) {
        const stream = streamArg?.get();
        const length = Number(lengthArg?.get()) || 0;
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
    static async fwrite(ctx, streamArg, dataArg, lengthArg) {
        const stream = streamArg?.get();
        const data = dataArg?.get();
        const length = lengthArg?.get() !== undefined ? Number(lengthArg.get()) : undefined;
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
    static async stream_get_contents(ctx, streamArg, maxLengthArg, offsetArg) {
        const stream = streamArg?.get();
        const maxLength = maxLengthArg?.get() !== undefined ? Number(maxLengthArg.get()) : -1;
        const offset = offsetArg?.get() !== undefined ? Number(offsetArg.get()) : -1;
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
    static stream_is_local(ctx, streamArg) {
        const stream = streamArg?.get();
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
//# sourceMappingURL=Streams.js.map