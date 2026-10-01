import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";

export class PHPStreamContext {
  public options: Record<string, any>;
  constructor(options: Record<string, any> = {}) {
    this.options = options;
  }
}

export interface PHPFileStream {
  handle: fs.FileHandle;
  isResource: boolean;
}

export class StreamRuntime {
  public static register(engine: PHPEngine): void {
    const register = engine.registerFunction.bind(engine);
    register("fopen", async (ctx: PHPContext, filename: string, mode: string) => StreamRuntime.fopen(ctx, filename, mode));
    register("fclose", async (ctx: PHPContext, stream: PHPFileStream) => StreamRuntime.fclose(stream));
    register("fread", async (ctx: PHPContext, stream: PHPFileStream, length: number) => StreamRuntime.fread(stream, length));
    register("fwrite", async (ctx: PHPContext, stream: PHPFileStream, data: any, length?: number) => StreamRuntime.fwrite(stream, data, length));
    register("fputs", async (ctx: PHPContext, stream: PHPFileStream, data: any, length?: number) => StreamRuntime.fwrite(stream, data, length));
    register("stream_context_create", (ctx: PHPContext, options = {}) => StreamRuntime.stream_context_create(options));
    register("stream_get_contents", async (ctx: PHPContext, stream: any, maximum = -1, offset = -1) => StreamRuntime.stream_get_contents(stream, maximum, offset));
    register("stream_get_wrappers", () => StreamRuntime.stream_get_wrappers());
    register("stream_is_local", (ctx: PHPContext, stream: any) => StreamRuntime.stream_is_local(stream));
  }

  public static stream_context_create(options: Record<string, any> = {}): PHPStreamContext {
    return new PHPStreamContext(options);
  }

  public static async fopen(ctx: PHPContext, filename: string, mode: string): Promise<PHPFileStream | false> {
    try {
      const localPath = filename.startsWith("file://") ? fileURLToPath(filename) : path.resolve(ctx.cwd, filename);
      const normalizedMode = mode.replace(/[bt]/g, "");
      const flags: Record<string, string | number> = {
        r: "r", "r+": "r+", w: "w", "w+": "w+", a: "a", "a+": "a+",
        x: "wx", "x+": "wx+",
        c: fs.constants.O_WRONLY | fs.constants.O_CREAT,
        "c+": fs.constants.O_RDWR | fs.constants.O_CREAT,
      };
      if (flags[normalizedMode] === undefined) return false;
      return { handle: await fs.open(localPath, flags[normalizedMode]), isResource: true };
    } catch {
      return false;
    }
  }

  public static async fclose(stream: PHPFileStream): Promise<boolean> {
    if (!stream?.isResource) return false;
    try {
      await stream.handle.close();
      stream.isResource = false;
      return true;
    } catch {
      return false;
    }
  }

  public static async fread(stream: PHPFileStream, length: number): Promise<string | false> {
    if (!stream?.isResource || length < 0) return false;
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await stream.handle.read(buffer, 0, length, null);
      return buffer.subarray(0, bytesRead).toString("utf8");
    } catch {
      return false;
    }
  }

  public static async fwrite(stream: PHPFileStream, data: any, length?: number): Promise<number | false> {
    if (!stream?.isResource) return false;
    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data ?? ""));
      const content = length === undefined ? buffer : buffer.subarray(0, Math.max(0, length));
      return (await stream.handle.write(content)).bytesWritten;
    } catch {
      return false;
    }
  }

  public static async stream_get_contents(stream: any, maxLength = -1, offset = -1): Promise<string | false> {
    try {
      if (typeof stream === "string") {
        return await fs.readFile(stream, "utf8");
      }
      if (stream?.isResource && stream.handle) {
        if (maxLength < 0 && offset < 0) return await stream.handle.readFile("utf8");
        const length = maxLength < 0 ? (await stream.handle.stat()).size : maxLength;
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await stream.handle.read(buffer, 0, length, offset < 0 ? null : offset);
        return buffer.subarray(0, bytesRead).toString("utf8");
      }
      return "";
    } catch {
      return false;
    }
  }

  public static stream_get_wrappers(): string[] {
    return ["file", "http", "https", "ftp", "ftps", "compress.zlib", "compress.bzip2", "php", "data", "glob", "phar"];
  }

  public static stream_is_local(stream: any): boolean {
    if (typeof stream === "string") {
      return !stream.includes("://") || stream.startsWith("file://");
    }
    return true;
  }
}
