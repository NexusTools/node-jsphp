import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export class FileSystemRuntime {
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
