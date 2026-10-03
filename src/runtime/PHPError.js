"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorRuntime = exports.ErrorException = exports.PHPExit = exports.PHPWarning = exports.PHPNotice = exports.PHPFatalError = exports.PHPParseError = exports.PHPTypeError = exports.PHPException = exports.PHPError = void 0;
const PHPVariable_1 = require("./PHPVariable");
class PHPError extends Error {
    phpCode;
    phpFile;
    phpLine;
    phpTrace;
    previous;
    rawJSStack = "";
    constructor(messageArg = "", codeArg = 0, fileArg = __filename, lineArg = 0, traceArg = [], previousArg = null) {
        const message = String(messageArg?.get ? messageArg.get() : (messageArg ?? ""));
        const code = Number(codeArg?.get ? codeArg.get() : (codeArg || 0));
        const file = String(fileArg?.get ? fileArg.get() : (fileArg || __filename));
        const line = Number(lineArg?.get ? lineArg.get() : (lineArg || 0));
        const trace = traceArg?.get ? traceArg.get() : (traceArg || []);
        const previous = previousArg?.get ? previousArg.get() : previousArg;
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
    getMessage() {
        return this.message || this.properties?.get("message") || "";
    }
    getCode() {
        return this.phpCode || this.properties?.get("code") || 0;
    }
    getFile() {
        return this.phpFile || this.properties?.get("file") || "";
    }
    getLine() {
        return this.phpLine || this.properties?.get("line") || 0;
    }
    getPrevious() {
        return this.previous || this.properties?.get("previous") || null;
    }
    static virtualizeJSStack(jsStack, phpFile = __filename, phpLine = 0, phpTrace = []) {
        const rawLines = (jsStack || "").split("\n");
        let header = rawLines[0] || "PHP Error";
        header = header.replace(/^PHPFatalError:/, "PHP Fatal Error:");
        const formattedFrames = [];
        if (phpTrace && phpTrace.length > 0) {
            phpTrace.forEach((frame, idx) => {
                const fileLoc = `${frame.file || "[INTERNAL]"}:${frame.line || 0}`;
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
            formattedFrames.push(`    #0 ${phpFile || "[INTERNAL]"}:${phpLine || 0}: {main}()`);
        }
        return `${header}\nPHP Stack Trace:\n${formattedFrames.join("\n")}`;
    }
    getPHPStackTraceString() {
        return PHPError.virtualizeJSStack(this.rawJSStack || this.stack || "", this.phpFile, this.phpLine, this.phpTrace);
    }
}
exports.PHPError = PHPError;
class PHPException extends PHPError {
    static phpName = "Exception";
    constructor(messageArg = "", codeArg = 0, previousArg = null) {
        super(messageArg, codeArg, __filename, 0, [], previousArg);
    }
}
exports.PHPException = PHPException;
class PHPTypeError extends PHPError {
}
exports.PHPTypeError = PHPTypeError;
class PHPParseError extends PHPError {
}
exports.PHPParseError = PHPParseError;
class PHPFatalError extends PHPError {
}
exports.PHPFatalError = PHPFatalError;
class PHPNotice extends PHPError {
}
exports.PHPNotice = PHPNotice;
class PHPWarning extends PHPError {
}
exports.PHPWarning = PHPWarning;
class PHPExit extends PHPError {
    status;
    constructor(status = 0) {
        super(`PHP Exit with status ${status}`);
        this.status = status;
    }
}
exports.PHPExit = PHPExit;
class ErrorException extends PHPError {
    severity;
    constructor(message = "", code = 0, severity = 1, file = __filename, line = 0, previous = null) {
        super(message, code, file, line, [], previous);
        this.severity = severity;
    }
    getSeverity() {
        return this.severity;
    }
}
exports.ErrorException = ErrorException;
class ErrorRuntime {
    static debug_backtrace(ctx) {
        return ctx.getPHPBacktrace();
    }
    static async debug_print_backtrace(ctx) {
        const trace = ctx.getPHPBacktrace().map((frame, index) => `#${index} ${frame.file || "[INTERNAL]"}(${frame.line || 0}): ${frame.function || "{main}"}()\n`).join("");
        await ctx.echo(trace);
        return trace;
    }
    static set_error_handler(ctx, handlerArg, levelsArg = 32767) {
        const handler = handlerArg instanceof PHPVariable_1.PHPVariable ? handlerArg.get() : handlerArg;
        const levels = levelsArg instanceof PHPVariable_1.PHPVariable ? levelsArg.get() : levelsArg;
        return ctx.setErrorHandler(handler, levels !== undefined ? Number(levels) : 32767);
    }
    static restore_error_handler(ctx) {
        return ctx.restoreErrorHandler();
    }
    static async trigger_error(ctx, messageArg, levelArg = 1024) {
        const message = messageArg instanceof PHPVariable_1.PHPVariable ? messageArg.get() : messageArg;
        const level = levelArg instanceof PHPVariable_1.PHPVariable ? levelArg.get() : levelArg;
        return await ctx.triggerError(String(message ?? ""), level !== undefined ? Number(level) : 1024);
    }
    static error_reporting(ctx, levelArg) {
        const level = levelArg instanceof PHPVariable_1.PHPVariable ? levelArg.get() : levelArg;
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
exports.ErrorRuntime = ErrorRuntime;
//# sourceMappingURL=PHPError.js.map