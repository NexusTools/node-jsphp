import * as path from "path";
import * as fs from "fs";
import { Writable } from "stream";
import { PHPEngine } from "./PHPEngine";
import { Superglobals, SuperglobalsOptions } from "./runtime/superglobals/Superglobals";
import { OutputBufferStack } from "./runtime/output/OutputBuffer";
import { PHPError, PHPFatalError } from "./runtime/errors/PHPError";
import { PHPObject, PHPClass } from "./runtime/objects/PHPObject";

export interface PHPContextOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdout?: Writable | ((data: string) => void);
  stderr?: Writable | ((data: string) => void);
  superglobals?: SuperglobalsOptions;
}

export class PHPContext {
  public engine: PHPEngine;
  public cwd: string;
  public env: Record<string, string>;
  public vars: Record<string, any> = {};
  public superglobals: Superglobals;
  public outputBuffer: OutputBufferStack;
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
  }

  public async echo(data: any): Promise<void> {
    const str = String(data ?? "");
    if (this.outputBuffer.isActive()) {
      this.outputBuffer.write(str);
    } else {
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
    // Return false or undefined gracefully for soft function lookups
    return false;
  }

  public async createObject(className: string, args: any[] = []): Promise<PHPObject> {
    const phpClass = this.engine.classes.get(className.toLowerCase()) || new PHPClass(className);
    const obj = new PHPObject(phpClass);
    const __construct = phpClass.methods.get("__construct");
    if (__construct) {
      await __construct.apply(obj, [this, ...args]);
    }
    return obj;
  }

  public async eval(code: string, filepath: string = "eval"): Promise<any> {
    const compiledFunc = await this.engine.compileCode(code, filepath);
    return await compiledFunc(this);
  }

  public async include(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath)
      ? filepath
      : path.resolve(this.cwd, filepath);
    if (!fs.existsSync(resolvedPath)) {
      await this.echo(`Warning: include(${filepath}): Failed to open stream\n`);
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
    this.includedFiles.add(resolvedPath);
    return await this.include(resolvedPath);
  }

  public async require(filepath: string): Promise<any> {
    const resolvedPath = path.isAbsolute(filepath)
      ? filepath
      : path.resolve(this.cwd, filepath);
    if (!fs.existsSync(resolvedPath)) {
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
