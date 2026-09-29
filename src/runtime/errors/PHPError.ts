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
    phpFile: string,
    phpLine: number,
    phpTrace: PHPStackFrame[]
  ): string {
    const lines = jsStack.split("\n");
    const header = lines[0] || "PHP Error";
    const formattedFrames: string[] = [];

    if (phpTrace.length > 0) {
      phpTrace.forEach((frame, idx) => {
        const fileLoc = `${frame.file || "[INTERNAL]"}:${frame.line || 0}`;
        const funcStr = frame.class
          ? `${frame.class}${frame.type || "->"}${frame.function || "main"}`
          : frame.function || "{main}";
        formattedFrames.push(`    #${idx} ${fileLoc}: ${funcStr}()`);
      });
    } else {
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
