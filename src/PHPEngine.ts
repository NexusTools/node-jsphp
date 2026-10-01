import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { PHPExtension } from "./PHPExtension";
import { PHPContext, PHPContextOptions } from "./PHPContext";
import { JSTranspiler } from "./parser/JSTranspiler";
import { PHPClass } from "./runtime/PHPObject";

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
  public constants: Record<string, any> = {};
  public functions: Record<string, Function> = {};
  public classes: Record<string, any> = {};
  public internalVars: Record<string, any> = {};
  private classResolvers: Array<(ctx: PHPContext, className: string) => any> = [];
  private resolvingClasses = new WeakMap<PHPContext, Set<string>>();
  private compiledCache: Map<string, Function> = new Map();
  private watcher?: chokidar.FSWatcher;
  private transpiler: JSTranspiler;
  private cacheDir?: string | null;

  private static coreConstants: Record<string, any> = {
    php_version: "8.5.0",
    php_engine: "jsphp",
    php_os: process.platform === "win32" ? "WINNT" : "Linux",
    directory_separator: path.sep,
    path_separator: process.platform === "win32" ? ";" : ":",
    e_error: 1,
    e_warning: 2,
    e_parse: 4,
    e_notice: 8,
    e_core_error: 16,
    e_core_warning: 32,
    e_compile_error: 64,
    e_compile_warning: 128,
    e_user_error: 256,
    e_user_warning: 512,
    e_user_notice: 1024,
    e_strict: 2048,
    e_recoverable_error: 4096,
    e_deprecated: 8192,
    e_user_deprecated: 16384,
    e_all: 32767,
  };

  constructor(options: PHPEngineOptions = {}) {
    this.transpiler = new JSTranspiler();
    this.cacheDir = options.cacheDir === null
      ? null
      : (options.cacheDir || process.env.JSPHP_CACHE || path.join(os.tmpdir(), "jsphp_cache"));

    // Set core PHP constants
    Object.assign(this.constants, PHPEngine.coreConstants);

    if (options.constants) {
      Object.assign(this.constants, options.constants);
    }

    this.registerFunctions(PHPEngine.coreFunctions);
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

  /**
   * Gets an internal variable value. The `name` parameter must be provided in lowercase.
   */
  public getInternalVar(name: string): any {
    return this.internalVars[name];
  }

  /**
   * Sets an internal variable value. The `name` parameter must be provided in lowercase.
   */
  public setInternalVar(name: string, value: any): void {
    this.internalVars[name] = value;
  }

  /**
   * Registers a function. The `name` parameter must be provided in lowercase.
   */
  public registerFunction(name: string, fn: Function): void {
    this.functions[name] = fn;
  }

  /**
   * Registers multiple functions using Object.assign. All keys must be provided in lowercase.
   */
  public registerFunctions(functions: Record<string, Function>): void {
    for (const [key, fn] of Object.entries(functions)) {
      this.functions[key.toLowerCase()] = fn;
    }
  }

  public registerConstant(name: string, value: any): void {
    const lower = name.toLowerCase();
    this.constants[lower] = value;
    this.constants[name] = value;
  }

  public registerConstants(constants: Record<string, any>): void {
    for (const [key, value] of Object.entries(constants)) {
      this.constants[key.toLowerCase()] = value;
      this.constants[key] = value;
    }
  }

  public registerClass(name: string, value: any): void {
    this.classes[name.toLowerCase()] = value;
  }

  public registerClasses(classes: Record<string, any>): void {
    for (const [key, cls] of Object.entries(classes)) {
      this.classes[key.toLowerCase()] = cls;
    }
  }

  /**
   * Registers a class resolver callback. Resolver should handle lowercase class names.
   */
  public registerClassResolver(resolver: (ctx: PHPContext, className: string) => any): void {
    this.classResolvers.push(resolver);
  }

  /**
   * Resolves a class by name. The `name` parameter must be provided in lowercase.
   */
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
        const resolved = this.classes[resolutionKey] || this.classes[shortName];
        if (resolved) return resolved;
      }
      const resolved = this.classes[resolutionKey] || this.classes[shortName];
      if (resolved) return resolved;
      return undefined;
    } finally {
      resolvingClasses.delete(resolutionKey);
    }
  }

  /**
   * Gets a constant value by name. The `name` parameter must be provided in lowercase or exact casing.
   */
  public getConstant(name: string): any {
    return this.constants[name];
  }

  private static coreFunctions = {
    "exit": (ctx: PHPContext, status: any = 0) => { throw new PHPExit(typeof status === "number" ? status : (!isNaN(Number(status)) ? Number(status) : status)); },
    "die": (ctx: PHPContext, status: any = 0) => { throw new PHPExit(typeof status === "number" ? status : (!isNaN(Number(status)) ? Number(status) : status)); },
    "call_user_func": async (ctx: PHPContext, callback: any, ...args: any[]) => {
      if (!callback) return undefined;
      if (typeof callback === "function") return await callback.apply(ctx, args);
      if (typeof callback === "string") return await ctx.callFunction(callback.toLowerCase(), args);
      if (Array.isArray(callback) && callback.length === 2) return await ctx.callMethod(callback[0], String(callback[1] ?? "").toLowerCase(), args);
      return undefined;
    },
    "call_user_func_array": async (ctx: PHPContext, callback: any, args: any[] = []) => {
      const arrArgs = Array.isArray(args) ? args : Object.values(args || {});
      if (!callback) return undefined;
      if (typeof callback === "function") return await callback.apply(ctx, arrArgs);
      if (typeof callback === "string") return await ctx.callFunction(callback.toLowerCase(), arrArgs);
      if (Array.isArray(callback) && callback.length === 2) return await ctx.callMethod(callback[0], String(callback[1] ?? "").toLowerCase(), arrArgs);
      return undefined;
    },
    "define": async (ctx: PHPContext, name: string, value: any) => {
      const lower = String(name ?? "").toLowerCase();
      if (ctx.hasConstant(lower)) {
        await ctx.triggerError(`Constant ${name} already defined`, 2);
        return false;
      }
      ctx.defineConstant(lower, value);
      return true;
    },
    "defined": (ctx: PHPContext, name: string) => ctx.hasConstant(String(name ?? "").toLowerCase()),
    "extension_loaded": (ctx: PHPContext, name: string) => Boolean(name && typeof name === "string" && ctx.engine.extensions.has(name.toLowerCase())),
    "function_exists": (ctx: PHPContext, name: string) => Boolean(name && typeof name === "string" && (name.toLowerCase() in ctx.functions)),
    "class_exists": (ctx: PHPContext, name: string) => Boolean(name && typeof name === "string" && (name.toLowerCase() in ctx.classes)),
    "constant": (ctx: PHPContext, name: string) => ctx.getConstant(String(name ?? "").toLowerCase()),
    "assert": (ctx: PHPContext, assertion: any, description?: string) => {
      if (!assertion) {
        if (description) throw new PHPFatalError(`Assertion failed: ${description}`);
        return false;
      }
      return true;
    },
    "is_callable": (ctx: PHPContext, v: any) => {
      if (typeof v === "function") return true;
      if (typeof v === "string") return (v.toLowerCase() in ctx.functions);
      if (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string") {
        const cls = ctx.classes[v[0].toLowerCase()];
        return Boolean(cls && cls.methods && (cls.methods.has ? cls.methods.has(v[1].toLowerCase()) : (v[1].toLowerCase() in cls.methods)));
      }
      return false;
    },
    "ini_get": (ctx: PHPContext, option: string) => {
      const opt = (option || "").toLowerCase();
      if (opt === "display_errors") return "1";
      if (opt === "memory_limit") return "512M";
      if (opt === "max_execution_time") return "30";
      if (opt === "post_max_size") return "64M";
      if (opt === "upload_max_filesize") return "64M";
      if (opt === "date.timezone") return "UTC";
      return "";
    },
    "ini_set": (ctx: PHPContext, option: string, value: any) => "",
    "register_shutdown_function": (ctx: PHPContext, callback: any, ...args: any[]) => {
      ctx.setInternalVar("shutdownFunctions", [...(ctx.getInternalVar("shutdownFunctions") || []), { callback, args }]);
      return true;
    },
    "register_tick_function": (ctx: PHPContext, callback: any, ...args: any[]) => true,
    "unregister_tick_function": (ctx: PHPContext, callback: any) => true,
  };

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

    if (extension.constants) this.registerConstants(extension.constants);
    if (extension.functions) this.registerFunctions(extension.functions);
    if (extension.classes) this.registerClasses(extension.classes);
  }

  public getConfigurationSHA1(): string {
    const sortedExts = Array.from(this.extensions.keys()).sort().join(",");
    const sortedConsts = Object.entries(this.constants)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join(";");
    return crypto.createHash("sha1").update(`v26|${sortedExts}|${sortedConsts}`).digest("hex");
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
      cacheDir: filepath === "eval" ? undefined : (this.cacheDir || undefined),
      engine: this,
    });

    // Load compiled JS into Function wrapper with PHPClass in scope
    const moduleObj = { exports: {} as any };
    const factory = new Function("module", "exports", "require", "PHPClass", transpilation.code);
    factory(moduleObj, moduleObj.exports, require, PHPClass);

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
