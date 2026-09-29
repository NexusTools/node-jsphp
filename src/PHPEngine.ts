import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { PHPExtension } from "./PHPExtension";
import { PHPContext, PHPContextOptions } from "./PHPContext";
import { JSTranspiler } from "./parser/JSTranspiler";
import { OptimizerContext } from "./parser/ASTOptimizer";

import { StringRuntime } from "./runtime/strings/Strings";
import { ArrayRuntime } from "./runtime/arrays/Arrays";
import { FileSystemRuntime } from "./runtime/fs/FileSystem";

import { MySQLiExtension } from "./extensions/mysqli/mysqli";
import { PDOExtension } from "./extensions/pdo/pdo";
import { GDExtension } from "./extensions/gd/gd";
import { PCREExtension } from "./extensions/pcre/pcre";
import { MbstringExtension } from "./extensions/mbstring/mbstring";
import { JSONExtension } from "./extensions/json/json";
import { CurlExtension } from "./extensions/curl/curl";
import { SessionExtension } from "./extensions/session/session";
import { XMLExtension } from "./extensions/xml/xml";
import { SPLExtension } from "./extensions/spl/spl";
import { HashExtension } from "./extensions/hash/hash";
import { OpenSSLExtension } from "./extensions/openssl/openssl";

export interface PHPEngineOptions {
  extensions?: PHPExtension[];
  constants?: Record<string, any>;
  cacheDir?: string;
  watch?: boolean;
}

export class PHPEngine {
  public extensions: Map<string, PHPExtension> = new Map();
  public constants: Map<string, any> = new Map();
  public functions: Map<string, Function> = new Map();
  public classes: Map<string, any> = new Map();
  private compiledCache: Map<string, Function> = new Map();
  private watcher?: chokidar.FSWatcher;
  private transpiler: JSTranspiler;
  private cacheDir?: string;

  constructor(options: PHPEngineOptions = {}) {
    this.transpiler = new JSTranspiler();
    this.cacheDir = options.cacheDir || process.env.JSPHP_CACHE;

    // Set core PHP constants
    this.constants.set("PHP_VERSION", "8.5.0");
    this.constants.set("PHP_ENGINE", "jsphp");
    this.constants.set("PHP_OS", process.platform === "win32" ? "WINNT" : "Linux");
    this.constants.set("DIRECTORY_SEPARATOR", path.sep);
    this.constants.set("PATH_SEPARATOR", process.platform === "win32" ? ";" : ":");

    if (options.constants) {
      for (const [key, val] of Object.entries(options.constants)) {
        this.constants.set(key, val);
      }
    }

    this.registerCoreFunctions();

    // Default extensions list if not explicitly provided
    const defaultExtensions: PHPExtension[] = options.extensions || [
      new MySQLiExtension(),
      new PDOExtension(),
      new GDExtension(),
      new PCREExtension(),
      new MbstringExtension(),
      new JSONExtension(),
      new CurlExtension(),
      new SessionExtension(),
      new XMLExtension(),
      new SPLExtension(),
      new HashExtension(),
      new OpenSSLExtension(),
    ];

    defaultExtensions.forEach((ext) => this.registerExtension(ext));

    if (options.watch !== false) {
      this.initWatcher();
    }
  }

  private registerCoreFunctions(): void {
    this.functions.set("define", (ctx: PHPContext, name: string, value: any) => {
      this.constants.set(name, value);
      return true;
    });
    this.functions.set("defined", (ctx: PHPContext, name: string) => {
      return this.constants.has(name);
    });
    this.functions.set("extension_loaded", (ctx: PHPContext, name: string) => {
      return this.extensions.has(name.toLowerCase());
    });
    this.functions.set("function_exists", (ctx: PHPContext, name: string) => {
      return this.functions.has(name.toLowerCase());
    });
    this.functions.set("class_exists", (ctx: PHPContext, name: string) => {
      return this.classes.has(name.toLowerCase());
    });
    this.functions.set("constant", (ctx: PHPContext, name: string) => {
      return this.constants.get(name);
    });

    // Output buffering
    this.functions.set("ob_start", (ctx: PHPContext) => ctx.outputBuffer.start());
    this.functions.set("ob_get_clean", (ctx: PHPContext) => ctx.outputBuffer.getClean());
    this.functions.set("ob_get_contents", (ctx: PHPContext) => ctx.outputBuffer.getContents());
    this.functions.set("ob_flush", (ctx: PHPContext) => ctx.outputBuffer.flush());
    this.functions.set("ob_end_clean", (ctx: PHPContext) => ctx.outputBuffer.endClean());
    this.functions.set("ob_get_level", (ctx: PHPContext) => ctx.outputBuffer.getLevel());

    // Strings
    this.functions.set("strlen", (ctx: PHPContext, str: string) => StringRuntime.strlen(str));
    this.functions.set("substr", (ctx: PHPContext, str: string, start: number, length?: number) => StringRuntime.substr(str, start, length));
    this.functions.set("strpos", (ctx: PHPContext, haystack: string, needle: string, offset = 0) => StringRuntime.strpos(haystack, needle, offset));
    this.functions.set("explode", (ctx: PHPContext, delim: string, str: string, limit?: number) => StringRuntime.explode(delim, str, limit));
    this.functions.set("implode", (ctx: PHPContext, glue: string, pieces: any[]) => StringRuntime.implode(glue, pieces));

    // Arrays
    this.functions.set("count", (ctx: PHPContext, arr: any) => ArrayRuntime.count(arr));
    this.functions.set("in_array", (ctx: PHPContext, needle: any, haystack: any, strict = false) => ArrayRuntime.in_array(needle, haystack, strict));
    this.functions.set("array_merge", (ctx: PHPContext, ...arrays: any[]) => ArrayRuntime.array_merge(...arrays));

    // File system
    this.functions.set("file_get_contents", (ctx: PHPContext, path: string) => FileSystemRuntime.file_get_contents(path));
    this.functions.set("file_put_contents", (ctx: PHPContext, path: string, data: any, flags = 0) => FileSystemRuntime.file_put_contents(path, data, flags));
    this.functions.set("file_exists", (ctx: PHPContext, path: string) => FileSystemRuntime.file_exists(path));
    this.functions.set("is_dir", (ctx: PHPContext, path: string) => FileSystemRuntime.is_dir(path));
    this.functions.set("is_file", (ctx: PHPContext, path: string) => FileSystemRuntime.is_file(path));
    this.functions.set("unlink", (ctx: PHPContext, path: string) => FileSystemRuntime.unlink(path));
  }

  public registerExtension(extension: PHPExtension): void {
    this.extensions.set(extension.name.toLowerCase(), extension);
    extension.onInit(this);

    for (const [key, val] of Object.entries(extension.constants)) {
      this.constants.set(key, val);
    }
    for (const [key, func] of Object.entries(extension.functions)) {
      this.functions.set(key.toLowerCase(), func);
    }
    for (const [key, cls] of Object.entries(extension.classes)) {
      this.classes.set(key.toLowerCase(), cls);
    }
  }

  public getConfigurationSHA1(): string {
    const sortedExts = Array.from(this.extensions.keys()).sort().join(",");
    const sortedConsts = Array.from(this.constants.entries())
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join(";");
    return crypto.createHash("sha1").update(`${sortedExts}|${sortedConsts}`).digest("hex");
  }

  public async compileFile(filepath: string): Promise<Function> {
    const resolvedPath = path.resolve(filepath);
    if (this.compiledCache.has(resolvedPath)) {
      return this.compiledCache.get(resolvedPath)!;
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`PHP file not found: ${resolvedPath}`);
    }

    const source = fs.readFileSync(resolvedPath, "utf8");
    const func = await this.compileCode(source, resolvedPath);
    this.compiledCache.set(resolvedPath, func);

    if (this.watcher) {
      this.watcher.add(resolvedPath);
    }

    return func;
  }

  public async compileCode(code: string, filepath: string = "eval"): Promise<Function> {
    const optimizerCtx: OptimizerContext = {
      enabledExtensions: new Set(this.extensions.keys()),
      constants: this.constants,
    };

    const transpilation = this.transpiler.transpile(code, filepath, {
      engineSHA1: this.getConfigurationSHA1(),
      cacheDir: this.cacheDir,
      optimizerCtx,
    });

    // Load compiled JS into Function wrapper
    const moduleObj = { exports: {} as any };
    const factory = new Function("module", "exports", "require", transpilation.code);
    factory(moduleObj, moduleObj.exports, require);

    return moduleObj.exports;
  }

  public createContext(options: PHPContextOptions = {}): PHPContext {
    return new PHPContext(this, options);
  }

  private initWatcher(): void {
    this.watcher = chokidar.watch([], { ignoreInitial: true });
    this.watcher.on("change", (changedPath) => {
      const resolved = path.resolve(changedPath);
      this.compiledCache.delete(resolved);
    });
  }

  public close(): void {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
