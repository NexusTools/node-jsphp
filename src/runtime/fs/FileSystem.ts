import * as fs from "fs";
import * as path from "path";

export class FileSystemRuntime {
  public static file_get_contents(filepath: string): string | false {
    try {
      return fs.readFileSync(filepath, "utf8");
    } catch {
      return false;
    }
  }

  public static file_put_contents(filepath: string, data: any, flags: number = 0): number | false {
    try {
      const str = typeof data === "string" || Buffer.isBuffer(data) ? data : String(data);
      if (flags & 8) {
        // FILE_APPEND = 8
        fs.appendFileSync(filepath, str);
      } else {
        fs.writeFileSync(filepath, str);
      }
      return typeof str === "string" ? Buffer.byteLength(str) : str.length;
    } catch {
      return false;
    }
  }

  public static file_exists(filepath: string): boolean {
    return fs.existsSync(filepath);
  }

  public static is_dir(filepath: string): boolean {
    try {
      return fs.statSync(filepath).isDirectory();
    } catch {
      return false;
    }
  }

  public static is_file(filepath: string): boolean {
    try {
      return fs.statSync(filepath).isFile();
    } catch {
      return false;
    }
  }

  public static unlink(filepath: string): boolean {
    try {
      fs.unlinkSync(filepath);
      return true;
    } catch {
      return false;
    }
  }
}
