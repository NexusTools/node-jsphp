import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPReference } from "./PHPVariable.js";
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
  public static readonly E_ERROR = 1;
  public static readonly E_WARNING = 2;
  public static readonly E_PARSE = 4;
  public static readonly E_NOTICE = 8;
  public static readonly E_CORE_ERROR = 16;
  public static readonly E_CORE_WARNING = 32;
  public static readonly E_COMPILE_ERROR = 64;
  public static readonly E_COMPILE_WARNING = 128;
  public static readonly E_USER_ERROR = 256;
  public static readonly E_USER_WARNING = 512;
  public static readonly E_USER_NOTICE = 1024;
  public static readonly E_STRICT = 2048;
  public static readonly E_RECOVERABLE_ERROR = 4096;
  public static readonly E_DEPRECATED = 8192;
  public static readonly E_USER_DEPRECATED = 16384;
  public static readonly E_ALL = 32767;

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

  public static async __$$__new(ctx: any, messageArg?: any, codeArg?: any, previousArg?: any): Promise<PHPError> {
    const obj = Object.create(this.prototype);
    obj.name = this.name;
    obj.phpCode = 0;
    obj.phpFile = ctx?.currentFile || "";
    obj.phpLine = ctx?.currentLine || 0;
    obj.phpTrace = ctx?.getPHPBacktrace ? ctx.getPHPBacktrace() : [];
    obj.previous = null;
    obj.rawJSStack = new Error().stack || "";
    await obj.__construct(ctx, messageArg, codeArg, previousArg);
    if (obj.rawJSStack) {
      obj.stack = PHPError.virtualizeJSStack(obj.rawJSStack, obj.phpFile, obj.phpLine, obj.phpTrace);
    }
    return obj;
  }

  public async __construct(ctx: any, messageArg?: any, codeArg?: any, previousArg?: any): Promise<void> {
    const msg = messageArg ? (typeof messageArg.get === "function" ? messageArg.get() : messageArg) : "";
    const code = codeArg ? (typeof codeArg.get === "function" ? codeArg.get() : codeArg) : 0;
    const previous = previousArg ? (typeof previousArg.get === "function" ? previousArg.get() : previousArg) : null;
    this.message = String(msg ?? "");
    this.phpCode = Number(code || 0);
    this.previous = previous;
  }

  public getMessage(): string {
    return this.message || (this as any).properties?.get("message") || "";
  }
  public getmessage(): string { return this.getMessage(); }

  public getCode(): number {
    return this.phpCode || (this as any).properties?.get("code") || 0;
  }
  public getcode(): number { return this.getCode(); }

  public getFile(): string {
    return this.phpFile || (this as any).properties?.get("file") || "";
  }
  public getfile(): string { return this.getFile(); }

  public getLine(): number {
    return this.phpLine || (this as any).properties?.get("line") || 0;
  }
  public getline(): number { return this.getLine(); }

  public getPrevious(): PHPError | null {
    return this.previous || (this as any).properties?.get("previous") || null;
  }
  public getprevious(): PHPError | null { return this.getPrevious(); }
  public gettrace(): PHPStackFrame[] { return this.phpTrace || []; }
  public gettraceasstring(): string { return this.getPHPStackTraceString(); }

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
  public static [SYMBOL_PHP_NAME] = "Exception";
  constructor(messageArg: any = "", codeArg: any = 0, previousArg: any = null) {
    super(messageArg, codeArg, "", 0, [], previousArg);
  }
}

export class InvalidArgumentException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "InvalidArgumentException";
}

export class BadMethodCallException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "BadMethodCallException";
}

export class DomainException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "DomainException";
}

export class LengthException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "LengthException";
}

export class LogicException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "LogicException";
}

export class OutOfRangeException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "OutOfRangeException";
}

export class OverflowException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "OverflowException";
}

export class RangeException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "RangeException";
}

export class RuntimeException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "RuntimeException";
}

export class UnderflowException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "UnderflowException";
}

export class UnexpectedValueException extends PHPException {
  public static [SYMBOL_PHP_NAME] = "UnexpectedValueException";
}

export class ErrorException extends PHPError {
  public static [SYMBOL_PHP_NAME] = "ErrorException";
  public severity: number = 1;

  constructor(
    message: string = "",
    code: number = 0,
    severity: number = 1,
    file: string = "",
    line: number = 0,
    previous: any = null
  ) {
    super(message, code, file, line, [], previous);
    this.severity = severity;
  }

  public async __construct(ctx: any, messageArg?: any, codeArg?: any, severityArg?: any, fileArg?: any, lineArg?: any, previousArg?: any): Promise<void> {
    const msg = messageArg ? (typeof messageArg.get === "function" ? messageArg.get() : messageArg) : "";
    const code = codeArg ? (typeof codeArg.get === "function" ? codeArg.get() : codeArg) : 0;
    const severity = severityArg ? (typeof severityArg.get === "function" ? severityArg.get() : severityArg) : 1;
    const file = fileArg ? (typeof fileArg.get === "function" ? fileArg.get() : fileArg) : (ctx?.currentFile || "");
    const line = lineArg ? (typeof lineArg.get === "function" ? lineArg.get() : lineArg) : (ctx?.currentLine || 0);
    const previous = previousArg ? (typeof previousArg.get === "function" ? previousArg.get() : previousArg) : null;

    this.message = String(msg ?? "");
    this.phpCode = Number(code || 0);
    this.severity = Number(severity || 1);
    this.phpFile = String(file || "");
    this.phpLine = Number(line || 0);
    this.previous = previous;
  }

  public getSeverity(): number { return this.severity; }
  public getseverity(): number { return this.getSeverity(); }
}

export class PHPTypeError extends PHPError {
  public static [SYMBOL_PHP_NAME] = "TypeError";
}
export class PHPParseError extends PHPError {
  public static [SYMBOL_PHP_NAME] = "ParseError";
}
export class PHPFatalError extends PHPError {
  public static [SYMBOL_PHP_NAME] = "Error";
}
export class PHPNotice extends PHPError {
  public static [SYMBOL_PHP_NAME] = "Notice";
}
export class PHPWarning extends PHPError {
  public static [SYMBOL_PHP_NAME] = "Warning";
}

export class PHPExit extends PHPError {
  public status: any;

  constructor(status: any = 0) {
    super(`PHP Exit with status ${status}`);
    this.status = status;
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

  public static set_error_handler(ctx: PHPContext, handlerArg: any, levelsArg: any = PHPError.E_ALL): any {
    const handler = handlerArg instanceof PHPReference ? handlerArg.get() : handlerArg;
    const levels = levelsArg instanceof PHPReference ? levelsArg.get() : levelsArg;
    return ctx.setErrorHandler(handler, levels !== undefined ? Number(levels) : PHPError.E_ALL);
  }

  public static restore_error_handler(ctx: PHPContext): boolean {
    return ctx.restoreErrorHandler();
  }

  public static async trigger_error(ctx: PHPContext, messageArg: any, levelArg: any = PHPError.E_USER_NOTICE): Promise<boolean> {
    const message = messageArg instanceof PHPReference ? messageArg.get() : messageArg;
    const level = levelArg instanceof PHPReference ? levelArg.get() : levelArg;
    return await ctx.triggerError(String(message ?? ""), level !== undefined ? Number(level) : PHPError.E_USER_NOTICE);
  }

  public static error_reporting(ctx: PHPContext, levelArg?: any): number {
    const level = levelArg instanceof PHPReference ? levelArg.get() : levelArg;
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
