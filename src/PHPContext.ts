import * as path from "path";
import * as fs from "fs/promises";
import { Writable } from "stream";
import { PHPEngine } from "./PHPEngine";
import { Superglobals, SuperglobalsOptions } from "./runtime/superglobals/Superglobals";
import { OutputBufferStack } from "./runtime/output/OutputBuffer";
import { PHPError, PHPFatalError, PHPWarning, PHPNotice, PHPExit } from "./runtime/errors/PHPError";
import { PHPObject, PHPClass } from "./runtime/objects/PHPObject";
import { SourceMapRegistry } from "./runtime/errors/SourceMapRegistry";

export interface PHPContextOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdout?: Writable | ((data: string) => void);
  stderr?: Writable | ((data: string) => void);
  superglobals?: SuperglobalsOptions;
  errorReporting?: number;
}

export class PHPResponse {
  public statusCode: number = 200;
  public headers: { name: string; value: string }[] = [];
  public headersSent: boolean = false;

  public setHeader(name: string, value: string, replace = true): void {
    if (this.headersSent) {
      return;
    }
    if (replace) {
      this.headers = this.headers.filter((h) => h.name.toLowerCase() !== name.toLowerCase());
    }
    this.headers.push({ name, value });

    if (name.toLowerCase() === "location" && this.statusCode === 200) {
      this.statusCode = 302;
    }
  }

  public removeHeader(name?: string): void {
    if (this.headersSent) {
      return;
    }
    if (!name) {
      this.headers = [];
      return;
    }
    this.headers = this.headers.filter((h) => h.name.toLowerCase() !== name.toLowerCase());
  }

  public getHeader(name: string): string | undefined {
    const found = this.headers.filter((h) => h.name.toLowerCase() === name.toLowerCase());
    return found.length > 0 ? found[found.length - 1].value : undefined;
  }

  public getHeadersList(): string[] {
    return this.headers.map((h) => `${h.name}: ${h.value}`);
  }

  public setCookie(
    name: string,
    value: string = "",
    expires: number = 0,
    path: string = "",
    domain: string = "",
    secure: boolean = false,
    httponly: boolean = false,
    raw: boolean = false
  ): void {
    if (this.headersSent) {
      return;
    }
    const encodedName = raw ? name : encodeURIComponent(name);
    const encodedValue = raw ? value : encodeURIComponent(value);
    let cookieStr = `${encodedName}=${encodedValue}`;

    if (expires > 0) {
      cookieStr += `; expires=${new Date(expires * 1000).toUTCString()}`;
    }
    if (path) cookieStr += `; path=${path}`;
    if (domain) cookieStr += `; domain=${domain}`;
    if (secure) cookieStr += `; secure`;
    if (httponly) cookieStr += `; HttpOnly`;

    this.setHeader("Set-Cookie", cookieStr, false);
  }
}

export class PHPContext {
  public engine: PHPEngine;
  public cwd: string;
  public env: Record<string, string>;
  public vars: Record<string, any> = {};
  public internalVars: Map<string, any> = new Map();
  public superglobals: Superglobals;
  public outputBuffer: OutputBufferStack;
  public response: PHPResponse;
  public errorHandlerStack: any[] = [];
  public errorReportingLevel: number = 32767; // E_ALL
  public includedFiles: Set<string> = new Set();
  private stdout: Writable | ((data: string) => void);
  private stderr: Writable | ((data: string) => void);
  public outputText: string = "";

  constructor(engine: PHPEngine, options: PHPContextOptions = {}) {
    this.engine = engine;
    this.cwd = options.cwd || process.cwd();
    this.env = options.env || (process.env as Record<string, string>);
    this.stdout = options.stdout || ((data: string) => { this.outputText += data; });
    this.stderr = options.stderr || ((data: string) => { console.error(data); });
    this.superglobals = new Superglobals({ ...options.superglobals, env: this.env });
    this.outputBuffer = new OutputBufferStack();
    this.response = new PHPResponse();
    if (options.errorReporting !== undefined) {
      this.errorReportingLevel = options.errorReporting;
    }
  }

  public isInstanceOf(obj: any, className: string): boolean {
    if (!obj || typeof obj !== "object") return false;
    if (obj instanceof PHPObject) {
      return obj.phpClass.name.toLowerCase() === String(className).toLowerCase();
    }
    const cls = this.engine.classes.get(String(className).toLowerCase());
    if (cls && typeof cls === "function") {
      return obj instanceof cls;
    }
    return false;
  }

  public getPHPBacktrace(): any[] {
    const err = new Error();
    const rawLines = (err.stack || "").split("\n");
    const frames: any[] = [];

    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;

      const matchAnon = line.match(/<anonymous>:(\d+):(\d+)/) || line.match(/<eval>:(\d+):(\d+)/);
      if (matchAnon) {
        const jsLine = parseInt(matchAnon[1], 10);
        const fnMatch = line.match(/(?:__fn_|method_|class_)([a-zA-Z0-9_]+)/);
        let funcHint = fnMatch ? fnMatch[1] : null;

        if (!funcHint) {
          const genericMatch = line.match(/at\s+(?:async\s+)?([a-zA-Z0-9_]+)/);
          if (genericMatch && genericMatch[1] !== "PHPContext" && genericMatch[1] !== "PHPEngine" && genericMatch[1] !== "callFunction" && genericMatch[1] !== "getPHPBacktrace") {
            funcHint = genericMatch[1];
          }
        }

        const loc = SourceMapRegistry.lookup(funcHint, jsLine);
        if (loc) {
          let funcName = loc.function || funcHint || "{main}";
          if (!funcName || funcName === "exports" || funcName === "module" || funcName === "async" || funcName === "at") {
            funcName = "{main}";
          }
          frames.push({
            file: loc.file,
            line: loc.line,
            function: funcName,
          });
          continue;
        }
      }

      const matchPhp = line.match(/\((.*?\.php):(\d+):(\d+)\)/) || line.match(/at\s+(.*?\.php):(\d+):(\d+)/);
      if (matchPhp) {
        frames.push({
          file: matchPhp[1],
          line: parseInt(matchPhp[2], 10),
          function: "{main}",
        });
      }
    }

    return frames;
  }

  public setErrorHandler(handler: any, levels = 32767): any {
    const prev = this.errorHandlerStack.length > 0 ? this.errorHandlerStack[this.errorHandlerStack.length - 1] : null;
    this.errorHandlerStack.push({ handler, levels });
    return prev ? prev.handler : null;
  }

  public restoreErrorHandler(): boolean {
    if (this.errorHandlerStack.length > 0) {
      this.errorHandlerStack.pop();
    }
    return true;
  }

  public async triggerError(message: string, level = 1024, file = "[INTERNAL]", line = 0): Promise<boolean> {
    if ((this.errorReportingLevel & level) === 0) {
      return false; // Suppressed
    }

    if (this.errorHandlerStack.length > 0) {
      const top = this.errorHandlerStack[this.errorHandlerStack.length - 1];
      if ((top.levels & level) !== 0) {
        const handler = top.handler;
        let res: any;
        if (typeof handler === "function") {
          res = await handler(this, level, message, file, line);
        } else if (typeof handler === "string") {
          res = await this.callFunction(handler, [level, message, file, line]);
        }
        if (res !== false) {
          return true; // Handled
        }
      }
    }

    // Default error handling
    if (level === 1 || level === 256 || level === 4 || level === 64) {
      throw new PHPFatalError(`Fatal error: ${message} in ${file} on line ${line}`);
    } else {
      const typeStr = (level === 2 || level === 512) ? "Warning" : "Notice";
      await this.echo(`PHP ${typeStr}: ${message} in ${file} on line ${line}\n`);
      return true;
    }
  }

  public getInternalVar(name: string): any {
    if (this.internalVars.has(name)) {
      return this.internalVars.get(name);
    }
    return this.engine.getInternalVar(name);
  }

  public setInternalVar(name: string, value: any): void {
    this.internalVars.set(name, value);
  }

  public get responseHeaders(): Record<string, string> {
    const res: Record<string, string> = {};
    for (const h of this.response.headers) {
      res[h.name.toLowerCase()] = h.value;
    }
    return res;
  }

  public get statusCode(): number {
    return this.response.statusCode;
  }

  public flushHeaders(): void {
    if (this.response.headersSent) return;
    this.response.headersSent = true;
    const onFlush = this.getInternalVar("onFlushHeaders");
    if (typeof onFlush === "function") {
      onFlush(this.response.statusCode, this.response.headers);
    }
  }

  public async echo(data: any): Promise<void> {
    const str = String(data ?? "");
    if (this.outputBuffer.isActive()) {
      this.outputBuffer.write(str);
    } else {
      if (str.length > 0) {
        this.flushHeaders();
      }
      this.writeStdout(str);
    }
  }

  private writeStdout(str: string): void {
    if (typeof this.stdout === "function") {
      this.stdout(str);
    } else if (this.stdout && typeof this.stdout.write === "function") {
      this.stdout.write(str);
    }
  }

  public getConstant(name: string): any {
    return this.engine.getConstant(name);
  }

  public defineConstant(name: string, val: any): void {
    this.engine.constants.set(name, val);
    this.engine.constants.set(name.toUpperCase(), val);
  }

  public getVar(name: string): any {
    if (name.startsWith("_")) {
      switch (name) {
        case "_GET": return this.superglobals.GET;
        case "_POST": return this.superglobals.POST;
        case "_SERVER": return this.superglobals.SERVER;
        case "_COOKIE": return this.superglobals.COOKIE;
        case "_FILES": return this.superglobals.FILES;
        case "_ENV": return this.superglobals.ENV;
        case "_REQUEST": return this.superglobals.REQUEST;
        case "_SESSION": return this.superglobals.SESSION;
        case "GLOBALS": return this.vars;
      }
    }
    return this.vars[name];
  }

  public setVar(name: string, value: any): void {
    this.vars[name] = value;
  }

  public async getProperty(obj: any, prop: string): Promise<any> {
    if (obj instanceof PHPObject) {
      return await obj.getProperty(this, prop);
    }
    if (obj && typeof obj === "object") {
      return obj[prop];
    }
    return undefined;
  }

  public async setProperty(obj: any, prop: string, value: any): Promise<void> {
    if (obj instanceof PHPObject) {
      await obj.setProperty(this, prop, value);
    } else if (obj && typeof obj === "object") {
      obj[prop] = value;
    }
  }

  public async callMethod(obj: any, method: string, args: any[] = []): Promise<any> {
    if (obj instanceof PHPObject) {
      return await obj.callMethod(this, method, args);
    }
    if (obj && typeof obj[method] === "function") {
      return await obj[method].apply(obj, args);
    }
    return undefined;
  }

  public async callFunction(name: string, args: any[] = []): Promise<any> {
    const fn = this.engine.functions.get(name.toLowerCase());
    if (fn) {
      return await fn.apply(this, [this, ...args]);
    }
    throw new PHPFatalError(`Call to undefined function ${name}()`);
  }

  public async createObject(className: string, args: any[] = []): Promise<any> {
    const rawClass = this.engine.classes.get(className.toLowerCase());
    if (rawClass && typeof rawClass === "function" && !(rawClass.prototype instanceof PHPObject)) {
      return new (rawClass as any)(...args);
    }
    const phpClass = rawClass instanceof PHPClass ? rawClass : new PHPClass(className);
    const obj = new PHPObject(phpClass);
    const __construct = phpClass.methods ? phpClass.methods.get("__construct") : undefined;
    if (__construct?.fn) {
      await __construct.fn.apply(obj, [this, ...args]);
    }
    return obj;
  }

  public async eval(code: string, filepath: string = "eval"): Promise<any> {
    try {
      const compiledFunc = await this.engine.compileCode(code, filepath);
      return await compiledFunc(this);
    } catch (err: any) {
      if (err instanceof PHPExit || err?.name === "PHPExit") {
        return err.status;
      }
      throw err;
    }
  }

  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  public async include(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath)
      ? filepath
      : path.resolve(this.cwd, filepath);
    if (!(await this.fileExists(resolvedPath))) {
      await this.triggerError(`include(${filepath}): Failed to open stream: No such file or directory`, 2);
      return false;
    }
    const compiledFunc = await this.engine.compileFile(resolvedPath);
    return await compiledFunc(this);
  }

  public async includeOnce(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath)
      ? filepath
      : path.resolve(this.cwd, filepath);
    if (this.includedFiles.has(resolvedPath)) {
      return true;
    }
    if (!(await this.fileExists(resolvedPath))) {
      await this.triggerError(`include_once(${filepath}): Failed to open stream: No such file or directory`, 2);
      return false;
    }
    this.includedFiles.add(resolvedPath);
    return await this.include(resolvedPath);
  }

  public async require(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath)
      ? filepath
      : path.resolve(this.cwd, filepath);
    if (!(await this.fileExists(resolvedPath))) {
      throw new PHPFatalError(`Fatal error: require(${filepath}): Failed opening required '${filepath}'`);
    }
    const compiledFunc = await this.engine.compileFile(resolvedPath);
    return await compiledFunc(this);
  }

  public async requireOnce(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath)
      ? filepath
      : path.resolve(this.cwd, filepath);
    if (this.includedFiles.has(resolvedPath)) {
      return true;
    }
    if (!(await this.fileExists(resolvedPath))) {
      throw new PHPFatalError(`Fatal error: require_once(${filepath}): Failed opening required '${filepath}'`);
    }
    this.includedFiles.add(resolvedPath);
    return await this.require(resolvedPath);
  }

  public static async runFile(
    filepath: string,
    options: PHPContextOptions = {}
  ): Promise<PHPContext> {
    const engine = new PHPEngine();
    const ctx = engine.createContext(options);
    await ctx.require(filepath);
    return ctx;
  }

  public static async runCode(
    code: string,
    options: PHPContextOptions = {}
  ): Promise<PHPContext> {
    const engine = new PHPEngine();
    const ctx = engine.createContext(options);
    await ctx.eval(code);
    return ctx;
  }
}
