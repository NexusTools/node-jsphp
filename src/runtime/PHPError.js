import { PHPReference } from "./PHPVariable.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";
export class PHPError extends Error {
    static E_ERROR = 1;
    static E_WARNING = 2;
    static E_PARSE = 4;
    static E_NOTICE = 8;
    static E_CORE_ERROR = 16;
    static E_CORE_WARNING = 32;
    static E_COMPILE_ERROR = 64;
    static E_COMPILE_WARNING = 128;
    static E_USER_ERROR = 256;
    static E_USER_WARNING = 512;
    static E_USER_NOTICE = 1024;
    static E_STRICT = 2048;
    static E_RECOVERABLE_ERROR = 4096;
    static E_DEPRECATED = 8192;
    static E_USER_DEPRECATED = 16384;
    static E_ALL = 32767;
    phpCode;
    phpFile;
    phpLine;
    phpTrace;
    previous;
    rawJSStack = "";
    constructor(messageArg = "", codeArg = 0, fileArg = "", lineArg = 0, traceArg = [], previousArg = null) {
        const message = String(messageArg?.get ? messageArg.get() : (messageArg ?? ""));
        const code = Number(codeArg?.get ? codeArg.get() : (codeArg || 0));
        const file = String(fileArg?.get ? fileArg.get() : (fileArg || ""));
        const line = Number(lineArg?.get ? lineArg.get() : (lineArg || 0));
        const trace = traceArg?.get ? traceArg.get() : (traceArg || []);
        const previous = previousArg?.get ? previousArg.get() : previousArg;
        super(message);
        if (message.includes("Class \"\" not found"))
            console.log("CRITICAL CLASS NOT FOUND STACK:\n", this.stack);
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
    static wrapJSError(err) {
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
    static async __$$__new(ctx, messageArg, codeArg, previousArg) {
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
    async __construct(ctx, messageArg, codeArg, previousArg) {
        const msg = messageArg ? (typeof messageArg.get === "function" ? messageArg.get() : messageArg) : "";
        const code = codeArg ? (typeof codeArg.get === "function" ? codeArg.get() : codeArg) : 0;
        const previous = previousArg ? (typeof previousArg.get === "function" ? previousArg.get() : previousArg) : null;
        this.message = String(msg ?? "");
        this.phpCode = Number(code || 0);
        this.previous = previous;
    }
    getMessage() {
        return this.message || this.properties?.get("message") || "";
    }
    getmessage() { return this.getMessage(); }
    getCode() {
        return this.phpCode || this.properties?.get("code") || 0;
    }
    getcode() { return this.getCode(); }
    getFile() {
        return this.phpFile || this.properties?.get("file") || "";
    }
    getfile() { return this.getFile(); }
    getLine() {
        return this.phpLine || this.properties?.get("line") || 0;
    }
    getline() { return this.getLine(); }
    getPrevious() {
        return this.previous || this.properties?.get("previous") || null;
    }
    getprevious() { return this.getPrevious(); }
    gettrace() { return this.phpTrace || []; }
    gettraceasstring() { return this.getPHPStackTraceString(); }
    static virtualizeJSStack(jsStack, phpFile = "", phpLine = 0, phpTrace = []) {
        const rawLines = (jsStack || "").split("\n");
        let header = rawLines[0] || "PHP Error";
        header = header.replace(/^PHPFatalError:/, "PHP Fatal Error:");
        const formattedFrames = [];
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
            if (!line)
                continue;
            if (line.includes("PHPContext.") || line.includes("PHPContext.ts") || line.includes("PHPContext.js") || line.includes("PHPEngine.") || line.includes("php-http-server") || line.includes("node:internal"))
                continue;
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
    getPHPStackTraceString() {
        return PHPError.virtualizeJSStack(this.rawJSStack || this.stack || "", this.phpFile, this.phpLine, this.phpTrace);
    }
}
export class PHPException extends PHPError {
    static [SYMBOL_PHP_NAME] = "Exception";
    constructor(messageArg = "", codeArg = 0, previousArg = null) {
        super(messageArg, codeArg, "", 0, [], previousArg);
    }
}
export class InvalidArgumentException extends PHPException {
    static [SYMBOL_PHP_NAME] = "InvalidArgumentException";
}
export class BadMethodCallException extends PHPException {
    static [SYMBOL_PHP_NAME] = "BadMethodCallException";
}
export class DomainException extends PHPException {
    static [SYMBOL_PHP_NAME] = "DomainException";
}
export class LengthException extends PHPException {
    static [SYMBOL_PHP_NAME] = "LengthException";
}
export class LogicException extends PHPException {
    static [SYMBOL_PHP_NAME] = "LogicException";
}
export class OutOfRangeException extends PHPException {
    static [SYMBOL_PHP_NAME] = "OutOfRangeException";
}
export class OverflowException extends PHPException {
    static [SYMBOL_PHP_NAME] = "OverflowException";
}
export class RangeException extends PHPException {
    static [SYMBOL_PHP_NAME] = "RangeException";
}
export class RuntimeException extends PHPException {
    static [SYMBOL_PHP_NAME] = "RuntimeException";
}
export class UnderflowException extends PHPException {
    static [SYMBOL_PHP_NAME] = "UnderflowException";
}
export class UnexpectedValueException extends PHPException {
    static [SYMBOL_PHP_NAME] = "UnexpectedValueException";
}
export class ErrorException extends PHPError {
    static [SYMBOL_PHP_NAME] = "ErrorException";
    severity = 1;
    constructor(message = "", code = 0, severity = 1, file = "", line = 0, previous = null) {
        super(message, code, file, line, [], previous);
        this.severity = severity;
    }
    async __construct(ctx, messageArg, codeArg, severityArg, fileArg, lineArg, previousArg) {
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
    getSeverity() { return this.severity; }
    getseverity() { return this.getSeverity(); }
}
export class PHPTypeError extends PHPError {
    static [SYMBOL_PHP_NAME] = "TypeError";
}
export class PHPParseError extends PHPError {
    static [SYMBOL_PHP_NAME] = "ParseError";
}
export class PHPFatalError extends PHPError {
    static [SYMBOL_PHP_NAME] = "Error";
}
export class PHPNotice extends PHPError {
    static [SYMBOL_PHP_NAME] = "Notice";
}
export class PHPWarning extends PHPError {
    static [SYMBOL_PHP_NAME] = "Warning";
}
export class PHPExit extends PHPError {
    status;
    constructor(status = 0) {
        super(`PHP Exit with status ${status}`);
        this.status = status;
    }
}
export class ErrorRuntime {
    static debug_backtrace(ctx) {
        return ctx.getPHPBacktrace();
    }
    static async debug_print_backtrace(ctx) {
        const trace = ctx.getPHPBacktrace().map((frame, index) => `#${index} ${frame.file || __filename}(${frame.line || 0}): ${frame.function || "{main}"}()\n`).join("");
        await ctx.echo(trace);
        return trace;
    }
    static set_error_handler(ctx, handlerArg, levelsArg = PHPError.E_ALL) {
        const handler = handlerArg instanceof PHPReference ? handlerArg.get() : handlerArg;
        const levels = levelsArg instanceof PHPReference ? levelsArg.get() : levelsArg;
        return ctx.setErrorHandler(handler, levels !== undefined ? Number(levels) : PHPError.E_ALL);
    }
    static restore_error_handler(ctx) {
        return ctx.restoreErrorHandler();
    }
    static async trigger_error(ctx, messageArg, levelArg = PHPError.E_USER_NOTICE) {
        const message = messageArg instanceof PHPReference ? messageArg.get() : messageArg;
        const level = levelArg instanceof PHPReference ? levelArg.get() : levelArg;
        return await ctx.triggerError(String(message ?? ""), level !== undefined ? Number(level) : PHPError.E_USER_NOTICE);
    }
    static error_reporting(ctx, levelArg) {
        const level = levelArg instanceof PHPReference ? levelArg.get() : levelArg;
        const previous = ctx.errorReportingLevel;
        if (level !== undefined && level !== null)
            ctx.errorReportingLevel = Number(level);
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
    static register(engine) {
        engine.registerFunctions(ErrorRuntime.functions);
        engine.registerClasses(ErrorRuntime.classes);
    }
}
//# sourceMappingURL=PHPError.js.map