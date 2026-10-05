import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPVariable } from "./PHPVariable.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";

export interface PHPStackFrame {
  file: string;
  line: number;
  function?: string;
  class?: string;
  type?: string;
  args?: any[];
}

export class PHPError extends Error {
  public phpCode: number;
  public phpFile: string;
  public phpLine: number;
  public phpTrace: PHPStackFrame[];
  public previous: PHPError | null;
  public rawJSStack: string = "";

  constructor(
    messageArg: any = "",
    codeArg: any = 0,
    fileArg: any = "",
    lineArg: any = 0,
    traceArg: any = [],
    previousArg: any = null
  ) {
    const message = String(messageArg?.get ? messageArg.get() : (messageArg ?? ""));
    const code = Number(codeArg?.get ? codeArg.get() : (codeArg || 0));
    const file = String(fileArg?.get ? fileArg.get() : (fileArg || ""));
    const line = Number(lineArg?.get ? lineArg.get() : (lineArg || 0));
    const trace = traceArg?.get ? traceArg.get() : (traceArg || []);
    const previous = previousArg?.get ? previousArg.get() : previousArg;

    super(message);
    if (message.includes("Class \"\" not found")) console.log("CRITICAL CLASS NOT FOUND STACK:\n", this.stack);
    this.name = this.constructor.name;
    this.phpCode = code;
    this.phpFile = file;
    this.phpLine = line;
    this.phpTrace = trace;
    this.previous = previous;

    this.rawJSStack = this.stack || "";
    if (this.stack) {
      this.stack = PHPError.virtualizeJSStack(this.rawJSStack, file, line, trace);
    }
  }

  public static wrapJSError(err: any): PHPError {
    if (err instanceof PHPError) {
      return err;
    }
    if (err && typeof err === "object" && typeof err.message === "string") {
      if (err.name === "TypeError") {
        return new PHPTypeError(err.message);
      }
      return new PHPFatalError(err.message);
    }
    return new PHPError(String(err ?? "Unknown error"));
  }

  public async __construct(ctx: any, messageArg?: any, codeArg?: any, previousArg?: any): Promise<void> {
    const msg = messageArg ? (typeof messageArg.get === "function" ? messageArg.get() : messageArg) : "";
    const code = codeArg ? (typeof codeArg.get === "function" ? codeArg.get() : codeArg) : 0;
    this.message = String(msg ?? "");
    this.phpCode = Number(code || 0);
  }

  public getMessage(): string {
    return this.message || (this as any).properties?.get("message") || "";
  }

  public getCode(): number {
    return this.phpCode || (this as any).properties?.get("code") || 0;
  }

  public getFile(): string {
    return this.phpFile || (this as any).properties?.get("file") || "";
  }

  public getLine(): number {
    return this.phpLine || (this as any).properties?.get("line") || 0;
  }

  public getPrevious(): PHPError | null {
    return this.previous || (this as any).properties?.get("previous") || null;
  }

  public static virtualizeJSStack(
    jsStack: string,
    phpFile: string = "",
    phpLine: number = 0,
    phpTrace: PHPStackFrame[] = []
  ): string {
    const rawLines = (jsStack || "").split("\n");
    let header = rawLines[0] || "PHP Error";
    header = header.replace(/^PHPFatalError:/, "PHP Fatal Error:");
    const formattedFrames: string[] = [];

    if (phpTrace && phpTrace.length > 0) {
      phpTrace.forEach((frame, idx) => {
        const fileLoc = `${frame.file || ""}:${frame.line || 0}`;
        const funcStr = frame.class
          ? `${frame.class}${frame.type || "->"}${frame.function || "main"}`
          : frame.function || "{main}";
        formattedFrames.push(`    #${idx} ${fileLoc}: ${funcStr}()`);
      });
      return `${header}\nPHP Stack Trace:\n${formattedFrames.join("\n")}`;
    }

    let frameIdx = 0;
    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;
      if (line.includes("PHPContext.") || line.includes("PHPContext.ts") || line.includes("PHPContext.js") || line.includes("PHPEngine.") || line.includes("php-http-server") || line.includes("node:internal")) continue;

      const matchPhp = line.match(/\((.*?\.php):(\d+):(\d+)\)/) || line.match(/at\s+(.*?\.php):(\d+):(\d+)/) || line.match(/at\s+([^\s]+)\s+\((.*?):(\d+):(\d+)\)/);
      if (matchPhp) {
        const file = matchPhp[2] || matchPhp[1];
        const lineNum = matchPhp[3] || matchPhp[2];
        const jsFunc = matchPhp[1] && matchPhp[2] ? matchPhp[1] : "{main}";
        formattedFrames.push(`    #${frameIdx++} ${file}:${lineNum}: ${jsFunc}()`);
        continue;
      }
    }

    if (formattedFrames.length === 0) {
      formattedFrames.push(`    #0 ${phpFile || ""}:${phpLine || 0}: {main}()`);
    }

    return `${header}\nPHP Stack Trace:\n${formattedFrames.join("\n")}`;
  }

  public getPHPStackTraceString(): string {
    return PHPError.virtualizeJSStack(this.rawJSStack || this.stack || "", this.phpFile, this.phpLine, this.phpTrace);
  }
}

export class PHPException extends PHPError {
  public static phpName = "Exception";
  public static [SYMBOL_PHP_NAME] = "Exception";

  constructor(messageArg: any = "", codeArg: any = 0, previousArg: any = null) {
    super(messageArg, codeArg, "", 0, [], previousArg);
  }
}
export class PHPTypeError extends PHPError {}
export class PHPParseError extends PHPError {}
export class PHPFatalError extends PHPError {}
export class PHPNotice extends PHPError {}
export class PHPWarning extends PHPError {}

export class PHPExit extends PHPError {
  public status: any;

  constructor(status: any = 0) {
    super(`PHP Exit with status ${status}`);
    this.status = status;
  }
}

export class ErrorException extends PHPError {
  public severity: number;

  constructor(
    message: string = "",
    code: number = 0,
    severity: number = 1,
    file: string = "",
    line: number = 0,
    previous: PHPError | null = null
  ) {
    super(message, code, file, line, [], previous);
    this.severity = severity;
  }

  public getSeverity(): number {
    return this.severity;
  }
}

export class ErrorRuntime {
  public static debug_backtrace(ctx: PHPContext): any {
    return ctx.getPHPBacktrace();
  }

  public static async debug_print_backtrace(ctx: PHPContext): Promise<string> {
    const trace = ctx.getPHPBacktrace().map((frame: any, index: number) =>
      `#${index} ${frame.file || __filename}(${frame.line || 0}): ${frame.function || "{main}"}()\n`
    ).join("");
    await ctx.echo(trace);
    return trace;
  }

  public static set_error_handler(ctx: PHPContext, handlerArg: any, levelsArg: any = 32767): any {
    const handler = handlerArg instanceof PHPVariable ? handlerArg.get() : handlerArg;
    const levels = levelsArg instanceof PHPVariable ? levelsArg.get() : levelsArg;
    return ctx.setErrorHandler(handler, levels !== undefined ? Number(levels) : 32767);
  }

  public static restore_error_handler(ctx: PHPContext): boolean {
    return ctx.restoreErrorHandler();
  }

  public static async trigger_error(ctx: PHPContext, messageArg: any, levelArg: any = 1024): Promise<boolean> {
    const message = messageArg instanceof PHPVariable ? messageArg.get() : messageArg;
    const level = levelArg instanceof PHPVariable ? levelArg.get() : levelArg;
    return await ctx.triggerError(String(message ?? ""), level !== undefined ? Number(level) : 1024);
  }

  public static error_reporting(ctx: PHPContext, levelArg?: any): number {
    const level = levelArg instanceof PHPVariable ? levelArg.get() : levelArg;
    const previous = ctx.errorReportingLevel;
    if (level !== undefined && level !== null) ctx.errorReportingLevel = Number(level);
    return previous;
  }

  static functions = {
    "debug_backtrace": ErrorRuntime.debug_backtrace,
    "debug_print_backtrace": ErrorRuntime.debug_print_backtrace,
    "set_error_handler": ErrorRuntime.set_error_handler,
    "restore_error_handler": ErrorRuntime.restore_error_handler,
    "trigger_error": ErrorRuntime.trigger_error,
    "user_error": ErrorRuntime.trigger_error,
    "error_reporting": ErrorRuntime.error_reporting,
  };

  static classes = {
    "exception": PHPException,
    "errorexception": ErrorException,
    "invalidargumentexception": PHPException,
    "badmethodcallexception": PHPException,
    "domainexception": PHPException,
    "lengthexception": PHPException,
    "logicexception": PHPException,
    "outofrangeexception": PHPException,
    "overflowexception": PHPException,
    "rangeexception": PHPException,
    "runtimeexception": PHPException,
    "underflowexception": PHPException,
    "unexpectedvalueexception": PHPException,
    "error": PHPError,
    "typeerror": PHPTypeError,
    "parseerror": PHPParseError,
    "fatalerror": PHPFatalError,
    "warning": PHPWarning,
    "notice": PHPNotice,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(ErrorRuntime.functions);
    engine.registerClasses(ErrorRuntime.classes);
  }
}
