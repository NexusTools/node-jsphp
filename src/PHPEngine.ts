import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { PHPExtension } from "./PHPExtension";
import { PHPContext, PHPContextOptions } from "./PHPContext";
import { JSTranspiler } from "./parser/JSTranspiler";

import { StringRuntime } from "./runtime/Strings";
import { ArrayRuntime } from "./runtime/Arrays";
import { FileSystemRuntime } from "./runtime/FileSystem";
import { NetworkingRuntime } from "./runtime/Networking";
import { MathRuntime } from "./runtime/Math";
import { VariablesRuntime } from "./runtime/Variables";
import { DateTimeRuntime } from "./runtime/DateTime";
import { StreamRuntime } from "./runtime/Streams";
import { ExecRuntime } from "./runtime/Exec";
import { FiberRuntime } from "./runtime/Fiber";
import { EnumRuntime } from "./runtime/Enum";
import { ErrorRuntime, PHPFatalError, PHPExit } from "./runtime/PHPError";
import { ReflectionRuntime } from "./runtime/Reflection";
import { OutputBufferRuntime } from "./runtime/OutputBuffer";

import { MySQLiExtension } from "./extensions/mysqli";
import { PDOExtension } from "./extensions/pdo";
import { GDExtension } from "./extensions/gd";
import { PCREExtension } from "./extensions/pcre";
import { MbstringExtension } from "./extensions/mbstring";
import { JSONExtension } from "./extensions/json";
import { CurlExtension } from "./extensions/curl";
import { SessionExtension } from "./extensions/session";
import { XMLExtension } from "./extensions/xml";
import { SPLExtension } from "./extensions/spl";
import { HashExtension } from "./extensions/hash";
import { OpenSSLExtension } from "./extensions/openssl";

export interface PHPEngineOptions {
  extensions?: PHPExtension[];
  constants?: Record<string, any>;
  cacheDir?: string | null;
  watch?: boolean;
}

export class PHPEngine {
  public extensions: Map<string, PHPExtension> = new Map();
  public constants: Map<string, any> = new Map();
  public functions: Map<string, Function> = new Map();
  public classes: Map<string, any> = new Map();
  public internalVars: Map<string, any> = new Map();
  private classResolvers: Array<(ctx: PHPContext, className: string) => any> = [];
  private resolvingClasses = new WeakMap<PHPContext, Set<string>>();
  private compiledCache: Map<string, Function> = new Map();
  private watcher?: chokidar.FSWatcher;
  private transpiler: JSTranspiler;
  private cacheDir?: string | null;

  constructor(options: PHPEngineOptions = {}) {
    this.transpiler = new JSTranspiler();
    this.cacheDir = options.cacheDir === null
      ? null
      : (options.cacheDir || process.env.JSPHP_CACHE || path.join(os.tmpdir(), "jsphp_cache"));

    // Set core PHP constants
    this.constants.set("PHP_VERSION", "8.5.0");
    this.constants.set("PHP_ENGINE", "jsphp");
    this.constants.set("PHP_OS", process.platform === "win32" ? "WINNT" : "Linux");
    this.constants.set("DIRECTORY_SEPARATOR", path.sep);
    this.constants.set("PATH_SEPARATOR", process.platform === "win32" ? ";" : ":");

    // PHP Error Level Constants
    this.constants.set("E_ERROR", 1);
    this.constants.set("E_WARNING", 2);
    this.constants.set("E_PARSE", 4);
    this.constants.set("E_NOTICE", 8);
    this.constants.set("E_CORE_ERROR", 16);
    this.constants.set("E_CORE_WARNING", 32);
    this.constants.set("E_COMPILE_ERROR", 64);
    this.constants.set("E_COMPILE_WARNING", 128);
    this.constants.set("E_USER_ERROR", 256);
    this.constants.set("E_USER_WARNING", 512);
    this.constants.set("E_USER_NOTICE", 1024);
    this.constants.set("E_STRICT", 2048);
    this.constants.set("E_RECOVERABLE_ERROR", 4096);
    this.constants.set("E_DEPRECATED", 8192);
    this.constants.set("E_USER_DEPRECATED", 16384);
    this.constants.set("E_ALL", 32767);

    if (options.constants) {
      for (const [key, val] of Object.entries(options.constants)) {
        this.constants.set(key, val);
      }
    }

    this.registerCoreFunctions();
    this.registerRuntimeImplementations();

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

  public getInternalVar(name: string): any {
    return this.internalVars.get(name);
  }

  public setInternalVar(name: string, value: any): void {
    this.internalVars.set(name, value);
  }

  public registerFunction(name: string, fn: Function): void {
    this.functions.set(name.toLowerCase(), fn);
  }

  public registerConstant(name: string, value: any): void {
    this.constants.set(name, value);
    this.constants.set(name.toUpperCase(), value);
  }

  public registerClass(name: string, value: any): void {
    this.classes.set(name.toLowerCase(), value);
  }

  public registerClassResolver(resolver: (ctx: PHPContext, className: string) => any): void {
    this.classResolvers.push(resolver);
  }

  public async resolveClass(name: string, ctx: PHPContext): Promise<any> {
    const shortName = String(name).split("\\").pop() || String(name);
    const resolutionKey = String(name).toLowerCase();
    let resolvingClasses = this.resolvingClasses.get(ctx);
    if (!resolvingClasses) {
      resolvingClasses = new Set();
      this.resolvingClasses.set(ctx, resolvingClasses);
    }
    if (resolvingClasses.has(resolutionKey)) return undefined;
    resolvingClasses.add(resolutionKey);
    try {
      for (const resolver of this.classResolvers) {
        await resolver(ctx, name);
        const resolved = this.classes.get(resolutionKey) || this.classes.get(shortName.toLowerCase());
        if (resolved) return resolved;
      }
      const resolved = this.classes.get(resolutionKey) || this.classes.get(shortName.toLowerCase());
      if (resolved) return resolved;
      return undefined;
    } finally {
      resolvingClasses.delete(resolutionKey);
    }
  }

  public getConstant(name: string): any {
    if (!name || typeof name !== "string") return undefined;
    if (this.constants.has(name)) return this.constants.get(name);
    if (this.constants.has(name.toUpperCase())) return this.constants.get(name.toUpperCase());
    if (this.constants.has(name.toLowerCase())) return this.constants.get(name.toLowerCase());
    return undefined;
  }

  private registerCoreFunctions(): void {
    // Core definition & state
    this.functions.set("exit", (ctx: PHPContext, status: any = 0) => {
      throw new PHPExit(status);
    });
    this.functions.set("die", (ctx: PHPContext, status: any = 0) => {
      throw new PHPExit(status);
    });
    this.functions.set("call_user_func", async (ctx: PHPContext, callback: any, ...args: any[]) => {
      if (!callback) return undefined;
      if (typeof callback === "function") {
        return await callback.apply(ctx, args);
      }
      if (typeof callback === "string") {
        return await ctx.callFunction(callback, args);
      }
      if (Array.isArray(callback) && callback.length === 2) {
        return await ctx.callMethod(callback[0], callback[1], args);
      }
      return undefined;
    });
    this.functions.set("call_user_func_array", async (ctx: PHPContext, callback: any, args: any[] = []) => {
      const arrArgs = Array.isArray(args) ? args : Object.values(args || {});
      if (!callback) return undefined;
      if (typeof callback === "function") {
        return await callback.apply(ctx, arrArgs);
      }
      if (typeof callback === "string") {
        return await ctx.callFunction(callback, arrArgs);
      }
      if (Array.isArray(callback) && callback.length === 2) {
        return await ctx.callMethod(callback[0], callback[1], arrArgs);
      }
      return undefined;
    });
    this.functions.set("define", async (ctx: PHPContext, name: string, value: any) => {
      if (ctx.hasConstant(name)) {
        await ctx.triggerError(`Constant ${name} already defined`, 2);
        return false;
      }
      ctx.defineConstant(name, value);
      return true;
    });
    this.functions.set("defined", (ctx: PHPContext, name: string) => {
      return ctx.hasConstant(name);
    });
    this.functions.set("extension_loaded", (ctx: PHPContext, name: string) => {
      if (!name || typeof name !== "string") return false;
      return this.extensions.has(name.toLowerCase());
    });
    this.functions.set("function_exists", (ctx: PHPContext, name: string) => {
      if (!name || typeof name !== "string") return false;
      return this.functions.has(name.toLowerCase());
    });
    this.functions.set("class_exists", (ctx: PHPContext, name: string) => {
      if (!name || typeof name !== "string") return false;
      return this.classes.has(name.toLowerCase());
    });
    this.functions.set("constant", (ctx: PHPContext, name: string) => {
      return ctx.getConstant(name);
    });
    this.functions.set("assert", (ctx: PHPContext, assertion: any, description?: string) => {
      if (!assertion) {
        if (description) {
          throw new PHPFatalError(`Assertion failed: ${description}`);
        }
        return false;
      }
      return true;
    });
    this.functions.set("is_callable", (ctx: PHPContext, v: any) => {
      if (typeof v === "function") return true;
      if (typeof v === "string") return this.functions.has(v.toLowerCase());
      if (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string") {
        const cls = this.classes.get(v[0].toLowerCase());
        return Boolean(cls && cls.methods && cls.methods.has(v[1].toLowerCase()));
      }
      return false;
    });
    this.functions.set("ini_get", (ctx: PHPContext, option: string) => {
      const opt = (option || "").toLowerCase();
      if (opt === "display_errors") return "1";
      if (opt === "memory_limit") return "512M";
      if (opt === "max_execution_time") return "30";
      if (opt === "post_max_size") return "64M";
      if (opt === "upload_max_filesize") return "64M";
      if (opt === "date.timezone") return "UTC";
      return "";
    });
    this.functions.set("ini_set", (ctx: PHPContext, option: string, value: any) => {
      return "";
    });
    this.functions.set("register_shutdown_function", (ctx: PHPContext, callback: any, ...args: any[]) => {
      ctx.setInternalVar("shutdownFunctions", [...(ctx.getInternalVar("shutdownFunctions") || []), { callback, args }]);
      return true;
    });
    this.functions.set("register_tick_function", (ctx: PHPContext, callback: any, ...args: any[]) => {
      return true;
    });
    this.functions.set("unregister_tick_function", (ctx: PHPContext, callback: any) => {
      return true;
    });
  }

  private registerRuntimeImplementations(): void {
    StringRuntime.register(this);
    ArrayRuntime.register(this);
    DateTimeRuntime.register(this);
    FileSystemRuntime.register(this);
    NetworkingRuntime.register(this);
    MathRuntime.register(this);
    VariablesRuntime.register(this);
    StreamRuntime.register(this);
    ExecRuntime.register(this);
    OutputBufferRuntime.register(this);
    ErrorRuntime.register(this);
    ReflectionRuntime.register(this);
    FiberRuntime.register(this);
    EnumRuntime.register(this);
  }

  public registerExtension(extension: PHPExtension): void {
    this.extensions.set(extension.name.toLowerCase(), extension);
    extension.onInit(this);

    for (const [key, val] of Object.entries(extension.constants)) {
      this.constants.set(key, val);
      this.constants.set(key.toUpperCase(), val);
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
    return crypto.createHash("sha1").update(`v19|${sortedExts}|${sortedConsts}`).digest("hex");
  }

  public async compileFile(filepath: string): Promise<Function> {
    const resolvedPath = path.resolve(filepath);
    if (this.compiledCache.has(resolvedPath)) {
      return this.compiledCache.get(resolvedPath)!;
    }

    let source: string;
    try {
      source = await fs.readFile(resolvedPath, "utf8");
    } catch {
      throw new PHPFatalError(`Fatal error: require(${resolvedPath}): Failed opening required '${resolvedPath}'`);
    }

    const func = await this.compileCode(source, resolvedPath);
    this.compiledCache.set(resolvedPath, func);

    if (this.watcher) {
      this.watcher.add(resolvedPath);
    }

    return func;
  }

  public async compileCode(code: string, filepath: string = "eval"): Promise<Function> {
    const transpilation = this.transpiler.transpile(code, filepath, {
      engineSHA1: this.getConfigurationSHA1(),
      cacheDir: filepath === "eval" ? undefined : this.cacheDir,
      engine: this,
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
