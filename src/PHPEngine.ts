import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { PHPExtension } from "./PHPExtension";
import { PHPContext, PHPContextOptions } from "./PHPContext";
import { JSTranspiler } from "./parser/JSTranspiler";

import { StringRuntime } from "./runtime/strings/Strings";
import { ArrayRuntime } from "./runtime/arrays/Arrays";
import { FileSystemRuntime } from "./runtime/fs/FileSystem";
import { NetworkingRuntime } from "./runtime/net/Networking";
import { MathRuntime } from "./runtime/math/Math";
import { VariablesRuntime } from "./runtime/variables/Variables";
import { DateTimeRuntime, PHPDateTime } from "./runtime/datetime/DateTime";
import { StreamRuntime, PHPStreamContext } from "./runtime/streams/Streams";
import { ExecRuntime } from "./runtime/exec/Exec";
import { PHPFiber, PHPFiberError, PHPFiberExit } from "./runtime/fibers/Fiber";
import { PHPEnum } from "./runtime/enums/Enum";
import { ErrorException } from "./runtime/errors/PHPError";
import {
  ReflectionClass,
  ReflectionMethod,
  ReflectionProperty,
  ReflectionFunction,
  ReflectionParameter,
  ReflectionType,
  defineFunction,
} from "./runtime/reflection/Reflection";

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
  public internalVars: Map<string, any> = new Map();
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

  public getConstant(name: string): any {
    if (this.constants.has(name)) return this.constants.get(name);
    if (this.constants.has(name.toUpperCase())) return this.constants.get(name.toUpperCase());
    if (this.constants.has(name.toLowerCase())) return this.constants.get(name.toLowerCase());
    return undefined;
  }

  private registerCoreFunctions(): void {
    // Core definition & state
    this.functions.set("define", (ctx: PHPContext, name: string, value: any) => {
      this.constants.set(name, value);
      return true;
    });
    this.functions.set("defined", (ctx: PHPContext, name: string) => {
      return this.constants.has(name) || this.constants.has(name.toUpperCase());
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
      return this.getConstant(name);
    });

    // Error handling
    this.functions.set("set_error_handler", (ctx: PHPContext, handler: any, levels = 32767) => {
      return ctx.setErrorHandler(handler, levels);
    });
    this.functions.set("restore_error_handler", (ctx: PHPContext) => {
      return ctx.restoreErrorHandler();
    });
    this.functions.set("trigger_error", async (ctx: PHPContext, message: string, level = 1024) => {
      return await ctx.triggerError(message, level);
    });
    this.functions.set("user_error", async (ctx: PHPContext, message: string, level = 1024) => {
      return await ctx.triggerError(message, level);
    });
    this.functions.set("error_reporting", (ctx: PHPContext, level?: number) => {
      const prev = ctx.errorReportingLevel;
      if (level !== undefined) {
        ctx.errorReportingLevel = level;
      }
      return prev;
    });

    // Output buffering & flush
    this.functions.set("flush", (ctx: PHPContext) => {
      ctx.flushHeaders();
      return true;
    });
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
    this.functions.set("stripos", (ctx: PHPContext, haystack: string, needle: string, offset = 0) => StringRuntime.stripos(haystack, needle, offset));
    this.functions.set("strrpos", (ctx: PHPContext, haystack: string, needle: string, offset = 0) => StringRuntime.strrpos(haystack, needle, offset));
    this.functions.set("strripos", (ctx: PHPContext, haystack: string, needle: string, offset = 0) => StringRuntime.strripos(haystack, needle, offset));
    this.functions.set("strstr", (ctx: PHPContext, haystack: string, needle: string, before = false) => StringRuntime.strstr(haystack, needle, before));
    this.functions.set("str_replace", (ctx: PHPContext, search: any, replace: any, subject: any) => StringRuntime.str_replace(search, replace, subject));
    this.functions.set("str_ireplace", (ctx: PHPContext, search: any, replace: any, subject: any) => StringRuntime.str_ireplace(search, replace, subject));
    this.functions.set("explode", (ctx: PHPContext, delim: string, str: string, limit?: number) => StringRuntime.explode(delim, str, limit));
    this.functions.set("implode", (ctx: PHPContext, glue: string, pieces: any[]) => StringRuntime.implode(glue, pieces));
    this.functions.set("trim", (ctx: PHPContext, str: string, chars?: string) => StringRuntime.trim(str, chars));
    this.functions.set("ltrim", (ctx: PHPContext, str: string, chars?: string) => StringRuntime.ltrim(str, chars));
    this.functions.set("rtrim", (ctx: PHPContext, str: string, chars?: string) => StringRuntime.rtrim(str, chars));
    this.functions.set("strtolower", (ctx: PHPContext, str: string) => StringRuntime.strtolower(str));
    this.functions.set("strtoupper", (ctx: PHPContext, str: string) => StringRuntime.strtoupper(str));
    this.functions.set("ucfirst", (ctx: PHPContext, str: string) => StringRuntime.ucfirst(str));
    this.functions.set("lcfirst", (ctx: PHPContext, str: string) => StringRuntime.lcfirst(str));
    this.functions.set("ucwords", (ctx: PHPContext, str: string) => StringRuntime.ucwords(str));
    this.functions.set("strcmp", (ctx: PHPContext, s1: string, s2: string) => StringRuntime.strcmp(s1, s2));
    this.functions.set("addslashes", (ctx: PHPContext, str: string) => StringRuntime.addslashes(str));
    this.functions.set("stripslashes", (ctx: PHPContext, str: string) => StringRuntime.stripslashes(str));
    this.functions.set("htmlspecialchars", (ctx: PHPContext, str: string) => StringRuntime.htmlspecialchars(str));
    this.functions.set("htmlspecialchars_decode", (ctx: PHPContext, str: string) => StringRuntime.htmlspecialchars_decode(str));
    this.functions.set("nl2br", (ctx: PHPContext, str: string, xhtml = true) => StringRuntime.nl2br(str, xhtml));
    this.functions.set("str_repeat", (ctx: PHPContext, str: string, mult: number) => StringRuntime.str_repeat(str, mult));
    this.functions.set("str_pad", (ctx: PHPContext, str: string, len: number, pad = " ", type = 1) => StringRuntime.str_pad(str, len, pad, type));
    this.functions.set("str_split", (ctx: PHPContext, str: string, len = 1) => StringRuntime.str_split(str, len));
    this.functions.set("strrev", (ctx: PHPContext, str: string) => StringRuntime.strrev(str));
    this.functions.set("chr", (ctx: PHPContext, ascii: number) => StringRuntime.chr(ascii));
    this.functions.set("ord", (ctx: PHPContext, char: string) => StringRuntime.ord(char));
    this.functions.set("bin2hex", (ctx: PHPContext, str: string) => StringRuntime.bin2hex(str));
    this.functions.set("hex2bin", (ctx: PHPContext, str: string) => StringRuntime.hex2bin(str));

    // Arrays
    this.functions.set("count", (ctx: PHPContext, arr: any) => ArrayRuntime.count(arr));
    this.functions.set("sizeof", (ctx: PHPContext, arr: any) => ArrayRuntime.count(arr));
    this.functions.set("array_keys", (ctx: PHPContext, arr: any) => ArrayRuntime.array_keys(arr));
    this.functions.set("array_values", (ctx: PHPContext, arr: any) => ArrayRuntime.array_values(arr));
    this.functions.set("array_flip", (ctx: PHPContext, arr: any) => ArrayRuntime.array_flip(arr));
    this.functions.set("array_reverse", (ctx: PHPContext, arr: any) => ArrayRuntime.array_reverse(arr));
    this.functions.set("in_array", (ctx: PHPContext, needle: any, haystack: any, strict = false) => ArrayRuntime.in_array(needle, haystack, strict));
    this.functions.set("array_search", (ctx: PHPContext, needle: any, haystack: any, strict = false) => ArrayRuntime.array_search(needle, haystack, strict));
    this.functions.set("array_key_exists", (ctx: PHPContext, key: any, arr: any) => ArrayRuntime.array_key_exists(key, arr));
    this.functions.set("key_exists", (ctx: PHPContext, key: any, arr: any) => ArrayRuntime.array_key_exists(key, arr));
    this.functions.set("array_merge", (ctx: PHPContext, ...arrays: any[]) => ArrayRuntime.array_merge(...arrays));
    this.functions.set("array_combine", (ctx: PHPContext, keys: any[], values: any[]) => ArrayRuntime.array_combine(keys, values));
    this.functions.set("array_slice", (ctx: PHPContext, arr: any[], off: number, len?: number) => ArrayRuntime.array_slice(arr, off, len));
    this.functions.set("array_push", (ctx: PHPContext, arr: any[], ...v: any[]) => ArrayRuntime.array_push(arr, ...v));
    this.functions.set("array_pop", (ctx: PHPContext, arr: any[]) => ArrayRuntime.array_pop(arr));
    this.functions.set("array_shift", (ctx: PHPContext, arr: any[]) => ArrayRuntime.array_shift(arr));
    this.functions.set("array_unshift", (ctx: PHPContext, arr: any[], ...v: any[]) => ArrayRuntime.array_unshift(arr, ...v));
    this.functions.set("array_unique", (ctx: PHPContext, arr: any[]) => ArrayRuntime.array_unique(arr));
    this.functions.set("array_column", (ctx: PHPContext, arr: any[], col: any) => ArrayRuntime.array_column(arr, col));
    this.functions.set("sort", (ctx: PHPContext, arr: any[]) => ArrayRuntime.sort(arr));
    this.functions.set("rsort", (ctx: PHPContext, arr: any[]) => ArrayRuntime.rsort(arr));

    // File system (all async)
    this.functions.set("file_get_contents", async (ctx: PHPContext, path: string) => await FileSystemRuntime.file_get_contents(path));
    this.functions.set("file_put_contents", async (ctx: PHPContext, path: string, data: any, flags = 0) => await FileSystemRuntime.file_put_contents(path, data, flags));
    this.functions.set("file_exists", async (ctx: PHPContext, path: string) => await FileSystemRuntime.file_exists(path));
    this.functions.set("is_dir", async (ctx: PHPContext, path: string) => await FileSystemRuntime.is_dir(path));
    this.functions.set("is_file", async (ctx: PHPContext, path: string) => await FileSystemRuntime.is_file(path));
    this.functions.set("is_readable", async (ctx: PHPContext, path: string) => await FileSystemRuntime.is_readable(path));
    this.functions.set("is_writable", async (ctx: PHPContext, path: string) => await FileSystemRuntime.is_writable(path));
    this.functions.set("filesize", async (ctx: PHPContext, path: string) => await FileSystemRuntime.filesize(path));
    this.functions.set("filemtime", async (ctx: PHPContext, path: string) => await FileSystemRuntime.filemtime(path));
    this.functions.set("realpath", async (ctx: PHPContext, path: string) => await FileSystemRuntime.realpath(path));
    this.functions.set("basename", (ctx: PHPContext, path: string, suf?: string) => FileSystemRuntime.basename(path, suf));
    this.functions.set("dirname", (ctx: PHPContext, path: string) => FileSystemRuntime.dirname(path));
    this.functions.set("pathinfo", (ctx: PHPContext, path: string, flags = 15) => FileSystemRuntime.pathinfo(path, flags));
    this.functions.set("mkdir", async (ctx: PHPContext, path: string, mode = 0o777, rec = false) => await FileSystemRuntime.mkdir(path, mode, rec));
    this.functions.set("rmdir", async (ctx: PHPContext, path: string) => await FileSystemRuntime.rmdir(path));
    this.functions.set("unlink", async (ctx: PHPContext, path: string) => await FileSystemRuntime.unlink(path));
    this.functions.set("rename", async (ctx: PHPContext, oldn: string, newn: string) => await FileSystemRuntime.rename(oldn, newn));
    this.functions.set("copy", async (ctx: PHPContext, src: string, dest: string) => await FileSystemRuntime.copy(src, dest));
    this.functions.set("tempnam", async (ctx: PHPContext, dir: string, pfx: string) => await FileSystemRuntime.tempnam(dir, pfx));
    this.functions.set("sys_get_temp_dir", () => FileSystemRuntime.sys_get_temp_dir());
    this.functions.set("scandir", async (ctx: PHPContext, path: string) => await FileSystemRuntime.scandir(path));

    // Networking & Headers
    this.functions.set("gethostname", () => NetworkingRuntime.gethostname());
    this.functions.set("gethostbyname", async (ctx: PHPContext, name: string) => await NetworkingRuntime.gethostbyname(name));
    this.functions.set("gethostbyaddr", async (ctx: PHPContext, ip: string) => await NetworkingRuntime.gethostbyaddr(ip));
    this.functions.set("ip2long", (ctx: PHPContext, ip: string) => NetworkingRuntime.ip2long(ip));
    this.functions.set("long2ip", (ctx: PHPContext, num: number) => NetworkingRuntime.long2ip(num));
    this.functions.set("parse_url", (ctx: PHPContext, url: string, comp = -1) => NetworkingRuntime.parse_url(url, comp));
    this.functions.set("http_build_query", (ctx: PHPContext, data: any, prefix = "", sep = "&") => NetworkingRuntime.http_build_query(data, prefix, sep));
    this.functions.set("header", (ctx: PHPContext, headerStr: string, replace = true, code?: number) => NetworkingRuntime.header(ctx, headerStr, replace, code));
    this.functions.set("setcookie", (ctx: PHPContext, name: string, val = "", exp = 0, p = "", d = "", sec = false, httpOnly = false) => NetworkingRuntime.setcookie(ctx, name, val, exp, p, d, sec, httpOnly));
    this.functions.set("setrawcookie", (ctx: PHPContext, name: string, val = "", exp = 0, p = "", d = "", sec = false, httpOnly = false) => NetworkingRuntime.setrawcookie(ctx, name, val, exp, p, d, sec, httpOnly));
    this.functions.set("header_remove", (ctx: PHPContext, name?: string) => NetworkingRuntime.header_remove(ctx, name));
    this.functions.set("headers_list", (ctx: PHPContext) => NetworkingRuntime.headers_list(ctx));
    this.functions.set("headers_sent", (ctx: PHPContext) => NetworkingRuntime.headers_sent(ctx));
    this.functions.set("http_response_code", (ctx: PHPContext, code?: number) => NetworkingRuntime.http_response_code(ctx, code));

    // Math
    this.functions.set("abs", (ctx: PHPContext, n: number) => MathRuntime.abs(n));
    this.functions.set("ceil", (ctx: PHPContext, n: number) => MathRuntime.ceil(n));
    this.functions.set("floor", (ctx: PHPContext, n: number) => MathRuntime.floor(n));
    this.functions.set("round", (ctx: PHPContext, n: number, p = 0) => MathRuntime.round(n, p));
    this.functions.set("max", (ctx: PHPContext, ...args: any[]) => MathRuntime.max(...args));
    this.functions.set("min", (ctx: PHPContext, ...args: any[]) => MathRuntime.min(...args));
    this.functions.set("pow", (ctx: PHPContext, b: number, e: number) => MathRuntime.pow(b, e));
    this.functions.set("sqrt", (ctx: PHPContext, n: number) => MathRuntime.sqrt(n));
    this.functions.set("rand", (ctx: PHPContext, min = 0, max = 2147483647) => MathRuntime.rand(min, max));
    this.functions.set("mt_rand", (ctx: PHPContext, min = 0, max = 2147483647) => MathRuntime.mt_rand(min, max));

    // Variables & Types
    this.functions.set("var_dump", (ctx: PHPContext, ...args: any[]) => VariablesRuntime.var_dump(ctx, ...args));
    this.functions.set("print_r", (ctx: PHPContext, val: any, ret = false) => VariablesRuntime.print_r(ctx, val, ret));
    this.functions.set("is_array", (ctx: PHPContext, v: any) => VariablesRuntime.is_array(v));
    this.functions.set("is_bool", (ctx: PHPContext, v: any) => VariablesRuntime.is_bool(v));
    this.functions.set("is_float", (ctx: PHPContext, v: any) => VariablesRuntime.is_float(v));
    this.functions.set("is_int", (ctx: PHPContext, v: any) => VariablesRuntime.is_int(v));
    this.functions.set("is_null", (ctx: PHPContext, v: any) => VariablesRuntime.is_null(v));
    this.functions.set("is_numeric", (ctx: PHPContext, v: any) => VariablesRuntime.is_numeric(v));
    this.functions.set("is_object", (ctx: PHPContext, v: any) => VariablesRuntime.is_object(v));
    this.functions.set("is_scalar", (ctx: PHPContext, v: any) => VariablesRuntime.is_scalar(v));
    this.functions.set("is_string", (ctx: PHPContext, v: any) => VariablesRuntime.is_string(v));
    this.functions.set("gettype", (ctx: PHPContext, v: any) => VariablesRuntime.gettype(v));
    this.functions.set("intval", (ctx: PHPContext, v: any, b = 10) => VariablesRuntime.intval(v, b));
    this.functions.set("floatval", (ctx: PHPContext, v: any) => VariablesRuntime.floatval(v));
    this.functions.set("strval", (ctx: PHPContext, v: any) => VariablesRuntime.strval(v));
    this.functions.set("boolval", (ctx: PHPContext, v: any) => VariablesRuntime.boolval(v));

    // Streams & Exec
    this.functions.set("stream_context_create", (ctx: PHPContext, opts = {}) => StreamRuntime.stream_context_create(opts));
    this.functions.set("stream_get_contents", async (ctx: PHPContext, stream: any, max = -1, off = -1) => await StreamRuntime.stream_get_contents(stream, max, off));
    this.functions.set("stream_get_wrappers", () => StreamRuntime.stream_get_wrappers());
    this.functions.set("stream_is_local", (ctx: PHPContext, stream: any) => StreamRuntime.stream_is_local(stream));
    this.functions.set("exec", async (ctx: PHPContext, cmd: string, out?: any[], ret?: any) => await ExecRuntime.exec(ctx, cmd, out, ret));
    this.functions.set("shell_exec", async (ctx: PHPContext, cmd: string) => await ExecRuntime.shell_exec(ctx, cmd));
    this.functions.set("escapeshellarg", (ctx: PHPContext, arg: string) => ExecRuntime.escapeshellarg(arg));
    this.functions.set("escapeshellcmd", (ctx: PHPContext, cmd: string) => ExecRuntime.escapeshellcmd(cmd));

    // DateTime
    this.functions.set("time", () => DateTimeRuntime.time());
    this.functions.set("microtime", (ctx: PHPContext, asFloat = false) => DateTimeRuntime.microtime(asFloat));
    this.functions.set("date", (ctx: PHPContext, fmt: string, ts?: number) => DateTimeRuntime.date(fmt, ts));
    this.functions.set("strtotime", (ctx: PHPContext, timeStr: string, now?: number) => DateTimeRuntime.strtotime(timeStr, now));
    this.functions.set("date_default_timezone_get", () => DateTimeRuntime.date_default_timezone_get());
    this.functions.set("date_default_timezone_set", (ctx: PHPContext, tz: string) => DateTimeRuntime.date_default_timezone_set(tz));

    // Classes
    this.classes.set("datetime", PHPDateTime);
    this.classes.set("reflectionclass", ReflectionClass);
    this.classes.set("reflectionmethod", ReflectionMethod);
    this.classes.set("reflectionproperty", ReflectionProperty);
    this.classes.set("reflectionfunction", ReflectionFunction);
    this.classes.set("reflectionparameter", ReflectionParameter);
    this.classes.set("reflectiontype", ReflectionType);
    this.classes.set("fiber", PHPFiber);
    this.classes.set("enum", PHPEnum);
    this.classes.set("errorexception", ErrorException);
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
    return crypto.createHash("sha1").update(`${sortedExts}|${sortedConsts}`).digest("hex");
  }

  public async compileFile(filepath: string): Promise<Function> {
    const resolvedPath = path.resolve(filepath);
    if (this.compiledCache.has(resolvedPath)) {
      return this.compiledCache.get(resolvedPath)!;
    }

    try {
      const source = await fs.readFile(resolvedPath, "utf8");
      const func = await this.compileCode(source, resolvedPath);
      this.compiledCache.set(resolvedPath, func);

      if (this.watcher) {
        this.watcher.add(resolvedPath);
      }

      return func;
    } catch {
      throw new Error(`PHP file not found: ${resolvedPath}`);
    }
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
