import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import { Writable } from "stream";
import { PHPEngine } from "./PHPEngine.js";
import { Superglobals, SuperglobalsOptions } from "./runtime/Superglobals.js";
import { OutputBufferStack } from "./runtime/OutputBuffer.js";
import { PHPError, PHPFatalError, PHPTypeError, PHPWarning, PHPNotice, PHPExit } from "./runtime/PHPError.js";
import { PHPObject, PHPClass } from "./runtime/PHPObject.js";
import { PHPVariable, PHPReference, PHPLiteral } from "./runtime/PHPVariable.js";

function logDebug(msg: string) {
  if (process.env.JSPHP_DEBUG !== "1") return;
  try {
    fsSync.appendFileSync(path.resolve(__dirname, "../debug.log"), msg + "\n");
  } catch (e) {}
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

  /** Sets an HTTP response header. */
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

  /** Removes an HTTP response header. */
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

  /** Gets an HTTP response header value by name. */
  public getHeader(name: string): string | undefined {
    const found = this.headers.filter((h) => h.name.toLowerCase() === name.toLowerCase());
    return found.length > 0 ? found[found.length - 1].value : undefined;
  }

  /** Gets all formatted HTTP response headers. */
  public getHeadersList(): string[] {
    return this.headers.map((h) => `${h.name}: ${h.value}`);
  }

  /** Sets a Set-Cookie HTTP header. */
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
  public constants: Record<string, any>;
  public functions: Record<string, Function>;
  public classes: Record<string, any>;
  public internalVars: Record<string, any>;
  private scopes: Record<string, any>[] = [];
  private globalBindings: Set<string>[] = [];
  private staticBindings: Set<string>[] = [];
  public staticVars: Map<string, any> = new Map();
  public superglobals: Superglobals;
  public outputBuffer: OutputBufferStack;
  public response: PHPResponse;
  public errorHandlerStack: any[] = [];
  public errorReportingLevel: number = 32767; // E_ALL
  public includedFiles: Set<string> = new Set();
  public executionDepth: number = 0;
  public tickCount: number = 0;
  private stdout: Writable | ((data: string) => void);
  private stderr: Writable | ((data: string) => void);
  public outputText: string = "";

  public checkLoop(filepath: string, line: number) {
    this.tickCount = 0;
  }

  constructor(engine: PHPEngine, options: PHPContextOptions = {}) {
    this.engine = engine;
    this.constants = Object.create(engine.constants);
    this.functions = Object.create(engine.functions);
    this.classes = Object.create(engine.classes);
    this.internalVars = Object.create(engine.internalVars);
    this.cwd = options.cwd || process.cwd();
    this.env = options.env || (process.env as Record<string, string>);
    this.stdout = options.stdout || ((data: string) => {});
    this.stderr = options.stderr || ((data: string) => { console.error(data); });
    this.superglobals = new Superglobals({ ...options.superglobals, env: this.env });
    this.outputBuffer = new OutputBufferStack();
    this.response = new PHPResponse();
    if (this.superglobals.SERVER['argv']) {
      const argvArr = Array.isArray(this.superglobals.SERVER['argv']) ? this.superglobals.SERVER['argv'] : [];
      this.vars['argv'] = new PHPVariable(argvArr);
      this.vars['argc'] = new PHPVariable(argvArr.length);
    }
    if (options.errorReporting !== undefined) {
      this.errorReportingLevel = options.errorReporting;
    }
  }

  public currentClassStack: any[] = [];
  public get currentClass(): any {
    return this.currentClassStack.length > 0 ? this.currentClassStack[this.currentClassStack.length - 1] : undefined;
  }

  public get currentClassName(): string {
    const cls = this.currentClass;
    return cls ? (cls.name || cls.phpClass?.name || "") : "";
  }

  public get currentParentClassName(): string {
    const cls = this.currentClass;
    const parent = cls ? (cls.parentClass || cls.phpClass?.parentClass) : undefined;
    return parent ? (parent.name || parent.phpClass?.name || "") : "";
  }

  /**
   * Checks if an object is an instance of a class or interface.
   * @param className Class or interface name in lowercase.
   */
  public isInstanceOf(obj: any, className: string): boolean {
    if (!obj || typeof obj !== "object") return false;
    if (obj.phpClass instanceof PHPClass) {
      return obj.phpClass.isSubclassOf(className);
    }
    const cls = this.classes[className];
    if (cls && typeof cls === "function") {
      return obj instanceof cls;
    }
    return false;
  }

  /** Gets virtualized PHP stack trace frames for error handling and backtraces. */
  public getPHPBacktrace(): any[] {
    const err = new Error();
    const rawLines = (err.stack || "").split("\n");
    const frames: any[] = [];

    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;
      if (line.includes("PHPContext.") || line.includes("PHPContext.ts") || line.includes("PHPContext.js") || line.includes("PHPEngine.") || line.includes("php-http-server") || line.includes("node:internal")) continue;

      const matchPhp = line.match(/\((.*?\.php):(\d+):(\d+)\)/) || line.match(/at\s+(.*?\.php):(\d+):(\d+)/) || line.match(/at\s+([^\s]+)\s+\((.*?):(\d+):(\d+)\)/);
      if (matchPhp) {
        const file = matchPhp[2] || matchPhp[1];
        const lineNum = parseInt(matchPhp[3] || matchPhp[2], 10);
        const jsFunc = matchPhp[1] && matchPhp[2] ? matchPhp[1] : "{main}";
        frames.push({
          file: file,
          line: lineNum,
          function: jsFunc,
        });
      }
    }

    return frames;
  }

  /** Sets a user-defined error handler function. */
  public setErrorHandler(handler: any, levels = 32767): any {
    const prev = this.errorHandlerStack.length > 0 ? this.errorHandlerStack[this.errorHandlerStack.length - 1] : null;
    this.errorHandlerStack.push({ handler, levels });
    return prev ? prev.handler : null;
  }

  /** Restores the previous error handler from the stack. */
  public restoreErrorHandler(): boolean {
    if (this.errorHandlerStack.length > 0) {
      this.errorHandlerStack.pop();
    }
    return true;
  }

  /** Triggers a userland error or warning. */
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

  /** Gets an internal variable value. */
  public getInternalVar(name: string): any {
    return this.internalVars[name];
  }

  /** Sets an internal variable value. */
  public setInternalVar(name: string, value: any): void {
    this.internalVars[name] = value;
  }

  /** Gets response headers as a key-value dictionary. */
  public get responseHeaders(): Record<string, string> {
    const res: Record<string, string> = {};
    for (const h of this.response.headers) {
      res[h.name.toLowerCase()] = h.value;
    }
    return res;
  }

  /** Gets the current HTTP status code. */
  public get statusCode(): number {
    return this.response.statusCode;
  }

  /** Flushes response headers to the client. */
  public flushHeaders(): void {
    if (this.response.headersSent) return;
    this.response.headersSent = true;
    const onFlush = this.getInternalVar("onFlushHeaders");
    if (typeof onFlush === "function") {
      onFlush(this.response.statusCode, this.response.headers);
    }
  }

  /** Writes output text to stdout or active output buffer. */
  public async echo(data: any): Promise<void> {
    const str = String(data ?? "");
    if (str.includes("Database Name") || str.includes("dbname")) {
      console.log("ECHO TRACE:", JSON.stringify(str), "level:", this.outputBuffer.getLevel());
    }
    if (this.outputBuffer.getLevel() > 0) {
      this.outputBuffer.write(str);
    } else {
      if (str.length > 0) {
        this.flushHeaders();
      }
      this.writeStdout(str);
    }
  }

  public writeStdout(str: string): void {
    this.outputText += str;
    if (typeof this.stdout === "function") {
      this.stdout(str);
    } else if (this.stdout && typeof this.stdout.write === "function") {
      this.stdout.write(str);
    }
  }

  /** Gets a constant value. */
  public getConstant(name: string): any {
    const lower = String(name ?? "").toLowerCase();
    return this.constants[name] ?? this.constants[lower] ?? this.engine.constants[name] ?? this.engine.constants[lower];
  }

  /** Checks if a constant is defined. */
  public hasConstant(name: string): boolean {
    if (!name || typeof name !== "string") return false;
    const lower = name.toLowerCase();
    return Object.hasOwn(this.constants, name) || Object.hasOwn(this.constants, lower) || Object.hasOwn(this.engine.constants, name) || Object.hasOwn(this.engine.constants, lower);
  }

  /** Defines a constant. */
  public defineConstant(name: string, val: any): void {
    const lower = String(name ?? "").toLowerCase();
    this.constants[name] = val;
    this.constants[lower] = val;
  }

  private globalsProxy?: any;

  private getGlobalPHPVar(name: string): PHPVariable {
    let phpVar = this.vars[name];
    if (!(phpVar instanceof PHPVariable)) {
      phpVar = new PHPVariable(phpVar && typeof phpVar === "object" && typeof phpVar.get === "function" ? phpVar.get() : phpVar);
      this.vars[name] = phpVar;
    }
    return phpVar;
  }

  private getGlobalsProxy(): any {
    if (!this.globalsProxy) {
      this.globalsProxy = new Proxy(this.vars, {
        get: (target, prop) => {
          if (typeof prop === "string") {
            if (prop === "GLOBALS") return this.globalsProxy;
            return this.getGlobalPHPVar(prop).get();
          }
          return (target as any)[prop];
        },
        set: (target, prop, value) => {
          if (typeof prop === "string") {
            const phpVar = this.getGlobalPHPVar(prop);
            if (value instanceof PHPVariable) {
              phpVar.bindRef(value);
            } else {
              phpVar.set(value);
            }
            return true;
          }
          (target as any)[prop] = value;
          return true;
        },
        has: (target, prop) => {
          return typeof prop === "string" ? (prop in target) : Reflect.has(target, prop);
        },
        deleteProperty: (target, prop) => {
          if (typeof prop === "string") {
            delete target[prop];
            return true;
          }
          return Reflect.deleteProperty(target, prop);
        },
        ownKeys: (target) => {
          return Object.keys(target);
        },
        getOwnPropertyDescriptor: (target, prop) => {
          if (typeof prop === "string" && prop in target) {
            return { enumerable: true, configurable: true, writable: true, value: this.getGlobalPHPVar(prop).get() };
          }
          return Reflect.getOwnPropertyDescriptor(target, prop);
        }
      });
    }
    return this.globalsProxy;
  }

  public getPHPVar(name: string): PHPVariable {
    const isGlobal = this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name);
    const scope = isGlobal || this.scopes.length === 0 ? this.vars : this.scopes[this.scopes.length - 1];
    let phpVar = scope[name];
    if (!(phpVar instanceof PHPVariable)) {
      phpVar = new PHPVariable(phpVar && typeof phpVar === "object" && typeof phpVar.get === "function" ? phpVar.get() : phpVar);
      scope[name] = phpVar;
    }
    return phpVar;
  }

  /** Gets a variable value from the current or global scope. */
  public getVar(name: string): any {
    if (name === "GLOBALS") return this.getGlobalsProxy();
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
    return this.getPHPVar(name).get();
  }

  /** Sets a variable value in the current scope. */
  public setVar(name: string, value: any): any {
    const phpVar = this.getPHPVar(name);
    if (value instanceof PHPVariable) {
      phpVar.bindRef(value);
    } else {
      phpVar.set(value);
    }
    if (this.staticBindings.length > 0) {
      for (const key of this.staticBindings[this.staticBindings.length - 1]) {
        if (key.endsWith(`:${name}`)) this.staticVars.set(key, value);
      }
    }
    return value;
  }

  /** Binds a variable name to global scope. */
  public bindGlobal(name: string): void {
    if (this.globalBindings.length > 0) {
      this.globalBindings[this.globalBindings.length - 1].add(name);
      if (this.scopes.length > 0) {
        const currentScope = this.scopes[this.scopes.length - 1];
        let globalVar = this.vars[name];
        if (!(globalVar instanceof PHPVariable)) {
          globalVar = new PHPVariable(globalVar && typeof globalVar === "object" && typeof globalVar.get === "function" ? globalVar.get() : globalVar);
          this.vars[name] = globalVar;
        }
        let localVar = currentScope[name];
        if (!(localVar instanceof PHPVariable)) {
          localVar = new PHPVariable(localVar && typeof localVar === "object" && typeof localVar.get === "function" ? localVar.get() : localVar);
          currentScope[name] = localVar;
        }
        localVar.bindRef(globalVar);
      }
    }
  }

  private scopeArgs: any[][] = [];

  /** Pushes a new variable scope. */
  public pushScope(args: any[] = []): void {
    this.scopes.push({});
    this.globalBindings.push(new Set());
    this.staticBindings.push(new Set());
    this.scopeArgs.push(args);
  }

  /** Pops the current variable scope. */
  public popScope(): void {
    this.scopes.pop();
    this.globalBindings.pop();
    this.staticBindings.pop();
    this.scopeArgs.pop();
  }

  public getCurrentFunctionArgs(): any[] {
    return this.scopeArgs.length > 0 ? this.scopeArgs[this.scopeArgs.length - 1] : [];
  }

  /** Sets a single array offset on a variable. */
  public setVarOffset(name: string, key: any, value: any): any {
    return this.setVarOffsets(name, [key], value);
  }

  /** Sets nested array offsets on a variable. */
  public setVarOffsets(name: string, keys: any[], value: any): any {
    const cleanKeys = keys.map((k) => (k instanceof PHPVariable ? k.get() : k));
    let target = this.getVar(name);
    if (target !== undefined && target !== null && typeof target !== "object") {
      throw new PHPTypeError("Cannot use a scalar value as an array");
    }
    if (target === undefined || target === null) {
      const firstKey = cleanKeys[0];
      target = (firstKey === null || typeof firstKey === "number" || /^(0|[1-9]\d*)$/.test(String(firstKey))) ? [] : {};
      this.getPHPVar(name).set(target);
    }
    return this.assignOffsets(target, cleanKeys, value);
  }

  /** Unsets nested array offsets on a variable. */
  public unsetVarOffsets(name: string, keys: any[]): void {
    const cleanKeys = keys.map((k) => (k instanceof PHPVariable ? k.get() : k));
    let target = this.getVar(name);
    if (!target || typeof target !== "object") return;
    for (let i = 0; i < cleanKeys.length - 1; i++) {
      target = target[cleanKeys[i]];
      if (!target || typeof target !== "object") return;
    }
    delete target[cleanKeys[cleanKeys.length - 1]];
  }

  /** Gets nested array offsets on a variable. */
  public getVarOffsets(name: string, keys: any[]): any {
    const cleanKeys = keys.map((k) => (k && typeof k === "object" && typeof (k as any).get === "function" ? (k as any).get() : k));
    let target = this.getVar(name);
    for (const key of cleanKeys) {
      if (target === undefined || target === null) return undefined;
      target = target[key];
      if (target && typeof target === "object" && typeof (target as any).get === "function") {
        target = (target as any).get();
      }
    }
    return target;
  }

  private assignOffsets(target: any, keys: any[], value: any): any {
    const cleanKeys = keys.map((k) => (k && typeof k === "object" && typeof (k as any).get === "function" ? (k as any).get() : k));
    for (let i = 0; i < cleanKeys.length - 1; i++) {
      const key = cleanKeys[i];
      const nextKey = cleanKeys[i + 1];
      if (key === null) {
        const child = (nextKey === null || typeof nextKey === "number" || /^(0|[1-9]\d*)$/.test(String(nextKey))) ? [] : {};
        this.assignOffset(target, null, child);
        target = child;
      } else {
        if (target[key] === undefined || target[key] === null) {
          target[key] = (nextKey === null || typeof nextKey === "number" || /^(0|[1-9]\d*)$/.test(String(nextKey))) ? [] : {};
        }
        target = target[key];
        if (target && typeof target === "object" && typeof (target as any).get === "function") {
          target = (target as any).get();
        }
      }
    }
    return this.assignOffset(target, cleanKeys[cleanKeys.length - 1], value);
  }

  private assignOffset(target: any, key: any, value: any): any {
    if (key && typeof key === "object" && typeof (key as any).get === "function") key = (key as any).get();
    if (!target || (typeof target !== "object" && typeof target !== "function")) {
      target = [];
    }
    if (key === null) {
      key = Array.isArray(target) ? target.length : Math.max(-1, ...Object.keys(target).filter((entry) => /^(0|[1-9]\d*)$/.test(entry)).map(Number)) + 1;
    }
    target[key] = value;
    return value;
  }

  /** Initializes a static variable in function scope. */
  public initStaticVar(scope: string, name: string, value: any): void {
    const key = `${scope}:${name}`;
    if (!this.staticVars.has(key)) {
      this.staticVars.set(key, new PHPVariable(value));
    }
    const phpVar = this.getPHPVar(name);
    phpVar.bindRef(this.staticVars.get(key)!);
  }

  /** Evaluates whether a value is truthy in PHP. */
  public isTruthy(val: any): boolean {
    if (val === null || val === undefined || val === false) return false;
    if (typeof val === "number") return val !== 0 && !Number.isNaN(val);
    if (typeof val === "string") return val !== "" && val !== "0";
    if (Array.isArray(val)) return val.length > 0;
    return true;
  }

  /**
   * Gets a property on an object or array.
   * @param prop Property name in lowercase.
   */
  public async getProperty(obj: any, prop: string): Promise<any> {
    if (obj instanceof PHPObject) {
      return await obj.getProperty(this, prop);
    }
    if (obj && typeof obj === "object") {
      return obj[prop];
    }
    return undefined;
  }

  /**
   * Sets a property on an object or array.
   * @param prop Property name in lowercase.
   */
  public async setProperty(obj: any, prop: string, value: any): Promise<any> {
    if (obj instanceof PHPObject) {
      await obj.setProperty(this, prop, value);
    } else if (obj && typeof obj === "object") {
      obj[prop] = value;
    }
    return value;
  }

  /** Sets a single property offset on an object. */
  public async setPropertyOffset(obj: any, prop: string, key: any, value: any): Promise<any> {
    return await this.setPropertyOffsets(obj, prop, [key], value);
  }

  /** Sets nested property offsets on an object. */
  public async setPropertyOffsets(obj: any, prop: string, keys: any[], value: any): Promise<any> {
    let target = await this.getProperty(obj, prop);
    if (target === undefined || target === null) {
      target = [];
      await this.setProperty(obj, prop, target);
    }
    return this.assignOffsets(target, keys, value);
  }

  /** Gets nested property offsets on an object. */
  public async getPropertyOffsets(obj: any, prop: string, keys: any[]): Promise<any> {
    let target = await this.getProperty(obj, prop);
    const cleanKeys = keys.map((k) => (k instanceof PHPVariable ? k.get() : k));
    for (const key of cleanKeys) {
      if (target === undefined || target === null) return undefined;
      target = target[key];
    }
    return target;
  }

  /** Unsets nested property offsets on an object. */
  public async unsetPropertyOffsets(obj: any, prop: string, keys: any[]): Promise<void> {
    let target = await this.getProperty(obj, prop);
    if (!target || typeof target !== "object") return;
    const cleanKeys = keys.map((k) => (k instanceof PHPVariable ? k.get() : k));
    for (let i = 0; i < cleanKeys.length - 1; i++) {
      target = target[cleanKeys[i]];
      if (!target || typeof target !== "object") return;
    }
    delete target[cleanKeys[cleanKeys.length - 1]];
  }

  /**
   * Calls a method on an object.
   * Expects method name in lowercase.
   * @param method Method name in lowercase.
   */
  public async callMethod(obj: any, method: string, args: any[] = []): Promise<any> {
    if (obj && typeof obj === "object" && typeof (obj as any).get === "function") {
      obj = (obj as any).get();
    }

    logDebug(`CALL_METHOD: ${obj?.constructor?.name}::${method}`);
    if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return undefined;

    const lowerMethod = method.toLowerCase();
    const callArgs = args.map((arg) => (arg instanceof PHPVariable ? arg : new PHPVariable(arg)));

    if (typeof obj.callMethod === "function") {
      let res = await obj.callMethod(this, method, callArgs);
      if (res instanceof PHPVariable) res = res.get();
      logDebug(`DONE_METHOD: ${obj?.constructor?.name}::${method}`);
      return res;
    }

    const metadata = obj?.phpClass?.methods?.get ? (obj.phpClass.methods.get(method) || obj.phpClass.methods.get(lowerMethod)) : (obj?.phpClass?.methods?.[method] || obj?.phpClass?.methods?.[lowerMethod]);
    if (metadata?.fn) {
      return await metadata.fn.apply(obj, [this, ...callArgs]);
    }

    if (typeof obj[method] === "function") {
      return await obj[method].apply(obj, [this, ...callArgs]);
    }
    if (typeof obj[lowerMethod] === "function") {
      return await obj[lowerMethod].apply(obj, [this, ...callArgs]);
    }

    let target = obj;
    while (target && target !== Object.prototype) {
      for (const propName of Object.getOwnPropertyNames(target)) {
        if (propName.toLowerCase() === lowerMethod && typeof obj[propName] === "function") {
          return await obj[propName].apply(obj, [this, ...callArgs]);
        }
      }
      target = Object.getPrototypeOf(target);
    }

    logDebug(`ERR_METHOD: ${obj?.constructor?.name}::${method}`);
    return undefined;
  }

  /** Gets a PHPReference wrapper for a variable name. */
  public getVarRef(name: string): PHPReference {
    return this.getPHPVar(name);
  }

  /**
   * Calls a global function.
   * Expects function name in lowercase.
   * @param name Function name in lowercase.
   */
  public async callFunction(name: any, args: any[] = []): Promise<any> {
    if (!name && name !== 0) throw new PHPFatalError("Call to undefined function");
    const callArguments = args.map((arg) => (arg instanceof PHPVariable ? arg : new PHPVariable(arg)));
    if (typeof name === "function") {
      let res = await name.apply(this, [this, ...callArguments]);
      if (res instanceof PHPVariable) res = res.get();
      return res;
    }
    const strName = String(name?.get ? name.get() : name);
    logDebug(`CALL_FUNC: ${strName}`);
    const lowerName = strName.toLowerCase();
    const fn = this.functions[strName] || this.functions[lowerName] || (this.engine.functions[strName] || this.engine.functions[lowerName]);
    if (fn) {
      let res = await fn.apply(this, [this, ...callArguments]);
      if (res instanceof PHPVariable) res = res.get();
      if (strName === "_e" || strName === "translate") {
        console.log(`CALL ${strName}(${args.map((a) => JSON.stringify(a?.get ? a.get() : a)).join(", ")}):`, JSON.stringify(res));
      }
      logDebug(`DONE_FUNC: ${strName}`);
      return res;
    }
    logDebug(`ERR_FUNC: ${strName}`);
    throw new PHPFatalError(`Call to undefined function ${strName}()`);
  }

  /**
   * Resolves a class by lowercase name.
   * @param className Class name in lowercase.
   * @param originalName Class name in original casing.
   */
  public async resolveClass(className: string, originalName?: string): Promise<any> {
    const orig = originalName || className;
    const lower = className.toLowerCase();
    let cls = this.classes[className] || this.classes[lower] || this.engine.classes[className] || this.engine.classes[lower];
    if (!cls) {
      cls = await this.engine.resolveClass(lower, orig, this);
    }
    if (!cls && (lower.endsWith("exception") || lower.endsWith("error"))) {
      cls = this.engine.classes["exception"] || this.engine.classes["error"];
    }
    return cls;
  }

  /**
   * Gets a static class constant.
   * @param className Class name in lowercase.
   * @param name Constant name in lowercase.
   * @param originalClassName Class name in original casing.
   */
  public async getClassConstant(className: string, name: string, originalClassName?: string): Promise<any> {
    const origClass = originalClassName || className;
    let resolvedClass: PHPClass | undefined = await this.resolveClass(className, origClass);
    if (!resolvedClass) throw new PHPFatalError(`Class "${origClass}" not found`);
    const lowerName = name.toLowerCase();
    const upperName = name.toUpperCase();
    while (resolvedClass) {
      if (resolvedClass.constants) {
        if (resolvedClass.constants.has(name)) return resolvedClass.constants.get(name);
        if (resolvedClass.constants.has(upperName)) return resolvedClass.constants.get(upperName);
        if (resolvedClass.constants.has(lowerName)) return resolvedClass.constants.get(lowerName);
        for (const [k, v] of resolvedClass.constants.entries()) {
          if (k.toLowerCase() === lowerName) return v;
        }
      }
      resolvedClass = resolvedClass.parentClass;
    }
    throw new PHPFatalError(`Undefined constant ${origClass}::${name}`);
  }

  /**
   * Gets a static class property.
   * @param className Class name in lowercase.
   * @param name Property name in lowercase.
   */
  public async getStaticProperty(className: string, name: string): Promise<any> {
    let resolvedClass = await this.resolveClass(className);
    if (!resolvedClass) throw new PHPFatalError(`Class "${className}" not found`);
    const cleanName = (name.startsWith("$") ? name.slice(1) : name).toLowerCase();
    while (resolvedClass) {
      if (resolvedClass.properties) {
        const prop = resolvedClass.properties.get ? resolvedClass.properties.get(cleanName) : resolvedClass.properties[cleanName];
        if (prop && prop.isStatic) return prop.defaultValue;
      }
      if (resolvedClass.staticProperties) {
        if (resolvedClass.staticProperties.has ? resolvedClass.staticProperties.has(cleanName) : (cleanName in resolvedClass.staticProperties)) {
          return resolvedClass.staticProperties.get ? resolvedClass.staticProperties.get(cleanName) : resolvedClass.staticProperties[cleanName];
        }
      }
      resolvedClass = resolvedClass.parentClass;
    }
    throw new PHPFatalError(`Access to undeclared static property ${className}::$${name}`);
  }

  /**
   * Sets a static class property.
   * @param className Class name in lowercase.
   * @param name Property name in lowercase.
   */
  public async setStaticProperty(className: string, name: string, value: any): Promise<any> {
    let resolvedClass = await this.resolveClass(className);
    const cleanName = (name.startsWith("$") ? name.slice(1) : name).toLowerCase();
    while (resolvedClass) {
      if (resolvedClass.properties) {
        const prop = resolvedClass.properties.get ? resolvedClass.properties.get(cleanName) : resolvedClass.properties[cleanName];
        if (prop && prop.isStatic) {
          prop.defaultValue = value;
          return value;
        }
      }
      if (resolvedClass.staticProperties) {
        if (resolvedClass.staticProperties.has ? resolvedClass.staticProperties.has(cleanName) : (cleanName in resolvedClass.staticProperties)) {
          if (resolvedClass.staticProperties.set) resolvedClass.staticProperties.set(cleanName, value);
          else resolvedClass.staticProperties[cleanName] = value;
          return value;
        }
      }
      resolvedClass = resolvedClass.parentClass;
    }
    throw new PHPFatalError(`Access to undeclared static property ${className}::$${name}`);
  }

  /** Sets static property array offsets. */
  public async setStaticPropertyOffsets(className: string, name: string, keys: any[], value: any): Promise<any> {
    let target = await this.getStaticProperty(className, name);
    if (target === undefined || target === null) {
      target = [];
      await this.setStaticProperty(className, name, target);
    }
    return this.assignOffsets(target, keys, value);
  }

  /**
   * Calls a static method on a class.
   * @param className Class name in lowercase.
   * @param method Method name in lowercase.
   * @param originalClassName Class name in original casing.
   */
  public async callStaticMethod(className: string, method: string, args: any[] = [], targetObj?: any, originalClassName?: string): Promise<any> {
    const origClass = originalClassName || className;
    const lowerClass = className.toLowerCase();
    let cls = await this.resolveClass(lowerClass, origClass);
    if (!cls) {
      const shortClassName = lowerClass.split("\\").pop() || lowerClass;
      cls = this.classes[shortClassName] || this.engine.classes[shortClassName];
    }
    if (!cls) throw new PHPFatalError(`Class "${origClass}" not found`);

    const callArgs = args.map((arg) => (arg instanceof PHPVariable ? arg : new PHPVariable(arg)));
    const calledClass = cls;
    let targetClass = cls;
    this.currentClassStack.push(calledClass);
    try {
      while (targetClass) {
        if (targetClass.methods && typeof targetClass.methods.get === "function") {
          const metadata = targetClass.methods.get(method) || targetClass.methods.get(method.toLowerCase());
          if (metadata?.fn) {
            let res = await metadata.fn.apply(targetObj || calledClass, [this, ...callArgs]);
            if (res instanceof PHPVariable) res = res.get();
            return res;
          }
        }
        targetClass = targetClass.parentClass;
      }
      targetClass = cls;
      while (targetClass) {
        if (targetClass.methods && typeof targetClass.methods.get === "function") {
          const callStaticMeta = targetClass.methods.get("__callstatic");
          if (callStaticMeta?.fn) {
            let res = await callStaticMeta.fn.apply(calledClass, [this, method, callArgs]);
            if (res instanceof PHPVariable) res = res.get();
            return res;
          }
        }
        targetClass = targetClass.parentClass;
      }
      if (cls && typeof cls[method] === "function") return await cls[method](...callArgs);
      if (cls && typeof cls[method.toLowerCase()] === "function") return await cls[method.toLowerCase()](...callArgs);
      if (method.toLowerCase() === "__construct" && typeof cls === "function") {
        const instance = new (cls as any)(...callArgs);
        if (targetObj && typeof targetObj === "object") {
          Object.assign(targetObj, instance);
        }
        return instance;
      }
      throw new PHPFatalError(`Call to undefined static method ${origClass}::${method}()`);
    } finally {
      this.currentClassStack.pop();
    }
  }

  /**
   * Creates an instance of a class.
   * @param className Class name in lowercase.
   * @param originalClassName Class name in original casing.
   */
  public async createObject(className: string, args: any[] = [], originalClassName?: string): Promise<any> {
    const origClass = originalClassName || className;
    logDebug(`NEW: ${className}`);
    const lowerClass = className.toLowerCase();
    let rawClass = await this.resolveClass(lowerClass, origClass);
    if (!rawClass) {
      const shortClassName = lowerClass.split("\\").pop() || lowerClass;
      rawClass = this.classes[shortClassName] || this.engine.classes[shortClassName];
    }

    const callArgs = args.map((arg) => (arg instanceof PHPVariable ? arg : new PHPVariable(arg)));
    if (rawClass && typeof rawClass === "function" && !(rawClass.prototype instanceof PHPObject)) {
      const obj = new (rawClass as any)(...callArgs);
      if (obj instanceof PHPError) Object.defineProperty(obj, "phpClass", { value: new PHPClass(origClass, rawClass) });
      logDebug(`DONE_NEW: ${className}`);
      return obj;
    }
    const phpClass = rawClass instanceof PHPClass ? rawClass : new PHPClass(origClass);
    const obj = phpClass.nativeConstructor ? Reflect.construct(phpClass.nativeConstructor, callArgs) : new PHPObject(phpClass);
    if (phpClass.nativeConstructor) {
      Object.defineProperty(obj, "phpClass", { value: phpClass });
      for (const [name, metadata] of phpClass.properties) {
        if (!metadata.isStatic) obj[name] = metadata.defaultValue;
      }
    }
    let constructMeta: any = undefined;
    let currentCls: PHPClass | undefined = phpClass;
    while (currentCls) {
      if (currentCls.methods && typeof currentCls.methods.get === "function") {
        constructMeta = currentCls.methods.get("__construct");
        if (constructMeta) break;
      }
      if (currentCls.nativeConstructor) {
        constructMeta = {
          fn: async (ctx: PHPContext, msgArg?: any, codeArg?: any) => {
            const msg = msgArg instanceof PHPVariable ? msgArg.get() : msgArg;
            const code = codeArg instanceof PHPVariable ? codeArg.get() : codeArg;
            if (msg !== undefined && obj instanceof PHPObject) obj.properties.set("message", msg);
            if (code !== undefined && obj instanceof PHPObject) obj.properties.set("code", code);
          }
        };
        break;
      }
      currentCls = currentCls.parentClass;
    }
    if (constructMeta?.fn) {
      await constructMeta.fn.apply(obj, [this, ...callArgs]);
    }
    logDebug(`DONE_NEW: ${className}`);
    return obj;
  }

  /** Evaluates PHP code in the context. */
  public async eval(code: string, filepath: string = "eval"): Promise<any> {
    logDebug(`EVAL: ${filepath}`);
    this.executionDepth++;
    const isTopLevel = this.executionDepth === 1;
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
    } finally {
      if (isTopLevel) {
        await this.runShutdownFunctions();
        this.outputBuffer.flushAll(this);
      }
      this.executionDepth--;
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

  /** Includes a PHP file. */
  public async include(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
    const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
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

  /** Includes a PHP file if not already included. */
  public async includeOnce(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
    const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
    if (this.includedFiles.has(normPath)) {
      return true;
    }
    return await this.include(filepath);
  }

  public async runShutdownFunctions(): Promise<void> {
    const shutdownFunctions = this.getInternalVar("shutdownFunctions");
    if (Array.isArray(shutdownFunctions)) {
      this.setInternalVar("shutdownFunctions", []);
      for (const fnObj of shutdownFunctions) {
        try {
          const { callback, args } = fnObj;
          const callArgs = (args || []).map((a: any) => (a && typeof a === "object" && typeof a.get === "function" ? a : new PHPLiteral(a)));
          if (typeof callback === "function") {
            await callback.apply(this, [this, ...callArgs]);
          } else if (typeof callback === "string") {
            await this.callFunction(callback, callArgs);
          } else if (Array.isArray(callback) && callback.length === 2) {
            const obj = callback[0] && typeof callback[0] === "object" && typeof callback[0].get === "function" ? callback[0].get() : callback[0];
            const m = callback[1] && typeof callback[1] === "object" && typeof callback[1].get === "function" ? callback[1].get() : callback[1];
            if (typeof obj === "string") {
              await this.callStaticMethod(obj, String(m), callArgs);
            } else {
              await this.callMethod(obj, String(m), callArgs);
            }
          }
        } catch (e) {
          if (e instanceof PHPExit || (e as any)?.name === "PHPExit") break;
        }
      }
    }
  }

  /** Requires a PHP file. */
  public async require(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
    const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
    this.executionDepth++;
    const isTopLevel = this.executionDepth === 1;
    this.includedFiles.add(normPath);

    logDebug(`REQ: ${path.basename(resolvedPath)}`);
    if (!(await this.fileExists(resolvedPath))) {
      this.executionDepth--;
      throw new PHPFatalError(`Fatal error: require(${filepath}): Failed opening required '${filepath}'`);
    }
    const compiledFunc = await this.engine.compileFile(resolvedPath);
    try {
      const res = await compiledFunc(this);
      return res;
    } finally {
      if (isTopLevel) {
        await this.runShutdownFunctions();
        this.outputBuffer.flushAll(this);
      }
      this.executionDepth--;
      logDebug(`DONE_REQ: ${path.basename(resolvedPath)}`);
    }
  }

  /** Requires a PHP file if not already required. */
  public async requireOnce(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
    const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
    if (this.includedFiles.has(normPath)) {
      return true;
    }
    return await this.require(filepath);
  }

  /** Helper to create an engine, context, and execute a file. */
  public static async runFile(
    filepath: string,
    options: PHPContextOptions = {}
  ): Promise<PHPContext> {
    const engine = new PHPEngine();
    const ctx = engine.createContext(options);
    await ctx.require(filepath);
    return ctx;
  }

  /** Helper to create an engine, context, and execute inline PHP code. */
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
