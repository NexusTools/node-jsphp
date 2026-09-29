import { SourceMapRegistry, PHPLineLocation } from "./SourceMapRegistry";

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

    if (this.stack) {
      this.stack = PHPError.virtualizeJSStack(this.stack, file, line, trace);
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

      const matchAnon = line.match(/<anonymous>:(\d+):(\d+)/);
      if (matchAnon) {
        const jsLine = parseInt(matchAnon[1], 10);
        const loc = SourceMapRegistry.lookup(null, jsLine);
        if (loc) {
          let funcName = loc.function || "";
          if (!funcName) {
            const funcMatch = line.match(/(?:__fn_|class_|method_)?([a-zA-Z0-9_]+)/);
            funcName = funcMatch ? funcMatch[1] : "";
          }
          if (!funcName || funcName === "exports" || funcName === "module" || funcName === "async") {
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
        formattedFrames.push(`    #${frameIdx++} ${file}:${lineNum}: [INTERNAL]`);
        continue;
      }

      formattedFrames.push(`    #${frameIdx++} [INTERNAL]:0: [INTERNAL]`);
    }

    if (formattedFrames.length === 0) {
      formattedFrames.push(`    #0 ${phpFile}:${phpLine}: [INTERNAL]`);
    }

    return `${header}\nStack trace:\n${formattedFrames.join("\n")}`;
  }

  public getPHPStackTraceString(): string {
    return PHPError.virtualizeJSStack(this.stack || "", this.phpFile, this.phpLine, this.phpTrace);
  }
}

export class PHPException extends PHPError {}
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
