import * as path from "path";
import * as fs from "fs";
import { Writable } from "stream";
import { PHPEngine } from "./PHPEngine.js";
import { Superglobals, SuperglobalsOptions } from "./runtime/Superglobals.js";
import { OutputBufferStack } from "./runtime/OutputBuffer.js";
import { PHPError, PHPFatalError, PHPTypeError, PHPWarning, PHPNotice, PHPExit } from "./runtime/PHPError.js";
import { PHPVariable, PHPReference, PHPLiteral } from "./runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_CLASS_INTERFACES } from "./runtime/Reflection.js";

function logDebug(msg: string) {
  if (process.env.JSPHP_DEBUG !== "1") return;
  try { fs.appendFileSync(path.resolve(__dirname, "../debug.log"), msg + "\n"); } catch {}
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
  public interfaces: Record<string, any>;
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
  private outputChunks: string[] = [];
  public get outputText(): string {
    return this.outputChunks.join("");
  }
  public get symbols(): Record<string, any> {
    return this.engine.symbols;
  }
  public set outputText(val: string) {
    this.outputChunks = [val];
  }

  public async checkLoop(filepath: string, line: number): Promise<void> {
    this.tickCount = 0;
    await Promise.resolve();
  }

  constructor(engine: PHPEngine, options: PHPContextOptions = {}) {
    this.engine = engine;
    this.constants = Object.create(engine.constants);
    this.functions = Object.create(engine.functions);
    this.classes = Object.create(engine.classes);
    this.interfaces = Object.create((engine as any).interfaces || {});
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

  public close(): void {
    this.classes = {};
    this.functions = {};
    this.vars = {};
    this.scopes = [];
    this.globalBindings = [];
    this.staticBindings = [];
    this.outputBuffer.flushAll(this);
  }
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
    if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return false;
    const lowerName = className.toLowerCase();
    let cls = this.classes[className] || this.classes[lowerName];
    if (cls && typeof cls === "function" && obj instanceof cls) {
      return true;
    }
    if (obj.constructor) {
      if (obj.constructor.name.toLowerCase() === lowerName) return true;
      if ((obj.constructor as any)[SYMBOL_PHP_NAME]?.toLowerCase() === lowerName) return true;
    }
    let target = obj;
    while (target && target !== Object.prototype) {
      if (target.constructor && target.constructor.name.toLowerCase() === lowerName) return true;
      if (target.constructor && (target.constructor as any)[SYMBOL_PHP_NAME]?.toLowerCase() === lowerName) return true;
      const targetIfaces = target[SYMBOL_PHP_CLASS_INTERFACES] || target.constructor?.[SYMBOL_PHP_CLASS_INTERFACES] || target.constructor?.prototype?.[SYMBOL_PHP_CLASS_INTERFACES];
      if (Array.isArray(targetIfaces) && targetIfaces.some((iface: any) => typeof iface?.isSubinterfaceOf === "function" ? iface.isSubinterfaceOf(lowerName) : iface?.name?.toLowerCase() === lowerName)) {
        return true;
      }
      target = Object.getPrototypeOf(target);
    }
    return false;
  }

  /** Gets virtualized PHP stack trace frames for error handling and backtraces. */
  public getPHPBacktrace(): any[] {
    const origLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 15;
    const err = new Error();
    Error.stackTraceLimit = origLimit;
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
  public async triggerError(message: string, level = PHPError.E_USER_NOTICE, file = "", line = 0): Promise<boolean> {
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
          const fn = this.functions[handler.toLowerCase()] || this.functionMissing(handler);
          res = await fn(this, new PHPLiteral(level), new PHPLiteral(message), new PHPLiteral(file), new PHPLiteral(line));
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

  /** Converts a value to a PHP string according to PHP type casting rules (false/null -> "", true -> "1"). */
  public str(v: any): string {
    const val = v instanceof PHPReference ? v.get() : v;
    if (val === false || val === null || val === undefined) return "";
    if (val === true) return "1";
    return String(val);
  }

  /** Writes output text to stdout or active output buffer. */
  public async echo(data: any): Promise<void> {
    const str = String(data ?? "");
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
    if (str) this.outputChunks.push(str);
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
    return Object.hasOwn(this.constants, name) || Object.hasOwn(this.constants, name.toLowerCase()) || Object.hasOwn(this.engine.constants, name) || Object.hasOwn(this.engine.constants, name.toLowerCase());
  }

  /** Defines a constant. */
  public defineConstant(name: string, val: any): void {
    this.constants[name] = val;
    this.constants[name.toLowerCase()] = val;
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
            if (value instanceof PHPReference) {
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
          if (typeof prop === "string") {
            if (["GLOBALS", "_GET", "_POST", "_SERVER", "_COOKIE", "_FILES", "_ENV", "_REQUEST", "_SESSION"].includes(prop)) {
              return true;
            }
            return prop in target;
          }
          return Reflect.has(target, prop);
        },
        deleteProperty: (target, prop) => {
          if (typeof prop === "string") {
            delete target[prop];
            return true;
          }
          return Reflect.deleteProperty(target, prop);
        },
        ownKeys: (target) => {
          const keys = new Set(Object.keys(target));
          keys.add("GLOBALS");
          keys.add("_GET");
          keys.add("_POST");
          keys.add("_SERVER");
          keys.add("_COOKIE");
          keys.add("_FILES");
          keys.add("_ENV");
          keys.add("_REQUEST");
          keys.add("_SESSION");
          return Array.from(keys);
        },
        getOwnPropertyDescriptor: (target, prop) => {
          if (typeof prop === "string") {
            if (prop === "GLOBALS") {
              return { enumerable: true, configurable: true, writable: true, value: this.globalsProxy };
            }
            if (["_GET", "_POST", "_SERVER", "_COOKIE", "_FILES", "_ENV", "_REQUEST", "_SESSION"].includes(prop)) {
              return { enumerable: true, configurable: true, writable: true, value: this.getGlobalPHPVar(prop).get() };
            }
            if (prop in target) {
              return { enumerable: true, configurable: true, writable: true, value: this.getGlobalPHPVar(prop).get() };
            }
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
    if (value instanceof PHPReference) {
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

  /** Sets global variable offsets. */
  public setGlobalVar(name: string, keys: any[], value: any): any {
    this.bindGlobal(name);
    return this.setVarOffsets(name, keys, value);
  }

  /** Sets nested array offsets on a variable. */
  public setVarOffsets(name: string, keys: any[], value: any): any {
    const cleanKeys = keys.map((k) => (k instanceof PHPReference ? k.get() : k));
    if (!cleanKeys || cleanKeys.length === 0) {
      return this.setVar(name, value);
    }
    const phpVar = this.getPHPVar(name);
    let target = phpVar.get();
    if (target !== undefined && target !== null && typeof target !== "object") {
      throw new PHPTypeError("Cannot use a scalar value as an array");
    }
    if (target === undefined || target === null) {
      const firstKey = cleanKeys[0];
      target = (firstKey === null || typeof firstKey === "number" || /^(0|[1-9]\d*)$/.test(String(firstKey))) ? [] : {};
      phpVar.set(target);
      target = phpVar.get();
    }
    const res = this.assignOffsets(target, cleanKeys, value);
    phpVar.set(target);
    return res;
  }

  /** Unsets nested array offsets on a variable. */
  public unsetVarOffsets(name: string, keys: any[]): void {
    const cleanKeys = keys.map((k) => (k instanceof PHPReference ? k.get() : k));
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
    const cleanKeys = keys.map((k) => (k instanceof PHPReference ? k.get() : k));
    let target = this.getVar(name);
    for (const key of cleanKeys) {
      if (target === undefined || target === null) return undefined;
      target = target[key];
      if (target instanceof PHPReference) {
        target = target.get();
      }
    }
    return target;
  }

  private assignOffsets(target: any, keys: any[], value: any): any {
    const cleanKeys = keys.map((k) => (k instanceof PHPReference ? k.get() : k));
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
        if (target instanceof PHPReference) {
          target = target.get();
        }
      }
    }
    return this.assignOffset(target, cleanKeys[cleanKeys.length - 1], value);
  }

  private assignOffset(target: any, key: any, value: any): any {
    if (key instanceof PHPReference) key = key.get();
    if (!target || (typeof target !== "object" && typeof target !== "function")) {
      target = [];
    }
    if (key === null) {
      if (Array.isArray(target)) {
        key = target.length;
      } else {
        let maxKey = -1;
        for (const k in target) {
          const num = Number(k);
          if (num >= 0 && Number.isInteger(num) && String(num) === k) {
            if (num > maxKey) maxKey = num;
          }
        }
        key = maxKey + 1;
      }
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
    if (this.staticBindings.length > 0) {
      this.staticBindings[this.staticBindings.length - 1].add(key);
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
    if (obj instanceof PHPReference) obj = obj.get();
    if (obj === null || obj === undefined) {
      throw new PHPWarning(`Attempt to read property "${prop.startsWith('$') ? prop.slice(1) : prop}" on null`);
    }

    if (typeof obj === "object" || typeof obj === "function") {
      const p = prop.startsWith("$") ? prop : "$" + prop;
      const nop = prop.startsWith("$") ? prop.slice(1) : prop;
      if (p in obj) {
        const val = obj[p];
        return val instanceof PHPReference ? val.get() : val;
      }
      if (nop in obj && typeof obj[nop] !== "function") {
        const val = obj[nop];
        return val instanceof PHPReference ? val.get() : val;
      }

      if (typeof obj.__get === "function" && !(obj.__gettingProperties instanceof Set ? obj.__gettingProperties.has(prop) : false)) {
        if (!(obj.__gettingProperties instanceof Set)) {
          Object.defineProperty(obj, "__gettingProperties", { value: new Set(), writable: true, enumerable: false, configurable: true });
        }
        obj.__gettingProperties.add(prop);
        try {
          return await obj.__get(this, new PHPLiteral(prop.startsWith('$') ? prop.slice(1) : prop));
        } finally {
          obj.__gettingProperties.delete(prop);
        }
      }
    }
    await this.triggerError(`Undefined property: ${obj?.[SYMBOL_PHP_NAME] ?? obj?.constructor?.[SYMBOL_PHP_NAME] ?? obj?.constructor?.name ?? "Unknown"}::$${prop.startsWith('$') ? prop.slice(1) : prop}`, PHPError.E_NOTICE);
    return null;
  }

  /**
   * Sets a property on an object or array.
   * @param prop Property name in lowercase.
   */
  public async setProperty(obj: any, prop: string, value: any): Promise<any> {
    if (obj instanceof PHPReference) obj = obj.get();
    if (obj === null || obj === undefined) {
      throw new PHPWarning(`Attempt to assign property "${prop.startsWith('$') ? prop.slice(1) : prop}" on null`);
    }

    if (typeof obj === "object" || typeof obj === "function") {
      const p = prop.startsWith("$") ? prop : "$" + prop;
      const nop = prop.startsWith("$") ? prop.slice(1) : prop;

      if (!(p in obj) && !(nop in obj && typeof obj[nop] !== "function") && typeof obj.__set === "function" && !(obj.__settingProperties instanceof Set ? obj.__settingProperties.has(prop) : false)) {
        if (!(obj.__settingProperties instanceof Set)) {
          Object.defineProperty(obj, "__settingProperties", { value: new Set(), writable: true, enumerable: false, configurable: true });
        }
        obj.__settingProperties.add(prop);
        try {
          await obj.__set(this, new PHPLiteral(prop.startsWith('$') ? prop.slice(1) : prop), new PHPLiteral(value));
          return value;
        } finally {
          obj.__settingProperties.delete(prop);
        }
      }
      if (p in obj && obj[p] instanceof PHPReference) {
        obj[p].set(value);
      } else if (nop in obj && typeof obj[nop] !== "function" && obj[nop] instanceof PHPReference) {
        obj[nop].set(value);
      } else if (nop in obj && typeof obj[nop] !== "function") {
        obj[nop] = value;
      } else {
        obj[p] = value;
      }
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
    const res = this.assignOffsets(target, keys, value);
    await this.setProperty(obj, prop, target);
    return res;
  }

  /** Gets nested property offsets on an object. */
  public async getPropertyOffsets(obj: any, prop: string, keys: any[]): Promise<any> {
    let target = await this.getProperty(obj, prop);
    const cleanKeys = keys.map((k) => (k instanceof PHPReference ? k.get() : k));
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
    const cleanKeys = keys.map((k) => (k instanceof PHPReference ? k.get() : k));
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
  public functionMissing(name: string): Function {
    return () => {
      throw new PHPFatalError(`Call to undefined function ${name}()`);
    };
  }

  public methodMissing(obj: any, method: string): any {
    const className = obj?.[SYMBOL_PHP_NAME] || obj?.constructor?.[SYMBOL_PHP_NAME] || (obj?.name && obj.name !== "Function" ? obj.name : null) || (obj?.constructor?.name && obj.constructor.name !== "Function" ? obj.constructor.name : "Unknown");
    throw new PHPFatalError(`Call to undefined method ${className}::${method}()`);
  }

  /** Gets a PHPReference wrapper for a variable name. */
  public getVarRef(name: string): PHPReference {
    return this.getPHPVar(name);
  }

  /**
   * Resolves a class by lowercase name.
   * @param className Class name in lowercase.
   * @param originalName Class name in original casing.
   */
  public async resolveMissingClass(className: string, originalName?: string): Promise<any> {
    const orig = originalName || className;
    const lower = className.toLowerCase();
    let cls = this.interfaces[lower] || this.engine.interfaces[lower] || await this.engine.resolveClass(lower, orig, this);
    if (!cls && (lower.endsWith("exception") || lower.endsWith("error"))) {
      cls = this.classes["exception"] || this.classes["error"] || this.engine.classes["exception"] || this.engine.classes["error"];
    }
    if (!cls) {
      throw new PHPFatalError(`Class "${orig}" not found`);
    }
    return cls;
  }

  public async resolveClass(className: string, originalName?: string): Promise<any> {
    const lower = className.toLowerCase();
    const orig = originalName || (className !== lower ? className : (className.charAt(0).toUpperCase() + className.slice(1)));
    return this.classes[className] || this.classes[lower] || await this.resolveMissingClass(lower, orig);
  }

  /**
   * Gets a static class constant.
   * @param className Class name in lowercase.
   * @param name Constant name in lowercase.
   * @param originalClassName Class name in original casing.
   */
  public async getClassConstant(className: string, name: string, originalClassName?: string): Promise<any> {
    const origClass = originalClassName || className;
    let resolvedClass: any | undefined = await this.resolveClass(className, origClass);
    if (!resolvedClass) throw new PHPFatalError(`Class "${origClass}" not found`);
    const lowerName = name.toLowerCase();
    while (resolvedClass) {
      if (resolvedClass.__php_constants && resolvedClass.__php_constants.has(lowerName)) {
        return resolvedClass.__php_constants.get(lowerName);
      }
      if (resolvedClass.constants && resolvedClass.constants.has(lowerName)) {
        return resolvedClass.constants.get(lowerName);
      }
      resolvedClass = resolvedClass.__php_parent || resolvedClass.parentClass;
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
    const cleanName = (name.startsWith("$") ? name.slice(1) : name);
    const lowerClean = cleanName.toLowerCase();
    while (resolvedClass) {
      for (const k of Object.keys(resolvedClass)) {
        const kClean = k.startsWith("$") ? k.slice(1) : k;
        if (kClean.toLowerCase() === lowerClean) {
          const val = resolvedClass[k];
          return val instanceof PHPReference ? val.get() : val;
        }
      }
      resolvedClass = resolvedClass.__php_parent || resolvedClass.parentClass;
    }
    throw new PHPFatalError(`Access to undeclared static property ${className}::$${cleanName}`);
  }

  /**
   * Sets a static class property.
   * @param className Class name in lowercase.
   * @param name Property name in lowercase.
   */
  public async setStaticProperty(className: string, name: string, value: any): Promise<any> {
    let resolvedClass = await this.resolveClass(className);
    if (!resolvedClass) throw new PHPFatalError(`Class "${className}" not found`);
    const cleanName = (name.startsWith("$") ? name.slice(1) : name);
    const lowerClean = cleanName.toLowerCase();
    let currentClass = resolvedClass;
    while (currentClass) {
      for (const k of Object.keys(currentClass)) {
        const kClean = k.startsWith("$") ? k.slice(1) : k;
        if (kClean.toLowerCase() === lowerClean) {
          const target = currentClass[k];
          if (target instanceof PHPReference) {
            target.set(value);
          } else {
            currentClass[k] = value;
          }
          return value;
        }
      }
      currentClass = currentClass.__php_parent || currentClass.parentClass;
    }
    resolvedClass["$" + cleanName] = new PHPVariable(value);
    return value;
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
    if (rawClass && typeof rawClass === "function") {
      if (typeof (rawClass as any).__$$__new === "function") {
        return await (rawClass as any).__$$__new(this, ...callArgs);
      }
      const obj = new (rawClass as any)(...callArgs);
      logDebug(`DONE_NEW: ${className}`);
      return obj;
    }

    throw new PHPFatalError(`Class "${origClass}" not found or is not instantiable`);
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

  private fileExists(filepath: string): boolean {
    return fs.existsSync(filepath);
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
    if (!this.fileExists(resolvedPath)) {
      await this.triggerError(`include(${filepath}): Failed to open stream: No such file or directory`, PHPError.E_WARNING);
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
            const fn = this.functions[callback.toLowerCase()] || this.functionMissing(callback);
            await fn(this, ...callArgs);
          } else if (Array.isArray(callback) && callback.length === 2) {
            const obj = callback[0] && typeof callback[0] === "object" && typeof callback[0].get === "function" ? callback[0].get() : callback[0];
            const m = String(callback[1] && typeof callback[1] === "object" && typeof callback[1].get === "function" ? callback[1].get() : callback[1]).toLowerCase();
            if (typeof obj === "string") {
              const cls = this.classes[obj.toLowerCase()] ?? (await this.resolveMissingClass(obj.toLowerCase()));
              if (cls && typeof cls[m] === "function") {
                await cls[m](this, ...callArgs);
              }
            } else if (obj && typeof obj[m] === "function") {
              await obj[m](this, ...callArgs);
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
    if (!this.fileExists(resolvedPath)) {
      this.executionDepth--;
      throw new PHPFatalError(`Fatal error: require(${filepath}): Failed opening required '${filepath}'`);
    }
    const compiledFunc = await this.engine.compileFile(resolvedPath);
    try {
      if (process.env.JSPHP_DEBUG === "1") console.log(`[EXEC ${this.executionDepth}] ${path.basename(resolvedPath)} - ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      const res = await compiledFunc(this);
      return res;
    } finally {
      if (process.env.JSPHP_DEBUG === "1") console.log(`[DONE ${this.executionDepth}] ${path.basename(resolvedPath)}`);
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

  private cleanupTasks: Array<() => Promise<void> | void> = [];

  public registerCleanup(task: () => Promise<void> | void): void {
    this.cleanupTasks.push(task);
  }

  /** Cleans up references to allow garbage collection of this context. */
  public async destroy(): Promise<void> {
    for (const task of this.cleanupTasks) {
      try {
        await task();
      } catch (e) {}
    }
    this.cleanupTasks = [];
    this.engine.contexts.delete(this);
    this.vars = {};
    this.constants = Object.create(null);
    this.functions = Object.create(null);
    this.classes = Object.create(null);
    this.interfaces = Object.create(null);
    this.scopes = [];
    this.globalBindings = [];
    this.staticBindings = [];
    this.internalVars = {};
    this.errorHandlerStack = [];
    this.includedFiles.clear();
    this.outputChunks = [];
  }
}
