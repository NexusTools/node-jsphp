import { SourceMapRegistry, PHPLineLocation } from "./SourceMapRegistry";
import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";

export class ErrorRuntime {
  public static register(engine: PHPEngine): void {
    const register = engine.registerFunction.bind(engine);
    register("debug_backtrace", (ctx: PHPContext) => ctx.getPHPBacktrace());
    register("debug_print_backtrace", async (ctx: PHPContext) => {
      const trace = ctx.getPHPBacktrace().map((frame: any, index: number) =>
        `#${index} ${frame.file || "[INTERNAL]"}(${frame.line || 0}): ${frame.function || "{main}"}()\n`
      ).join("");
      await ctx.echo(trace);
      return trace;
    });
    register("set_error_handler", (ctx: PHPContext, handler: any, levels = 32767) => ctx.setErrorHandler(handler, levels));
    register("restore_error_handler", (ctx: PHPContext) => ctx.restoreErrorHandler());
    register("trigger_error", async (ctx: PHPContext, message: string, level = 1024) => ctx.triggerError(message, level));
    register("user_error", async (ctx: PHPContext, message: string, level = 1024) => ctx.triggerError(message, level));
    register("error_reporting", (ctx: PHPContext, level?: number) => {
      const previous = ctx.errorReportingLevel;
      if (level !== undefined) ctx.errorReportingLevel = level;
      return previous;
    });
    engine.registerClass("exception", PHPException);
    engine.registerClass("errorexception", ErrorException);
  }
}

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
    message: string = "",
    code: number = 0,
    file: string = "[INTERNAL]",
    line: number = 0,
    trace: PHPStackFrame[] = [],
    previous: PHPError | null = null
  ) {
    super(message);
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

  public getMessage(): string {
    return this.message;
  }

  public getCode(): number {
    return this.phpCode;
  }

  public getFile(): string {
    return this.phpFile;
  }

  public getLine(): number {
    return this.phpLine;
  }

  public getPrevious(): PHPError | null {
    return this.previous;
  }

  public static virtualizeJSStack(
    jsStack: string,
    phpFile: string = "[INTERNAL]",
    phpLine: number = 0,
    phpTrace: PHPStackFrame[] = []
  ): string {
    const rawLines = (jsStack || "").split("\n");
    const header = rawLines[0] || "PHP Error";
    const formattedFrames: string[] = [];

    if (phpTrace && phpTrace.length > 0) {
      phpTrace.forEach((frame, idx) => {
        const fileLoc = `${frame.file || "[INTERNAL]"}:${frame.line || 0}`;
        const funcStr = frame.class
          ? `${frame.class}${frame.type || "->"}${frame.function || "main"}`
          : frame.function || "{main}";
        formattedFrames.push(`    #${idx} ${fileLoc}: ${funcStr}()`);
      });
      return `${header}\nStack trace:\n${formattedFrames.join("\n")}`;
    }

    let frameIdx = 0;
    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;

      const matchAnon = line.match(/<anonymous>:(\d+):(\d+)/) || line.match(/<eval>:(\d+):(\d+)/);
      if (matchAnon) {
        const jsLine = parseInt(matchAnon[1], 10);
        const funcMatch = line.match(/at\s+(?:async\s+)?(?:PHPContext\.)?(?:__fn_|class_|method_)?([a-zA-Z0-9_]+)/);
        let funcHint = funcMatch ? funcMatch[1] : null;

        if (funcHint === "at" || funcHint === "async" || funcHint === "PHPContext" || funcHint === "callFunction" || funcHint === "callMethod") {
          funcHint = null;
        }

        const loc = SourceMapRegistry.lookup(funcHint, jsLine);
        if (loc) {
          let funcName = loc.function || funcHint || "{main}";
          if (!funcName || funcName === "exports" || funcName === "module" || funcName === "async" || funcName === "at") {
            funcName = "{main}";
          }
          formattedFrames.push(`    #${frameIdx++} ${loc.file}:${loc.line}: ${funcName}()`);
          continue;
        }
      }

      const matchPhp = line.match(/\((.*?\.php):(\d+):(\d+)\)/) || line.match(/at\s+(.*?\.php):(\d+):(\d+)/);
      if (matchPhp) {
        const file = matchPhp[1];
        const lineNum = matchPhp[2];
        formattedFrames.push(`    #${frameIdx++} ${file}:${lineNum}: {main}()`);
        continue;
      }
    }

    if (formattedFrames.length === 0) {
      formattedFrames.push(`    #0 ${phpFile}:${phpLine}: {main}()`);
    }

    return `${header}\nStack trace:\n${formattedFrames.join("\n")}`;
  }

  public getPHPStackTraceString(): string {
    return PHPError.virtualizeJSStack(this.rawJSStack || this.stack || "", this.phpFile, this.phpLine, this.phpTrace);
  }
}

export class PHPException extends PHPError {
  public static phpName = "Exception";

  constructor(message: string = "", code: number = 0, previous: PHPError | null = null) {
    super(message, code, "[INTERNAL]", 0, [], previous);
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
    file: string = "[INTERNAL]",
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
