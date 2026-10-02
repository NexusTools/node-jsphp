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

export class PHPReference {
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
  public tickCount: number = 0;
  private stdout: Writable | ((data: string) => void);
  private stderr: Writable | ((data: string) => void);
  public outputText: string = "";

  public checkLoop(filepath: string, line: number) {
    if (this.tickCount === 50001) {
      console.error(`POSSIBLE_INFINITE_LOOP in ${filepath}:${line}`);
    }
    if (this.tickCount > 500000) {
      throw new Error(`Infinite loop detected in ${filepath}:${line}`);
    }
  }

  constructor(engine: PHPEngine, options: PHPContextOptions = {}) {
    this.engine = engine;
    this.constants = Object.create(engine.constants);
    this.functions = Object.create(engine.functions);
    this.classes = Object.create(engine.classes);
    this.internalVars = Object.create(engine.internalVars);
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

  public currentClassStack: any[] = [];
  public get currentClass(): any {
    return this.currentClassStack.length > 0 ? this.currentClassStack[this.currentClassStack.length - 1] : undefined;
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

  /**
   * Gets a constant value by lowercase or exact name.
   * @param name Constant name in lowercase or exact key.
   */
  public getConstant(name: string): any {
    return this.constants[name] ?? this.engine.constants[name];
  }

  public hasConstant(name: string): boolean {
    if (!name || typeof name !== "string") return false;
    return name in this.constants || name in this.engine.constants;
  }

  /**
   * Defines a constant.
   * @param name Constant name in lowercase or exact key.
   */
  public defineConstant(name: string, val: any): void {
    this.constants[name] = val;
  }

  /** Gets a variable value from the current or global scope. */
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

  /** Sets a variable value in the current scope. */
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

  /** Binds a variable name to global scope. */
  public bindGlobal(name: string): void {
    if (this.globalBindings.length > 0) this.globalBindings[this.globalBindings.length - 1].add(name);
  }

  /** Pushes a new variable scope. */
  public pushScope(): void {
    this.scopes.push({});
    this.globalBindings.push(new Set());
    this.staticBindings.push(new Set());
  }

  /** Pops the current variable scope. */
  public popScope(): void {
    this.scopes.pop();
    this.globalBindings.pop();
    this.staticBindings.pop();
  }

  /** Sets a single array offset on a variable. */
  public setVarOffset(name: string, key: any, value: any): any {
    return this.setVarOffsets(name, [key], value);
  }

  /** Sets nested array offsets on a variable. */
  public setVarOffsets(name: string, keys: any[], value: any): any {
    let target = this.getVar(name);
    if (target === undefined || target === null) {
      target = [];
      this.setVar(name, target);
    }
    return this.assignOffsets(target, keys, value);
  }

  /** Unsets nested array offsets on a variable. */
  public unsetVarOffsets(name: string, keys: any[]): void {
    let target = this.getVar(name);
    if (!target || typeof target !== "object") return;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
      if (!target || typeof target !== "object") return;
    }
    delete target[keys[keys.length - 1]];
  }

  /** Gets nested array offsets on a variable. */
  public getVarOffsets(name: string, keys: any[]): any {
    let target = this.getVar(name);
    for (const key of keys) {
      if (target === undefined || target === null) return undefined;
      target = target[key];
    }
    return target;
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

  /** Initializes a static variable in function scope. */
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

  /**
   * Calls a method on an object.
   * Expects method name in lowercase.
   * @param method Method name in lowercase.
   */
  public async callMethod(obj: any, method: string, args: any[] = []): Promise<any> {
    logDebug(`CALL_METHOD: ${obj?.constructor?.name}::${method}`);
    if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return undefined;

    if (typeof obj.callMethod === "function") {
      const res = await obj.callMethod(this, method, args);
      logDebug(`DONE_METHOD: ${obj?.constructor?.name}::${method}`);
      return res;
    }

    const metadata = obj?.phpClass?.methods?.get ? obj.phpClass.methods.get(method) : obj?.phpClass?.methods?.[method];
    if (metadata?.fn) return await metadata.fn.apply(obj, [this, ...args]);

    if (typeof obj[method] === "function") {
      return await obj[method].apply(obj, args);
    }

    let target = obj;
    while (target && target !== Object.prototype) {
      for (const propName of Object.getOwnPropertyNames(target)) {
        if (propName.toLowerCase() === method && typeof obj[propName] === "function") {
          return await obj[propName].apply(obj, args);
        }
      }
      target = Object.getPrototypeOf(target);
    }

    logDebug(`ERR_METHOD: ${obj?.constructor?.name}::${method}`);
    return undefined;
  }

  /** Gets a PHPReference wrapper for a variable name. */
  public getVarRef(name: string): PHPReference {
    const isGlobal = this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name);
    const scope = isGlobal || this.scopes.length === 0 ? this.vars : this.scopes[this.scopes.length - 1];
    if (scope[name] instanceof PHPReference) return scope[name];
    return new PHPReference(() => scope[name], (value: any) => { scope[name] = value; });
  }

  /**
   * Calls a global function.
   * Expects function name in lowercase.
   * @param name Function name in lowercase.
   */
  public async callFunction(name: string, args: any[] = [], references: (string | null)[] = []): Promise<any> {
    logDebug(`CALL_FUNC: ${name}`);
    const fn = this.functions[name] || this.engine.functions[name];
    if (fn) {
      const parameters = (fn as any).phpMeta?.parameters || [];
      const callArguments = args.map((value, index) => parameters[index]?.byref && references[index]
        ? this.getVarRef(references[index]!) : value);
      const res = await fn.apply(this, [this, ...callArguments]);
      logDebug(`DONE_FUNC: ${name}`);
      return res;
    }
    logDebug(`ERR_FUNC: ${name}`);
    throw new PHPFatalError(`Call to undefined function ${name}()`);
  }

  /**
   * Resolves a class by lowercase name.
   * @param className Class name in lowercase.
   * @param originalName Class name in original casing.
   */
  public async resolveClass(className: string, originalName?: string): Promise<any> {
    const orig = originalName || className;
    const lower = className.toLowerCase();
    return this.classes[className] || this.classes[lower] || await this.engine.resolveClass(lower, orig, this);
  }

  /**
   * Gets a static class constant.
   * @param className Class name in lowercase.
   * @param name Constant name in lowercase.
   * @param originalClassName Class name in original casing.
   */
  public async getClassConstant(className: string, name: string, originalClassName?: string): Promise<any> {
    const origClass = originalClassName || className;
    const resolvedClass = await this.resolveClass(className, origClass);
    if (!resolvedClass) throw new PHPFatalError(`Class "${origClass}" not found`);
    if (resolvedClass.constants?.has ? resolvedClass.constants.has(name) : (name in resolvedClass.constants)) {
      return resolvedClass.constants.get ? resolvedClass.constants.get(name) : resolvedClass.constants[name];
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
    const cleanName = name.startsWith("$") ? name.slice(1) : name;
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
    const cleanName = name.startsWith("$") ? name.slice(1) : name;
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
    let cls = this.classes[className];
    if (!cls) cls = await this.engine.resolveClass(className, origClass, this);
    if (!cls) {
      const shortClassName = className.split("\\").pop() || className;
      cls = this.classes[shortClassName];
    }
    if (!cls) throw new PHPFatalError(`Class "${origClass}" not found`);

    const calledClass = cls;
    let targetClass = cls;
    this.currentClassStack.push(calledClass);
    try {
      while (targetClass) {
        if (targetClass.methods && typeof targetClass.methods.get === "function") {
          const metadata = targetClass.methods.get(method) || targetClass.methods.get(method.toLowerCase());
          if (metadata?.fn) return await metadata.fn.apply(targetObj || calledClass, [this, ...args]);
        }
        targetClass = targetClass.parentClass;
      }
      targetClass = cls;
      while (targetClass) {
        if (targetClass.methods && typeof targetClass.methods.get === "function") {
          const callStaticMeta = targetClass.methods.get("__callstatic");
          if (callStaticMeta?.fn) return await callStaticMeta.fn.apply(calledClass, [this, method, args]);
        }
        targetClass = targetClass.parentClass;
      }
      if (cls && typeof cls[method] === "function") return await cls[method](...args);
      if (cls && typeof cls[method.toLowerCase()] === "function") return await cls[method.toLowerCase()](...args);
      if (method.toLowerCase() === "__construct" && typeof cls === "function") {
        const instance = new (cls as any)(...args);
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
    let rawClass = this.classes[className] || this.classes[lowerClass];
    if (!rawClass) {
      rawClass = await this.engine.resolveClass(lowerClass, origClass, this);
    }
    if (!rawClass) {
      const shortClassName = lowerClass.split("\\").pop() || lowerClass;
      rawClass = this.classes[shortClassName];
    }

    if (rawClass && typeof rawClass === "function" && !(rawClass.prototype instanceof PHPObject)) {
      const obj = new (rawClass as any)(...args);
      if (obj instanceof PHPError) Object.defineProperty(obj, "phpClass", { value: new PHPClass(origClass, rawClass) });
      logDebug(`DONE_NEW: ${className}`);
      return obj;
    }
    const phpClass = rawClass instanceof PHPClass ? rawClass : new PHPClass(origClass);
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

  /** Evaluates PHP code in the context. */
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

  /** Requires a PHP file. */
  public async require(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
    const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
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
