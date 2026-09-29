import * as fs from "fs/promises";

export class PHPStreamContext {
  public options: Record<string, any>;
  constructor(options: Record<string, any> = {}) {
    this.options = options;
  }
}

export class StreamRuntime {
  public static stream_context_create(options: Record<string, any> = {}): PHPStreamContext {
    return new PHPStreamContext(options);
  }

  public static async stream_get_contents(stream: any, maxLength = -1, offset = -1): Promise<string | false> {
    try {
      if (typeof stream === "string") {
        return await fs.readFile(stream, "utf8");
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
