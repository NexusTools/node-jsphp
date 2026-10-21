import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { glob as matchGlob } from "glob";
import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPReference } from "./PHPVariable.js";

function resolvePath(ctx: PHPContext, p: string): string {
  if (!p) return "";
  if (path.isAbsolute(p)) return p;
  return path.resolve(ctx?.cwd || process.cwd(), p);
}

export class FileSystemRuntime {
  public static async fileowner(ctx: PHPContext, filenameArg?: PHPReference): Promise<number | false> {
    try {
      const filename = resolvePath(ctx, String(await filenameArg?.get() ?? ""));
      return (await fs.stat(filename)).uid;
    } catch { return false; }
  }

  public static async fileperms(ctx: PHPContext, filenameArg?: PHPReference): Promise<number | false> {
    try {
      const filename = resolvePath(ctx, String(await filenameArg?.get() ?? ""));
      return (await fs.stat(filename)).mode;
    } catch { return false; }
  }

  public static async glob(ctx: PHPContext, patternArg?: PHPReference, flagsArg?: PHPReference): Promise<string[] | false> {
    try {
      const pattern = String(await patternArg?.get() ?? "");
      const flags = Number(await flagsArg?.get()) || 0;
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

  public static async file(ctx: PHPContext, filepathArg?: PHPReference, flagsArg?: PHPReference): Promise<string[] | false> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      const flags = Number(await flagsArg?.get()) || 0;
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

  public static async file_get_contents(ctx: PHPContext, filepathArg?: any): Promise<string | false> {
    try {
      const strPath = await ctx.str(await ctx.toVal(filepathArg));
      if (strPath.startsWith("http://") || strPath.startsWith("https://")) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1000);
          if (typeof timer.unref === "function") timer.unref();
          try {
            const res = await fetch(strPath, { signal: controller.signal });
            clearTimeout(timer);
            return await res.text();
          } catch {
            clearTimeout(timer);
            return false;
          }
        } catch {
          return false;
        }
      }
      const filepath = resolvePath(ctx, strPath);
      return await fs.readFile(filepath, "utf8");
    } catch {
      return false;
    }
  }

  public static async file_put_contents(ctx: PHPContext, filepathArg?: PHPReference, dataArg?: PHPReference, flagsArg?: PHPReference): Promise<number | false> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      const data = await dataArg?.get();
      const flags = Number(await flagsArg?.get()) || 0;
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

  public static async file_exists(ctx: PHPContext, filepathArg?: PHPReference): Promise<boolean> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  public static async is_dir(ctx: PHPContext, filepathArg?: PHPReference): Promise<boolean> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      const stat = await fs.stat(filepath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  public static async is_file(ctx: PHPContext, filepathArg?: PHPReference): Promise<boolean> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      const stat = await fs.stat(filepath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  public static async is_readable(ctx: PHPContext, filepathArg?: PHPReference): Promise<boolean> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      await fs.access(filepath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  public static async is_writable(ctx: PHPContext, filepathArg?: PHPReference): Promise<boolean> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      await fs.access(filepath, fs.constants.W_OK);
      return true;
    } catch {
      try {
        const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
        await fs.access(filepath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    }
  }

  public static async filesize(ctx: PHPContext, filepathArg?: PHPReference): Promise<number | false> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      const stat = await fs.stat(filepath);
      return stat.size;
    } catch {
      return false;
    }
  }

  public static async filemtime(ctx: PHPContext, filepathArg?: PHPReference): Promise<number | false> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      const stat = await fs.stat(filepath);
      return Math.floor(stat.mtimeMs / 1000);
    } catch {
      return false;
    }
  }

  public static async realpath(ctx: PHPContext, filepathArg?: PHPReference): Promise<string | false> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      return await fs.realpath(filepath);
    } catch {
      return false;
    }
  }

  public static async basename(ctx: PHPContext, filepathArg?: any, suffixArg?: any): Promise<string> {
    const filepath = String(await ctx.toVal(filepathArg) ?? "");
    const suffixVal = await ctx.toVal(suffixArg);
    const suffix = suffixVal ? String(suffixVal) : undefined;
    const normalized = filepath.replace(/\\/g, "/");
    let base = path.basename(normalized);
    if (suffix && base.endsWith(suffix)) {
      base = base.substring(0, base.length - suffix.length);
    }
    return base;
  }

  public static async dirname(ctx: PHPContext, filepathArg?: any): Promise<string> {
    const filepath = String(await ctx.toVal(filepathArg) ?? "");
    return path.dirname(filepath);
  }

  public static async pathinfo(ctx: PHPContext, filepathArg?: any, flagsArg?: any): Promise<Record<string, string>> {
    const filepath = String(await ctx.toVal(filepathArg) ?? "");
    const parsed = path.parse(filepath);
    return {
      dirname: parsed.dir,
      basename: parsed.base,
      extension: parsed.ext ? parsed.ext.substring(1) : "",
      filename: parsed.name,
    };
  }

  public static async mkdir(ctx: PHPContext, dirpathArg?: PHPReference, modeArg?: PHPReference, recursiveArg?: PHPReference): Promise<boolean> {
    try {
      const dirpath = resolvePath(ctx, String(await dirpathArg?.get() ?? ""));
      const mode = Number(await modeArg?.get()) || 0o777;
      const recursive = Boolean(await recursiveArg?.get());
      await fs.mkdir(dirpath, { recursive, mode });
      return true;
    } catch {
      return false;
    }
  }

  public static async chmod(ctx: PHPContext, filenameArg?: PHPReference, modeArg?: PHPReference): Promise<boolean> {
    try {
      const filename = resolvePath(ctx, String(await filenameArg?.get() ?? ""));
      const mode = Number(await modeArg?.get()) || 0o666;
      await fs.chmod(filename, mode);
      return true;
    } catch {
      return true;
    }
  }

  public static async rmdir(ctx: PHPContext, dirpathArg?: PHPReference): Promise<boolean> {
    try {
      const dirpath = resolvePath(ctx, String(await dirpathArg?.get() ?? ""));
      await fs.rmdir(dirpath);
      return true;
    } catch {
      return false;
    }
  }

  public static async unlink(ctx: PHPContext, filepathArg?: PHPReference): Promise<boolean> {
    try {
      const filepath = resolvePath(ctx, String(await filepathArg?.get() ?? ""));
      await fs.unlink(filepath);
      return true;
    } catch {
      return false;
    }
  }

  public static async rename(ctx: PHPContext, oldnameArg?: PHPReference, newnameArg?: PHPReference): Promise<boolean> {
    try {
      const oldname = resolvePath(ctx, String(await oldnameArg?.get() ?? ""));
      const newname = resolvePath(ctx, String(await newnameArg?.get() ?? ""));
      await fs.rename(oldname, newname);
      return true;
    } catch {
      return false;
    }
  }

  public static async copy(ctx: PHPContext, sourceArg?: PHPReference, destArg?: PHPReference): Promise<boolean> {
    try {
      const source = resolvePath(ctx, String(await sourceArg?.get() ?? ""));
      const dest = resolvePath(ctx, String(await destArg?.get() ?? ""));
      await fs.copyFile(source, dest);
      return true;
    } catch {
      return false;
    }
  }

  public static async tempnam(ctx: PHPContext, dirArg?: PHPReference, prefixArg?: PHPReference): Promise<string | false> {
    try {
      const dir = resolvePath(ctx, String(await dirArg?.get() ?? ""));
      const prefix = String(await prefixArg?.get() ?? "");
      const name = path.join(dir, `${prefix}${Math.random().toString(36).substring(2)}`);
      await fs.writeFile(name, "");
      return name;
    } catch {
      return false;
    }
  }

  public static async sys_get_temp_dir(ctx?: PHPContext): Promise<string> {
    return os.tmpdir();
  }

  public static async scandir(ctx: PHPContext, dirpathArg?: PHPReference): Promise<string[] | false> {
    try {
      const dirpath = resolvePath(ctx, String(await dirpathArg?.get() ?? ""));
      return await fs.readdir(dirpath);
    } catch {
      return false;
    }
  }

  public static async opendir(ctx: PHPContext, pathArg?: any): Promise<any> {
    const rawPath = String(await ctx.toVal(pathArg) ?? "");
    const resolved = resolvePath(ctx, rawPath);
    try {
      if (!(await fs.stat(resolved)).isDirectory()) return false;
      const entries = await fs.readdir(resolved);
      return { isResource: true, resourceType: "dir", path: resolved, entries, ptr: 0 };
    } catch {
      return false;
    }
  }

  public static async readdir(ctx: PHPContext, handleArg?: any): Promise<string | false> {
    const handle = await ctx.toVal(handleArg);
    if (!handle || typeof handle !== "object" || !Array.isArray(handle.entries)) return false;
    if (handle.ptr >= handle.entries.length) return false;
    return handle.entries[handle.ptr++];
  }

  public static async closedir(ctx: PHPContext, handleArg?: any): Promise<boolean> {
    const handle = await ctx.toVal(handleArg);
    if (handle && typeof handle === "object") handle.entries = [];
    return true;
  }

  public static async rewinddir(ctx: PHPContext, handleArg?: any): Promise<void> {
    const handle = await ctx.toVal(handleArg);
    if (handle && typeof handle === "object") handle.ptr = 0;
  }

  static constants = {
    glob_err: 1,
    glob_mark: 2,
    glob_nosort: 4,
    glob_nocheck: 16,
    glob_noescape: 64,
    glob_brace: 1024,
    glob_onlydir: 8192,
    file_use_include_path: 1,
    file_ignore_new_lines: 2,
    file_skip_empty_lines: 4,
    file_append: 8,
  };

  static functions = {
    "fileowner": FileSystemRuntime.fileowner,
    "fileperms": FileSystemRuntime.fileperms,
    "glob": FileSystemRuntime.glob,
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
    "opendir": FileSystemRuntime.opendir,
    "readdir": FileSystemRuntime.readdir,
    "closedir": FileSystemRuntime.closedir,
    "rewinddir": FileSystemRuntime.rewinddir,
    "chmod": FileSystemRuntime.chmod,
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
