import * as fs from "fs/promises";
import * as syncFs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { PHPExtension } from "./PHPExtension.js";
import { PHPContext, PHPContextOptions } from "./PHPContext.js";
import { JSTranspiler } from "./parser/JSTranspiler.js";
import { PHPClass, PHPObject } from "./runtime/PHPObject.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./runtime/PHPVariable.js";

import vm from "vm";

import { StringRuntime } from "./runtime/Strings.js";
import { ArrayRuntime } from "./runtime/Arrays.js";
import { FileSystemRuntime } from "./runtime/FileSystem.js";
import { NetworkingRuntime } from "./runtime/Networking.js";
import { MathRuntime } from "./runtime/Math.js";
import { VariablesRuntime } from "./runtime/Variables.js";
import { DateTimeRuntime } from "./runtime/DateTime.js";
import { StreamRuntime } from "./runtime/Streams.js";
import { ExecRuntime } from "./runtime/Exec.js";
import { FiberRuntime } from "./runtime/Fiber.js";
import { EnumRuntime } from "./runtime/Enum.js";
import { ErrorRuntime, PHPFatalError, PHPExit } from "./runtime/PHPError.js";
import { ReflectionRuntime } from "./runtime/Reflection.js";
import { OutputBufferRuntime } from "./runtime/OutputBuffer.js";

import { MySQLiExtension } from "./extensions/mysqli.js";
import { PDOExtension } from "./extensions/pdo.js";
import { GDExtension } from "./extensions/gd.js";
import { PCREExtension } from "./extensions/pcre.js";
import { MbstringExtension } from "./extensions/mbstring.js";
import { JSONExtension } from "./extensions/json.js";
import { CurlExtension } from "./extensions/curl.js";
import { SessionExtension } from "./extensions/session.js";
import { XMLExtension } from "./extensions/xml.js";
import { SPLExtension } from "./extensions/spl.js";
import { HashExtension } from "./extensions/hash.js";
import { OpenSSLExtension } from "./extensions/openssl.js";
import { CoreRuntime } from "./runtime/CoreRuntime.js";

export type PHPFunction = (ctx: PHPContext, ...args: PHPReference[]) => any;

export interface PHPEngineOptions {
  extensions?: PHPExtension[];
  constants?: Record<string, any>;
  functions?: Record<string, PHPFunction>;
  classes?: Record<string, any>;
  cacheDir?: string | null;
  watch?: boolean;
}

export class PHPEngine {
  public static readonly REVISION = 280;
  public static readonly VERSION = "8.5.0";

  public static readonly TRUE = new PHPLiteral(true);
  public static readonly FALSE = new PHPLiteral(false);
  public static readonly NULL = new PHPLiteral(null);

  public extensions: Map<string, PHPExtension> = new Map();
  public constants: Record<string, any> = {};
  public functions: Record<string, PHPFunction> = {};
  public classes: Record<string, any> = {};
  public internalVars: Record<string, any> = {};
  private classResolvers: Array<(ctx: PHPContext, className: string) => any> = [];
  private resolvingClasses = new Map<PHPContext, Set<string>>();
  private compiledCache: Map<string, Function> = new Map();
  private watcher?: chokidar.FSWatcher;
  private transpiler: JSTranspiler;
  private cacheDir?: string | null;

  private static coreConstants: Record<string, any> = {
    php_version: PHPEngine.VERSION,
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
    case_lower: 0,
    case_upper: 1,
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

    if (options.functions) {
      this.registerFunctions(options.functions);
    }

    if (options.classes) {
      for (const [key, value] of Object.entries(options.classes)) {
        this.classes[key.toLowerCase()] = value;
      }
    }

    this.registerRuntimeImplementations();

    // Default extensions list if not explicitly provided
    const defaultExtensions: PHPExtension[] = [
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
      ...(options.extensions || []),
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
    this.functions[name] = fn as PHPFunction;
  }

  /**
   * Registers multiple functions using Object.assign. All keys must be provided in lowercase.
   */
  public registerFunctions(functions: Record<string, PHPFunction>): void {
    Object.assign(this.functions, functions)
  }

  public registerConstant(name: string, value: any): void {
    this.constants[name] = value;
  }

  public registerConstants(constants: Record<string, any>): void {
    Object.assign(this.constants, constants)
  }

  public registerClass(name: string, value: any): void {
    this.classes[name] = value;
  }

  public registerClasses(classes: Record<string, any>): void {
    Object.assign(this.classes, classes)
  }

  /**
   * Registers a class resolver callback. Resolver should handle lowercase class names.
   */
  public registerClassResolver(resolver: (ctx: PHPContext, className: string) => any): void {
    this.classResolvers.push(resolver);
  }

  /**
   * Resolves a class by name using registered class resolvers.
   */
  public async resolveClass(name: string, originalName: string, ctx: PHPContext): Promise<any> {
    const orig = originalName || name;
    const shortName = String(orig).split("\\").pop() || String(orig);
    const shortLower = String(name).split("\\").pop() || String(name);

    // the context classes uses the engine classes as it's prototype so there's no need to check the engine classes
    let resolved = ctx.classes[name] || ctx.classes[shortLower];
    if (resolved) return resolved;

    let resolvingClasses = this.resolvingClasses.get(ctx);
    if (!resolvingClasses) {
      resolvingClasses = new Set();
      this.resolvingClasses.set(ctx, resolvingClasses);
    }
    if (resolvingClasses.has(name)) return undefined;
    resolvingClasses.add(name);

    try {
      for (const resolver of this.classResolvers) {
        await resolver(ctx, orig);
        resolved = ctx.classes[name] || ctx.classes[shortLower];
        if (resolved) return resolved;
      }
    } finally {
      resolvingClasses.delete(name);
    }
    return undefined;
  }

  private registerRuntimeImplementations(): void {
    CoreRuntime.register(this);
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
    const sortedExts = Array.from(this.extensions.keys())
      .sort()
      .map((k) => `${k}@${this.extensions.get(k)?.version || PHPEngine.VERSION}`)
      .join(",");
    const sortedConsts = Object.entries(this.constants)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join(";");
    const sortedFuncs = Object.keys(this.functions).sort().join(",");
    const sortedClasses = Object.keys(this.classes).sort().join(",");
    return crypto.createHash("sha1").update(`v${PHPEngine.REVISION}|${sortedExts}|${sortedConsts}|${sortedFuncs}|${sortedClasses}`).digest("hex");
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

    const moduleObj = { exports: {} as any };
    try {
      const factory = new Function("module", "exports", "PHPClass", "PHPObject", "PHPVariable", "PHPLiteral", "PHPFatalError", transpilation.code);
      factory(moduleObj, moduleObj.exports, PHPClass, PHPObject, PHPVariable, PHPLiteral, PHPFatalError);
      return moduleObj.exports;
    } catch (err: any) {
      if (err.name === "SyntaxError") {
        try {
          new vm.Script(transpilation.code);
        } catch (scriptErr: any) {
          console.error(`SYNTAX_ERR in ${filepath}: ${scriptErr.message}\nSTACK:\n${scriptErr.stack}`);
          const codeLines = transpilation.code.split("\n");
          const match = (scriptErr.stack || "").match(/evalmachine\.<anonymous>:(\d+)/);
          if (match) {
            const lineNum = parseInt(match[1], 10);
            console.error(`EXACT_ERROR_LINE ${lineNum}: ${codeLines[lineNum - 1]}`);
          }
        }
      }
      throw err;
    }
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
