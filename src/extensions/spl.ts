import * as fs from "fs";
import * as path from "path";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPTypeError } from "../runtime/PHPError.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME } from "../runtime/Reflection.js";

function unwrap(value: any): any {
  return value instanceof PHPReference ? value.get() : value;
}

function resolveDirectory(ctx: PHPContext, directory: any): string {
  const value = String(unwrap(directory) ?? "");
  return path.isAbsolute(value) ? value : path.resolve(ctx.cwd || process.cwd(), value);
}

export class SPLFileInfo {
  public static [SYMBOL_PHP_NAME] = "SplFileInfo";
  public $filePath!: PHPReference;

  public static async __$$__new(ctx: PHPContext, filePath?: any): Promise<SPLFileInfo> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, filePath);
    return instance;
  }

  public async __construct(ctx: PHPContext, filePath?: any): Promise<void> {
    this.$filePath = new PHPVariable(String(unwrap(filePath) ?? ""));
  }

  public getpathname(ctx: PHPContext): string {
    return String(this.$filePath.get());
  }

  public isdir(ctx: PHPContext): boolean {
    try {
      return fs.statSync(String(this.$filePath.get())).isDirectory();
    } catch {
      return false;
    }
  }

  public __tostring(ctx: PHPContext): string {
    return this.getpathname(ctx);
  }

  public toString(): string {
    return String(this.$filePath.get());
  }
}

export class RecursiveDirectoryIterator {
  public static [SYMBOL_PHP_NAME] = "RecursiveDirectoryIterator";
  public static __php_constants = new Map([
    ["current_as_fileinfo", 0],
    ["key_as_pathname", 256],
    ["key_as_filename", 512],
    ["follow_symlink", 16384],
    ["skip_dots", 4096],
    ["unix_pathnames", 8192],
  ]);

  public static async __$$__new(ctx: PHPContext, directory?: any): Promise<RecursiveDirectoryIterator> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, directory);
    return instance;
  }

  public async __construct(ctx: PHPContext, directory?: any): Promise<void> {
    const rootPath = resolveDirectory(ctx, directory);
    Object.defineProperty(this, "__rootPath", { value: rootPath, enumerable: false });
    for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
      const entryPath = path.join(rootPath, entry.name);
      Object.defineProperty(this, entryPath, {
        value: await SPLFileInfo.__$$__new(ctx, entryPath),
        enumerable: true,
        configurable: true,
      });
    }
  }
}

export class RecursiveIteratorIterator {
  public static [SYMBOL_PHP_NAME] = "RecursiveIteratorIterator";
  public static __php_constants = new Map([
    ["leaves_only", 0],
    ["self_first", 1],
    ["child_first", 2],
  ]);

  public static async __$$__new(ctx: PHPContext, iterator?: any): Promise<RecursiveIteratorIterator> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, iterator);
    return instance;
  }

  public async __construct(ctx: PHPContext, iterator?: any): Promise<void> {
    const source = unwrap(iterator);
    const rootPath = source?.__rootPath;
    if (typeof rootPath !== "string") {
      if (source && typeof source === "object") Object.assign(this, source);
      return;
    }

    const visited = new Set<string>();
    const visit = async (directory: string): Promise<void> => {
      const realDirectory = fs.realpathSync(directory);
      if (visited.has(realDirectory)) return;
      visited.add(realDirectory);
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        Object.defineProperty(this, entryPath, {
          value: await SPLFileInfo.__$$__new(ctx, entryPath),
          enumerable: true,
          configurable: true,
        });
        if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(entryPath);
      }
    };
    await visit(rootPath);
  }
}

export class RecursiveRegexIterator {
  public static [SYMBOL_PHP_NAME] = "RecursiveRegexIterator";
  public static __php_constants = new Map([
    ["get_match", 0],
    ["all_matches", 1],
    ["split", 2],
    ["replace", 3],
  ]);
}

export class FilesystemIterator {
  public static [SYMBOL_PHP_NAME] = "FilesystemIterator";
  public static __php_constants = new Map([
    ["current_as_fileinfo", 0],
    ["key_as_pathname", 256],
    ["key_as_filename", 512],
    ["follow_symlink", 16384],
    ["skip_dots", 4096],
    ["unix_pathnames", 8192],
  ]);
}

export class RegexIterator {
  public static [SYMBOL_PHP_NAME] = "RegexIterator";
  public static __php_constants = new Map([
    ["get_match", 0],
    ["all_matches", 1],
    ["split", 2],
    ["replace", 3],
  ]);

  public static async __$$__new(ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<RegexIterator> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, iterator, patternArg, modeArg);
    return instance;
  }

  public async __construct(ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<void> {
    const source = unwrap(iterator);
    const pattern = String(unwrap(patternArg) ?? "");
    const delimiter = pattern[0];
    const delimiterIndex = pattern.lastIndexOf(delimiter);
    const expression = delimiterIndex > 0 ? pattern.slice(1, delimiterIndex) : pattern;
    const modifiers = delimiterIndex > 0 ? pattern.slice(delimiterIndex + 1) : "";
    const regex = new RegExp(expression, modifiers.includes("i") ? "i" : "");
    const mode = Number(unwrap(modeArg) ?? 0);

    if (!source || typeof source !== "object") return;
    for (const [key, value] of Object.entries(source)) {
      const match = regex.exec(key);
      if (match) {
        Object.defineProperty(this, key, {
          value: mode === 0 ? Array.from(match) : value,
          enumerable: true,
          configurable: true,
        });
      }
    }
  }
}

export class SPLExtension extends PHPExtension {
  public readonly name = "spl";
  private objectIds = new WeakMap<object, number>();
  private nextObjectId = 1;

  private getAutoloaders(ctx: PHPContext): any[] {
    let list = ctx.getInternalVar("spl_autoloaders");
    if (!list) {
      list = [];
      ctx.setInternalVar("spl_autoloaders", list);
    }
    return list;
  }

  private getObjectId(valueArg: any, functionName: string): number {
    const value = valueArg instanceof PHPReference ? valueArg.get() : valueArg;
    if (value === null || (typeof value !== "object" && typeof value !== "function") || Array.isArray(value)) {
      throw new PHPTypeError(`${functionName}(): Argument #1 ($object) must be of type object`);
    }
    let objectId = this.objectIds.get(value);
    if (objectId === undefined) {
      objectId = this.nextObjectId++;
      this.objectIds.set(value, objectId);
    }
    return objectId;
  }

  public onInit(engine: PHPEngine): void {
    this.classes = {
      splfileinfo: SPLFileInfo,
      recursivedirectoryiterator: RecursiveDirectoryIterator,
      recursiveiteratoriterator: RecursiveIteratorIterator,
      recursiveregexiterator: RecursiveRegexIterator,
      filesystemiterator: FilesystemIterator,
      regexiterator: RegexIterator,
    };

    engine.registerClassResolver(async (ctx: PHPContext, requestedName: string) => {
      const autoloaders = this.getAutoloaders(ctx);
      for (let callback of autoloaders) {
        callback = callback instanceof PHPReference ? callback.get() : callback;
        if (typeof callback === "string") {
          const fn = ctx.functions[callback.toLowerCase()] || ctx.functionMissing(callback);
          await fn(ctx, new PHPLiteral(requestedName));
        }
        else if (Array.isArray(callback) && callback.length === 2) {
          const target0 = callback[0] instanceof PHPReference ? callback[0].get() : callback[0];
          const mName = String(callback[1] instanceof PHPReference ? callback[1].get() : callback[1]).toLowerCase();
          if (typeof target0 === "string") {
            const clsName = target0.toLowerCase();
            const cls = ctx.classes[clsName] || engine.classes[clsName] || (await ctx.resolveClass(clsName, target0));
            if (cls && typeof cls[mName] === "function") {
              await cls[mName](ctx, new PHPLiteral(requestedName));
            }
          } else if (target0 && typeof target0 === "object") {
            if (typeof target0[mName] === "function") {
              await target0[mName](ctx, new PHPLiteral(requestedName));
            }
          }
        }
        else if (typeof callback === "function") await callback.apply(ctx, [ctx, new PHPLiteral(requestedName)]);
        const lowerReq = String(requestedName).toLowerCase();
        if (lowerReq in engine.classes || lowerReq in ctx.classes || lowerReq in (engine as any).interfaces || lowerReq in ctx.interfaces) return;
      }
    });

    this.functions = {
      spl_object_id: (ctx: PHPContext, value?: PHPReference) => this.getObjectId(value, "spl_object_id"),
      spl_object_hash: (ctx: PHPContext, value?: PHPReference) => this.getObjectId(value, "spl_object_hash").toString(16).padStart(32, "0"),
      spl_autoload_register: (ctx: PHPContext, callbackArg?: any) => {
        const callback = callbackArg instanceof PHPReference ? callbackArg.get() : callbackArg;
        if (callback !== undefined && callback !== null) {
          this.getAutoloaders(ctx).push(callback);
          return true;
        }
        return false;
      },
      spl_autoload_unregister: (ctx: PHPContext, callbackArg?: any) => {
        const callback = callbackArg instanceof PHPReference ? callbackArg.get() : callbackArg;
        const list = this.getAutoloaders(ctx);
        const filtered = list.filter((cb) => cb !== callback);
        ctx.setInternalVar("spl_autoloaders", filtered);
        return true;
      },
      spl_autoload_functions: (ctx: PHPContext) => this.getAutoloaders(ctx),
    };
  }
}
