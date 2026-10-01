import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { glob as matchGlob } from "glob";
import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";

export class FileSystemRuntime {
  public static async fileowner(ctx: PHPContext, filename: string): Promise<number | false> {
    try { return (await fs.stat(path.resolve(ctx.cwd, filename))).uid; }
    catch { return false; }
  }

  public static async fileperms(ctx: PHPContext, filename: string): Promise<number | false> {
    try { return (await fs.stat(path.resolve(ctx.cwd, filename))).mode; }
    catch { return false; }
  }

  public static async glob(ctx: PHPContext, pattern: string, flags = 0): Promise<string[] | false> {
    try {
      const cwd = ctx.cwd;
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

  public static async file(ctx: PHPContext, filepath: string, flags = 0): Promise<string[] | false> {
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

  public static async file_get_contents(ctx: PHPContext, filepath: string): Promise<string | false> {
    try {
      return await fs.readFile(filepath, "utf8");
    } catch {
      return false;
    }
  }

  public static async file_put_contents(ctx: PHPContext, filepath: string, data: any, flags = 0): Promise<number | false> {
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

  public static async file_exists(ctx: PHPContext, filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  public static async is_dir(ctx: PHPContext, filepath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filepath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  public static async is_file(ctx: PHPContext, filepath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filepath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  public static async is_readable(ctx: PHPContext, filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  public static async is_writable(ctx: PHPContext, filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  public static async filesize(ctx: PHPContext, filepath: string): Promise<number | false> {
    try {
      const stat = await fs.stat(filepath);
      return stat.size;
    } catch {
      return false;
    }
  }

  public static async filemtime(ctx: PHPContext, filepath: string): Promise<number | false> {
    try {
      const stat = await fs.stat(filepath);
      return Math.floor(stat.mtimeMs / 1000);
    } catch {
      return false;
    }
  }

  public static async realpath(ctx: PHPContext, filepath: string): Promise<string | false> {
    try {
      return await fs.realpath(filepath);
    } catch {
      return false;
    }
  }

  public static basename(ctx: PHPContext, filepath: string, suffix?: string): string {
    const normalized = String(filepath ?? "").replace(/\\/g, "/");
    let base = path.basename(normalized);
    if (suffix && base.endsWith(suffix)) {
      base = base.substring(0, base.length - suffix.length);
    }
    return base;
  }

  public static dirname(ctx: PHPContext, filepath: string): string {
    return path.dirname(filepath);
  }

  public static pathinfo(ctx: PHPContext, filepath: string, flags = 15): Record<string, string> {
    const parsed = path.parse(filepath);
    return {
      dirname: parsed.dir,
      basename: parsed.base,
      extension: parsed.ext ? parsed.ext.substring(1) : "",
      filename: parsed.name,
    };
  }

  public static async mkdir(ctx: PHPContext, dirpath: string, mode = 0o777, recursive = false): Promise<boolean> {
    try {
      await fs.mkdir(dirpath, { recursive, mode });
      return true;
    } catch {
      return false;
    }
  }

  public static async rmdir(ctx: PHPContext, dirpath: string): Promise<boolean> {
    try {
      await fs.rmdir(dirpath);
      return true;
    } catch {
      return false;
    }
  }

  public static async unlink(ctx: PHPContext, filepath: string): Promise<boolean> {
    try {
      await fs.unlink(filepath);
      return true;
    } catch {
      return false;
    }
  }

  public static async rename(ctx: PHPContext, oldname: string, newname: string): Promise<boolean> {
    try {
      await fs.rename(oldname, newname);
      return true;
    } catch {
      return false;
    }
  }

  public static async copy(ctx: PHPContext, source: string, dest: string): Promise<boolean> {
    try {
      await fs.copyFile(source, dest);
      return true;
    } catch {
      return false;
    }
  }

  public static async tempnam(ctx: PHPContext, dir: string, prefix: string): Promise<string | false> {
    try {
      const name = path.join(dir, `${prefix}${Math.random().toString(36).substring(2)}`);
      await fs.writeFile(name, "");
      return name;
    } catch {
      return false;
    }
  }

  public static sys_get_temp_dir(ctx?: PHPContext): string {
    return os.tmpdir();
  }

  public static async scandir(ctx: PHPContext, dirpath: string): Promise<string[] | false> {
    try {
      return await fs.readdir(dirpath);
    } catch {
      return false;
    }
  }

  static constants = {
    GLOB_ERR: 1,
    GLOB_MARK: 2,
    GLOB_NOSORT: 4,
    GLOB_NOCHECK: 16,
    GLOB_NOESCAPE: 64,
    GLOB_BRACE: 1024,
    GLOB_ONLYDIR: 8192,
  };

  static functions = {
    "glob": FileSystemRuntime.glob,
    "fileowner": FileSystemRuntime.fileowner,
    "fileperms": FileSystemRuntime.fileperms,
    "file": FileSystemRuntime.file,
    "file_get_contents": FileSystemRuntime.file_get_contents,
    "file_put_contents": FileSystemRuntime.file_put_contents,
    "file_exists": FileSystemRuntime.file_exists,
    "is_dir": FileSystemRuntime.is_dir,
    "is_file": FileSystemRuntime.is_file,
    "is_readable": FileSystemRuntime.is_readable,
    "is_writable": FileSystemRuntime.is_writable,
    "filesize": FileSystemRuntime.filesize,
    "filemtime": FileSystemRuntime.filemtime,
    "realpath": FileSystemRuntime.realpath,
    "basename": FileSystemRuntime.basename,
    "dirname": FileSystemRuntime.dirname,
    "pathinfo": FileSystemRuntime.pathinfo,
    "mkdir": FileSystemRuntime.mkdir,
    "rmdir": FileSystemRuntime.rmdir,
    "unlink": FileSystemRuntime.unlink,
    "rename": FileSystemRuntime.rename,
    "copy": FileSystemRuntime.copy,
    "tempnam": FileSystemRuntime.tempnam,
    "sys_get_temp_dir": FileSystemRuntime.sys_get_temp_dir,
    "scandir": FileSystemRuntime.scandir,
  };

  public static register(engine: PHPEngine): void {
    engine.registerConstants(FileSystemRuntime.constants);
    engine.registerFunctions(FileSystemRuntime.functions);
  }
}
