import * as fs from "fs/promises";
import * as path from "path";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPTypeError } from "../runtime/PHPError.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_NEW, encodePhpIdentifier, normalizePhpRegistryName } from "../runtime/Reflection.js";

async function unwrap(value: any): Promise<any> {
  return value instanceof PHPReference ? await value.get() : value;
}

async function resolveDirectory(ctx: PHPContext, directory: any): Promise<string> {
  const value = String(await unwrap(directory) ?? "");
  return path.isAbsolute(value) ? value : path.resolve(ctx.cwd || process.cwd(), value);
}

export class SPLFileInfo {
  public static [SYMBOL_PHP_NAME] = "SplFileInfo";
  public $filePath!: PHPReference;

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, filePath?: any): Promise<SPLFileInfo> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, filePath);
    return instance;
  }

  public async __construct(ctx: PHPContext, filePath?: any): Promise<void> {
    this.$filePath = new PHPVariable(String(await unwrap(filePath) ?? ""));
  }

  public async getpathname(ctx: PHPContext): Promise<string> {
    return String(await this.$filePath.get());
  }

  public async isdir(ctx: PHPContext): Promise<boolean> {
    try {
      return (await fs.stat(String(await this.$filePath.get()))).isDirectory();
    } catch {
      return false;
    }
  }

  public async __tostring(ctx: PHPContext): Promise<string> {
    return await this.getpathname(ctx);
  }

  public toString(): string {
    return this.$filePath.toString();
  }
}

export class RecursiveDirectoryIterator {
  public static [SYMBOL_PHP_NAME] = "RecursiveDirectoryIterator";
  public static [SYMBOL_PHP_CONSTANTS] = {
    current_as_fileinfo: 0,
    key_as_pathname: 256,
    key_as_filename: 512,
    follow_symlink: 16384,
    skip_dots: 4096,
    unix_pathnames: 8192,
  };

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, directory?: any): Promise<RecursiveDirectoryIterator> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, directory);
    return instance;
  }

  public async __construct(ctx: PHPContext, directory?: any): Promise<void> {
    const rootPath = await resolveDirectory(ctx, directory);
    Object.defineProperty(this, "__rootPath", { value: rootPath, enumerable: false });
    for (const entry of await fs.readdir(rootPath, { withFileTypes: true })) {
      const entryPath = path.join(rootPath, entry.name);
      Object.defineProperty(this, entryPath, {
        value: await SPLFileInfo[SYMBOL_PHP_NEW](ctx, entryPath),
        enumerable: true,
        configurable: true,
      });
    }
  }
}

export class RecursiveIteratorIterator {
  public static [SYMBOL_PHP_NAME] = "RecursiveIteratorIterator";
  public static [SYMBOL_PHP_CONSTANTS] = {
    leaves_only: 0,
    self_first: 1,
    child_first: 2,
  };

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, iterator?: any): Promise<RecursiveIteratorIterator> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, iterator);
    return instance;
  }

  public async __construct(ctx: PHPContext, iterator?: any): Promise<void> {
    const source = await unwrap(iterator);
    const rootPath = source?.__rootPath;
    if (typeof rootPath !== "string") {
      if (source && typeof source === "object") Object.assign(this, source);
      return;
    }

    const visited = new Set<string>();
    const visit = async (directory: string): Promise<void> => {
      const realDirectory = await fs.realpath(directory);
      if (visited.has(realDirectory)) return;
      visited.add(realDirectory);
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        Object.defineProperty(this, entryPath, {
          value: await SPLFileInfo[SYMBOL_PHP_NEW](ctx, entryPath),
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
  public static [SYMBOL_PHP_CONSTANTS] = {
    get_match: 0,
    all_matches: 1,
    split: 2,
    replace: 3,
  };

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<RecursiveRegexIterator> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, iterator, patternArg, modeArg);
    return instance;
  }

  public async __construct(ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<void> {}
}

export class FilesystemIterator {
  public static [SYMBOL_PHP_NAME] = "FilesystemIterator";
  public static [SYMBOL_PHP_CONSTANTS] = {
    current_as_fileinfo: 0,
    key_as_pathname: 256,
    key_as_filename: 512,
    follow_symlink: 16384,
    skip_dots: 4096,
    unix_pathnames: 8192,
  };

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, directory?: any, flagsArg?: any): Promise<FilesystemIterator> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, directory, flagsArg);
    return instance;
  }

  public async __construct(ctx: PHPContext, directory?: any, flagsArg?: any): Promise<void> {
    const source = await unwrap(directory);
    if (source && typeof source === "object") Object.assign(this, source);
  }
}

export class RegexIterator {
  public static [SYMBOL_PHP_NAME] = "RegexIterator";
  public static [SYMBOL_PHP_CONSTANTS] = {
    get_match: 0,
    all_matches: 1,
    split: 2,
    replace: 3,
  };

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<RegexIterator> {
    const instance = Object.create(this.prototype);
    await instance.__construct(ctx, iterator, patternArg, modeArg);
    return instance;
  }

  public async __construct(ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<void> {
    const source = await unwrap(iterator);
    const pattern = String(await unwrap(patternArg) ?? "");
    const delimiter = pattern[0];
    const delimiterIndex = pattern.lastIndexOf(delimiter);
    const expression = delimiterIndex > 0 ? pattern.slice(1, delimiterIndex) : pattern;
    const modifiers = delimiterIndex > 0 ? pattern.slice(delimiterIndex + 1) : "";
    const regex = new RegExp(expression, modifiers.includes("i") ? "i" : "");
    const mode = Number(await unwrap(modeArg) ?? 0);

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
  private readonly objectIdSymbol = Symbol("spl.objectId");
  private objectIds: { object: object; id: number }[] = [];
  private nextObjectId = 1;

  private getAutoloaders(ctx: PHPContext): any[] {
    let list = ctx.getInternalVar("spl_autoloaders");
    if (!list) {
      list = [];
      ctx.setInternalVar("spl_autoloaders", list);
    }
    return list;
  }

  private async getObjectId(valueArg: any, functionName: string): Promise<number> {
    const value = valueArg instanceof PHPReference ? await valueArg.get() : valueArg;
    if (value === null || (typeof value !== "object" && typeof value !== "function") || Array.isArray(value)) {
      throw new PHPTypeError(`${functionName}(): Argument #1 ($object) must be of type object`);
    }
    const existingId = (value as any)[this.objectIdSymbol];
    if (typeof existingId === "number") return existingId;

    const existing = this.objectIds.find((entry) => entry.object === value);
    if (existing) return existing.id;

    const objectId = this.nextObjectId++;
    if (Object.isExtensible(value)) {
      Object.defineProperty(value, this.objectIdSymbol, { value: objectId });
    } else {
      this.objectIds.push({ object: value, id: objectId });
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
        callback = callback instanceof PHPReference ? await callback.get() : callback;
        if (typeof callback === "string") {
          const fn = ctx.functions[normalizePhpRegistryName(callback)] || ctx.functionMissing(callback);
          await fn(ctx, new PHPLiteral(requestedName));
        }
        else if (Array.isArray(callback) && callback.length === 2) {
          const target0 = callback[0] instanceof PHPReference ? await callback[0].get() : callback[0];
          const mName = String(callback[1] instanceof PHPReference ? await callback[1].get() : callback[1]).toLowerCase();
          if (typeof target0 === "string") {
            const clsName = normalizePhpRegistryName(target0);
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
      spl_object_id: async (ctx: PHPContext, value?: PHPReference) => await this.getObjectId(value, "spl_object_id"),
      spl_object_hash: async (ctx: PHPContext, value?: PHPReference) => (await this.getObjectId(value, "spl_object_hash")).toString(16).padStart(32, "0"),
      spl_autoload_register: async (ctx: PHPContext, callbackArg?: any) => {
        const callback = callbackArg instanceof PHPReference ? await callbackArg.get() : callbackArg;
        if (callback !== undefined && callback !== null) {
          this.getAutoloaders(ctx).push(callback);
          return true;
        }
        return false;
      },
      spl_autoload_unregister: async (ctx: PHPContext, callbackArg?: any) => {
        const callback = callbackArg instanceof PHPReference ? await callbackArg.get() : callbackArg;
        const list = this.getAutoloaders(ctx);
        const filtered = list.filter((cb) => cb !== callback);
        ctx.setInternalVar("spl_autoloaders", filtered);
        return true;
      },
      spl_autoload_functions: async (ctx: PHPContext) => this.getAutoloaders(ctx),
    };
  }
}
