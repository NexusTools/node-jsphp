import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { glob as matchGlob } from "glob";
import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";

export class FileSystemRuntime {
  public static register(engine: PHPEngine): void {
    const register = engine.registerFunction.bind(engine);
    for (const [name, value] of Object.entries({ GLOB_ERR: 1, GLOB_MARK: 2, GLOB_NOSORT: 4, GLOB_NOCHECK: 16, GLOB_NOESCAPE: 64, GLOB_BRACE: 1024, GLOB_ONLYDIR: 8192 })) {
      engine.registerConstant(name, value);
    }
    register("glob", async (ctx: PHPContext, pattern: string, flags = 0) => FileSystemRuntime.glob(pattern, flags, ctx.cwd));
    register("fileowner", async (ctx: PHPContext, filename: string) => FileSystemRuntime.fileowner(path.resolve(ctx.cwd, filename)));
    register("fileperms", async (ctx: PHPContext, filename: string) => FileSystemRuntime.fileperms(path.resolve(ctx.cwd, filename)));
    register("file", async (ctx: PHPContext, path: string, flags = 0) => await FileSystemRuntime.file(path, flags));
    register("file_get_contents", async (ctx: PHPContext, path: string) => await FileSystemRuntime.file_get_contents(path));
    register("file_put_contents", async (ctx: PHPContext, path: string, data: any, flags = 0) => await FileSystemRuntime.file_put_contents(path, data, flags));
    register("file_exists", async (ctx: PHPContext, path: string) => await FileSystemRuntime.file_exists(path));
    register("is_dir", async (ctx: PHPContext, path: string) => await FileSystemRuntime.is_dir(path));
    register("is_file", async (ctx: PHPContext, path: string) => await FileSystemRuntime.is_file(path));
    register("is_readable", async (ctx: PHPContext, path: string) => await FileSystemRuntime.is_readable(path));
    register("is_writable", async (ctx: PHPContext, path: string) => await FileSystemRuntime.is_writable(path));
    register("filesize", async (ctx: PHPContext, path: string) => await FileSystemRuntime.filesize(path));
    register("filemtime", async (ctx: PHPContext, path: string) => await FileSystemRuntime.filemtime(path));
    register("realpath", async (ctx: PHPContext, path: string) => await FileSystemRuntime.realpath(path));
    register("basename", (ctx: PHPContext, path: string, suffix?: string) => FileSystemRuntime.basename(path, suffix));
    register("dirname", (ctx: PHPContext, path: string) => FileSystemRuntime.dirname(path));
    register("pathinfo", (ctx: PHPContext, path: string, flags = 15) => FileSystemRuntime.pathinfo(path, flags));
    register("mkdir", async (ctx: PHPContext, path: string, mode = 0o777, recursive = false) => await FileSystemRuntime.mkdir(path, mode, recursive));
    register("rmdir", async (ctx: PHPContext, path: string) => await FileSystemRuntime.rmdir(path));
    register("unlink", async (ctx: PHPContext, path: string) => await FileSystemRuntime.unlink(path));
    register("rename", async (ctx: PHPContext, oldPath: string, newPath: string) => await FileSystemRuntime.rename(oldPath, newPath));
    register("copy", async (ctx: PHPContext, source: string, destination: string) => await FileSystemRuntime.copy(source, destination));
    register("tempnam", async (ctx: PHPContext, directory: string, prefix: string) => await FileSystemRuntime.tempnam(directory, prefix));
    register("sys_get_temp_dir", () => FileSystemRuntime.sys_get_temp_dir());
    register("scandir", async (ctx: PHPContext, path: string) => await FileSystemRuntime.scandir(path));
  }
  public static async fileowner(filename: string): Promise<number | false> {
    try { return (await fs.stat(filename)).uid; }
    catch { return false; }
  }

  public static async fileperms(filename: string): Promise<number | false> {
    try { return (await fs.stat(filename)).mode; }
    catch { return false; }
  }

  public static async glob(pattern: string, flags = 0, cwd = process.cwd()): Promise<string[] | false> {
    try {
      const normalizedPattern = process.platform === "win32" ? pattern.replace(/\\/g, "/") : pattern;
      let matches = await matchGlob(normalizedPattern, {
        cwd,
        mark: Boolean(flags & 2),
        nobrace: !(flags & 1024),
        noext: true,
        windowsPathsNoEscape: process.platform === "win32" || Boolean(flags & 64),
      });
      if (flags & 8192) {
        const directories = await Promise.all(matches.map(async (entry) => {
          try { return (await fs.stat(path.resolve(cwd, entry))).isDirectory(); }
          catch { return false; }
        }));
        matches = matches.filter((entry, index) => directories[index]);
      }
      matches = matches.map((entry) => entry.replace(/\\/g, "/"));
      if (!(flags & 4)) matches.sort();
      return matches.length === 0 && (flags & 16) ? [pattern] : matches;
    } catch {
      return false;
    }
  }

  public static async file(filepath: string, flags = 0): Promise<string[] | false> {
    try {
      const content = await fs.readFile(filepath, "utf8");
      const lines = content.split("\n").map((line, idx, arr) => (idx < arr.length - 1 ? line + "\n" : line));
      if (flags & 2) { // FILE_SKIP_EMPTY_LINES
        return lines.filter((l) => l.trim().length > 0);
      }
      return lines;
    } catch {
      return false;
    }
  }

  public static async file_get_contents(filepath: string): Promise<string | false> {
    try {
      return await fs.readFile(filepath, "utf8");
    } catch {
      return false;
    }
  }

  public static async file_put_contents(filepath: string, data: any, flags = 0): Promise<number | false> {
    try {
      const str = typeof data === "string" || Buffer.isBuffer(data) ? data : String(data ?? "");
      if (flags & 8) { // FILE_APPEND = 8
        await fs.appendFile(filepath, str);
      } else {
        await fs.writeFile(filepath, str);
      }
      return typeof str === "string" ? Buffer.byteLength(str) : str.length;
    } catch {
      return false;
    }
  }

  public static async file_exists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  public static async is_dir(filepath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filepath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  public static async is_file(filepath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filepath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  public static async is_readable(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  public static async is_writable(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  public static async filesize(filepath: string): Promise<number | false> {
    try {
      const stat = await fs.stat(filepath);
      return stat.size;
    } catch {
      return false;
    }
  }

  public static async filemtime(filepath: string): Promise<number | false> {
    try {
      const stat = await fs.stat(filepath);
      return Math.floor(stat.mtimeMs / 1000);
    } catch {
      return false;
    }
  }

  public static async realpath(filepath: string): Promise<string | false> {
    try {
      return await fs.realpath(filepath);
    } catch {
      return false;
    }
  }

  public static basename(filepath: string, suffix?: string): string {
    const normalized = String(filepath ?? "").replace(/\\/g, "/");
    let base = path.basename(normalized);
    if (suffix && base.endsWith(suffix)) {
      base = base.substring(0, base.length - suffix.length);
    }
    return base;
  }

  public static dirname(filepath: string): string {
    return path.dirname(filepath);
  }

  public static pathinfo(filepath: string, flags = 15): Record<string, string> {
    const parsed = path.parse(filepath);
    return {
      dirname: parsed.dir,
      basename: parsed.base,
      extension: parsed.ext ? parsed.ext.substring(1) : "",
      filename: parsed.name,
    };
  }

  public static async mkdir(dirpath: string, mode = 0o777, recursive = false): Promise<boolean> {
    try {
      await fs.mkdir(dirpath, { recursive, mode });
      return true;
    } catch {
      return false;
    }
  }

  public static async rmdir(dirpath: string): Promise<boolean> {
    try {
      await fs.rmdir(dirpath);
      return true;
    } catch {
      return false;
    }
  }

  public static async unlink(filepath: string): Promise<boolean> {
    try {
      await fs.unlink(filepath);
      return true;
    } catch {
      return false;
    }
  }

  public static async rename(oldname: string, newname: string): Promise<boolean> {
    try {
      await fs.rename(oldname, newname);
      return true;
    } catch {
      return false;
    }
  }

  public static async copy(source: string, dest: string): Promise<boolean> {
    try {
      await fs.copyFile(source, dest);
      return true;
    } catch {
      return false;
    }
  }

  public static async tempnam(dir: string, prefix: string): Promise<string | false> {
    try {
      const name = path.join(dir, `${prefix}${Math.random().toString(36).substring(2)}`);
      await fs.writeFile(name, "");
      return name;
    } catch {
      return false;
    }
  }

  public static sys_get_temp_dir(): string {
    return os.tmpdir();
  }

  public static async scandir(dirpath: string): Promise<string[] | false> {
    try {
      return await fs.readdir(dirpath);
    } catch {
      return false;
    }
  }
}
