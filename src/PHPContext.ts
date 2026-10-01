import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import { Writable } from "stream";
import { PHPEngine } from "./PHPEngine";
import { Superglobals, SuperglobalsOptions } from "./runtime/Superglobals";
import { OutputBufferStack } from "./runtime/OutputBuffer";
import { PHPError, PHPFatalError, PHPWarning, PHPNotice, PHPExit } from "./runtime/PHPError";
import { PHPObject, PHPClass } from "./runtime/PHPObject";
import { SourceMapRegistry } from "./runtime/SourceMapRegistry";

function logDebug(msg: string) {
  if (process.env.JSPHP_DEBUG !== "1") return;
  try {
    fsSync.appendFileSync(path.resolve(__dirname, "../debug.log"), msg + "\n");
  } catch (e) {}
}

class PHPReference {
  constructor(public readonly get: () => any, public readonly set: (value: any) => void) {}
}

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
  public constants: Map<string, any> = new Map();
  private scopes: Record<string, any>[] = [];
  private globalBindings: Set<string>[] = [];
  private staticBindings: Set<string>[] = [];
  public internalVars: Map<string, any> = new Map();
  public staticVars: Map<string, any> = new Map();
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
    if (obj.phpClass instanceof PHPClass) {
      return obj.phpClass.isSubclassOf(String(className));
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
    if (this.constants.has(name)) return this.constants.get(name);
    return this.engine.getConstant(name);
  }

  public hasConstant(name: string): boolean {
    if (!name || typeof name !== "string") return false;
    return this.constants.has(name) || this.engine.constants.has(name) || this.engine.constants.has(name.toUpperCase());
  }

  public defineConstant(name: string, val: any): void {
    this.constants.set(name, val);
  }

  public getVar(name: string): any {
    if (name === "GLOBALS") return this.vars;
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
      }
    }
    if (this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name)) {
      const value = this.vars[name];
      return value instanceof PHPReference ? value.get() : value;
    }
    for (let index = this.scopes.length - 1; index >= 0; index--) {
      if (Object.prototype.hasOwnProperty.call(this.scopes[index], name)) {
        const value = this.scopes[index][name];
        return value instanceof PHPReference ? value.get() : value;
      }
    }
    const value = this.vars[name];
    return value instanceof PHPReference ? value.get() : value;
  }

  public setVar(name: string, value: any): any {
    const isGlobal = this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name);
    const scope = isGlobal || this.scopes.length === 0 ? this.vars : this.scopes[this.scopes.length - 1];
    if (scope[name] instanceof PHPReference && !(value instanceof PHPReference)) scope[name].set(value);
    else scope[name] = value;
    if (this.staticBindings.length > 0) {
      for (const key of this.staticBindings[this.staticBindings.length - 1]) {
        if (key.endsWith(`:${name}`)) this.staticVars.set(key, value);
      }
    }
    return value;
  }

  public bindGlobal(name: string): void {
    if (this.globalBindings.length > 0) this.globalBindings[this.globalBindings.length - 1].add(name);
  }

  public pushScope(): void {
    this.scopes.push({});
    this.globalBindings.push(new Set());
    this.staticBindings.push(new Set());
  }

  public popScope(): void {
    this.scopes.pop();
    this.globalBindings.pop();
    this.staticBindings.pop();
  }

  public setVarOffset(name: string, key: any, value: any): any {
    return this.setVarOffsets(name, [key], value);
  }

  public setVarOffsets(name: string, keys: any[], value: any): any {
    let target = this.getVar(name);
    if (target === undefined || target === null) {
      target = [];
      this.setVar(name, target);
    }
    return this.assignOffsets(target, keys, value);
  }

  private assignOffsets(target: any, keys: any[], value: any): any {
    for (const key of keys.slice(0, -1)) {
      if (key === null) {
        const child: any[] = [];
        this.assignOffset(target, null, child);
        target = child;
      } else {
        if (target[key] === undefined || target[key] === null) target[key] = [];
        target = target[key];
      }
    }
    return this.assignOffset(target, keys[keys.length - 1], value);
  }

  private assignOffset(target: any, key: any, value: any): any {
    if (key === null) {
      key = Array.isArray(target) ? target.length : Math.max(-1, ...Object.keys(target).filter((entry) => /^(0|[1-9]\d*)$/.test(entry)).map(Number)) + 1;
    }
    target[key] = value;
    return value;
  }

  public initStaticVar(scope: string, name: string, value: any): void {
    const key = `${scope}:${name}`;
    if (this.staticBindings.length > 0) this.staticBindings[this.staticBindings.length - 1].add(key);
    if (!this.staticVars.has(key)) {
      this.staticVars.set(key, value);
      this.setVar(name, value);
    } else {
      this.setVar(name, this.staticVars.get(key));
    }
  }

  public isTruthy(value: any): boolean {
    if (value === null || value === undefined || value === false) return false;
    if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
    if (typeof value === "string") return value !== "" && value !== "0";
    if (Array.isArray(value)) return value.length > 0;
    return true;
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

  public async setProperty(obj: any, prop: string, value: any): Promise<any> {
    if (obj instanceof PHPObject) {
      await obj.setProperty(this, prop, value);
    } else if (obj && typeof obj === "object") {
      obj[prop] = value;
    }
    return value;
  }

  public async setPropertyOffset(obj: any, prop: string, key: any, value: any): Promise<any> {
    return await this.setPropertyOffsets(obj, prop, [key], value);
  }

  public async setPropertyOffsets(obj: any, prop: string, keys: any[], value: any): Promise<any> {
    let target = await this.getProperty(obj, prop);
    if (target === undefined || target === null) {
      target = [];
      await this.setProperty(obj, prop, target);
    }
    return this.assignOffsets(target, keys, value);
  }

  public async callMethod(obj: any, method: string, args: any[] = []): Promise<any> {
    logDebug(`CALL_METHOD: ${obj?.constructor?.name}::${method}`);
    if (obj instanceof PHPObject) {
      const res = await obj.callMethod(this, method, args);
      logDebug(`DONE_METHOD: ${obj?.constructor?.name}::${method}`);
      return res;
    }
    const metadata = obj?.phpClass?.methods?.get(method.toLowerCase());
    if (metadata?.fn) return await metadata.fn.apply(obj, [this, ...args]);
    if (obj && typeof obj[method] === "function") {
      const res = await obj[method].apply(obj, args);
      logDebug(`DONE_METHOD: ${obj?.constructor?.name}::${method}`);
      return res;
    }
    logDebug(`ERR_METHOD: ${obj?.constructor?.name}::${method}`);
    return undefined;
  }

  private referenceVariable(name: string): PHPReference {
    const isGlobal = this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name);
    const scope = isGlobal || this.scopes.length === 0 ? this.vars : this.scopes[this.scopes.length - 1];
    if (scope[name] instanceof PHPReference) return scope[name];
    return new PHPReference(() => scope[name], (value) => { scope[name] = value; });
  }

  public async callFunction(name: string, args: any[] = [], references: (string | null)[] = []): Promise<any> {
    logDebug(`CALL_FUNC: ${name}`);
    const fn = this.engine.functions.get(name.toLowerCase());
    if (fn) {
      const parameters = (fn as any).phpMeta?.parameters || [];
      const callArguments = args.map((value, index) => parameters[index]?.byref && references[index]
        ? this.referenceVariable(references[index]!) : value);
      const res = await fn.apply(this, [this, ...callArguments]);
      logDebug(`DONE_FUNC: ${name}`);
      return res;
    }
    logDebug(`ERR_FUNC: ${name}`);
    throw new PHPFatalError(`Call to undefined function ${name}()`);
  }

  public async resolveClass(className: string): Promise<any> {
    const normalizedName = String(className).replace(/^\\/, "").toLowerCase();
    const resolvedClass = this.engine.classes.get(normalizedName) || await this.engine.resolveClass(className, this);
    if (!resolvedClass) throw new PHPFatalError(`Class "${className}" not found`);
    return resolvedClass;
  }

  public async getClassConstant(className: string, name: string): Promise<any> {
    const resolvedClass = await this.resolveClass(className);
    if (resolvedClass.constants?.has(name)) return resolvedClass.constants.get(name);
    throw new PHPFatalError(`Undefined constant ${className}::${name}`);
  }

  public async getStaticProperty(className: string, name: string): Promise<any> {
    let resolvedClass = await this.resolveClass(className);
    while (resolvedClass) {
      if (resolvedClass.staticProperties?.has(name)) return resolvedClass.staticProperties.get(name);
      resolvedClass = resolvedClass.parentClass;
    }
    throw new PHPFatalError(`Access to undeclared static property ${className}::$${name}`);
  }

  public async setStaticProperty(className: string, name: string, value: any): Promise<any> {
    let resolvedClass = await this.resolveClass(className);
    while (resolvedClass) {
      if (resolvedClass.staticProperties?.has(name)) {
        resolvedClass.staticProperties.set(name, value);
        return value;
      }
      resolvedClass = resolvedClass.parentClass;
    }
    throw new PHPFatalError(`Access to undeclared static property ${className}::$${name}`);
  }

  public async setStaticPropertyOffsets(className: string, name: string, keys: any[], value: any): Promise<any> {
    let target = await this.getStaticProperty(className, name);
    if (target === undefined || target === null) {
      target = [];
      await this.setStaticProperty(className, name, target);
    }
    return this.assignOffsets(target, keys, value);
  }

  public async callParentMethod(receiver: any, className: string, method: string, args: any[]): Promise<any> {
    const resolvedClass = await this.resolveClass(className);
    const metadata = resolvedClass.parentClass?.methods?.get(method.toLowerCase());
    if (metadata?.fn) return await metadata.fn.apply(receiver, [this, ...args]);
    const nativeConstructor = resolvedClass.parentClass?.nativeConstructor;
    if (nativeConstructor) {
      if (method.toLowerCase() === "__construct") {
        Object.defineProperties(receiver, Object.getOwnPropertyDescriptors(Reflect.construct(nativeConstructor, args)));
        return;
      }
      const nativeMethod = nativeConstructor.prototype[method];
      if (typeof nativeMethod === "function") return await nativeMethod.apply(receiver, args);
    }
    throw new PHPFatalError(`Call to undefined parent method ${className}::${method}()`);
  }

  public async callStaticMethod(className: string, method: string, args: any[] = []): Promise<any> {
    const normalizedClassName = String(className).toLowerCase();
    const shortClassName = normalizedClassName.split("\\").pop() || normalizedClassName;
    let cls = this.engine.classes.get(normalizedClassName) || this.engine.classes.get(shortClassName);
    if (!cls) cls = await this.engine.resolveClass(className, this);
    if (cls?.methods && typeof cls.methods.get === "function") {
      const metadata = cls.methods.get(String(method).toLowerCase());
      if (metadata?.fn) return await metadata.fn.apply(cls, [this, ...args]);
    }
    if (cls && typeof cls[method] === "function") return await cls[method](...args);
    throw new PHPFatalError(`Call to undefined static method ${className}::${method}()`);
  }

  public async createObject(className: string, args: any[] = []): Promise<any> {
    logDebug(`NEW: ${className}`);
    const rawClass = this.engine.classes.get(className.toLowerCase());
    if (rawClass && typeof rawClass === "function" && !(rawClass.prototype instanceof PHPObject)) {
      const obj = new (rawClass as any)(...args);
      if (obj instanceof PHPError) Object.defineProperty(obj, "phpClass", { value: new PHPClass(className, rawClass) });
      logDebug(`DONE_NEW: ${className}`);
      return obj;
    }
    const phpClass = rawClass instanceof PHPClass ? rawClass : new PHPClass(className);
    const obj = phpClass.nativeConstructor ? Reflect.construct(phpClass.nativeConstructor, args) : new PHPObject(phpClass);
    if (phpClass.nativeConstructor) {
      Object.defineProperty(obj, "phpClass", { value: phpClass });
      for (const [name, metadata] of phpClass.properties) {
        if (!metadata.isStatic) obj[name] = metadata.defaultValue;
      }
    }
    const __construct = phpClass.methods ? phpClass.methods.get("__construct") : undefined;
    if (__construct?.fn) {
      await __construct.fn.apply(obj, [this, ...args]);
    }
    logDebug(`DONE_NEW: ${className}`);
    return obj instanceof PHPObject ? obj.asProxy(this) : obj;
  }

  public async eval(code: string, filepath: string = "eval"): Promise<any> {
    logDebug(`EVAL: ${filepath}`);
    try {
      const compiledFunc = await this.engine.compileCode(code, filepath);
      const res = await compiledFunc(this);
      logDebug(`DONE_EVAL: ${filepath}`);
      return res;
    } catch (err: any) {
      logDebug(`ERR_EVAL: ${err}`);
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

  private normalizeFilePath(filepath: string): string {
    const resolved = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
    return resolved.replace(/\\/g, "/").toLowerCase();
  }

  public async include(filepath: string): Promise<any> {
    const normPath = this.normalizeFilePath(filepath);
    const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
    this.includedFiles.add(normPath);

    logDebug(`INC: ${path.basename(resolvedPath)}`);
    if (!(await this.fileExists(resolvedPath))) {
      await this.triggerError(`include(${filepath}): Failed to open stream: No such file or directory`, 2);
      return false;
    }
    const compiledFunc = await this.engine.compileFile(resolvedPath);
    const res = await compiledFunc(this);
    logDebug(`DONE_INC: ${path.basename(resolvedPath)}`);
    return res;
  }

  public async includeOnce(filepath: string): Promise<any> {
    const normPath = this.normalizeFilePath(filepath);
    if (this.includedFiles.has(normPath)) {
      return true;
    }
    this.includedFiles.add(normPath);
    return await this.include(filepath);
  }

  public async require(filepath: string): Promise<any> {
    const normPath = this.normalizeFilePath(filepath);
    const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
    this.includedFiles.add(normPath);

    logDebug(`REQ: ${path.basename(resolvedPath)}`);
    if (!(await this.fileExists(resolvedPath))) {
      throw new PHPFatalError(`Fatal error: require(${filepath}): Failed opening required '${filepath}'`);
    }
    const compiledFunc = await this.engine.compileFile(resolvedPath);
    const res = await compiledFunc(this);
    logDebug(`DONE_REQ: ${path.basename(resolvedPath)}`);
    return res;
  }

  public async requireOnce(filepath: string): Promise<any> {
    const normPath = this.normalizeFilePath(filepath);
    if (this.includedFiles.has(normPath)) {
      return true;
    }
    this.includedFiles.add(normPath);
    return await this.require(filepath);
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
