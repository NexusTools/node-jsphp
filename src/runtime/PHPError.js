"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorRuntime = exports.ErrorException = exports.PHPExit = exports.PHPWarning = exports.PHPNotice = exports.PHPFatalError = exports.PHPParseError = exports.PHPTypeError = exports.PHPException = exports.PHPError = void 0;
const SourceMapRegistry_1 = require("./SourceMapRegistry");
class PHPError extends Error {
    phpCode;
    phpFile;
    phpLine;
    phpTrace;
    previous;
    rawJSStack = "";
    constructor(message = "", code = 0, file = __filename, line = 0, trace = [], previous = null) {
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
        return this.message ?? this.properties?.get("message") ?? "";
    }
    getCode() {
        return this.phpCode ?? this.properties?.get("code") ?? 0;
    }
    getFile() {
        return this.phpFile;
    }
    getLine() {
        return this.phpLine;
    }
    getPrevious() {
        return this.previous;
    }
    static virtualizeJSStack(jsStack, phpFile = __filename, phpLine = 0, phpTrace = []) {
        const rawLines = (jsStack || "").split("\n");
        const header = rawLines[0] || "PHP Error";
        const formattedFrames = [];
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
            if (!line)
                continue;
            const matchAnon = line.match(/<anonymous>:(\d+):(\d+)/) || line.match(/<eval>:(\d+):(\d+)/);
            if (matchAnon) {
                const jsLine = parseInt(matchAnon[1], 10);
                const funcMatch = line.match(/at\s+(?:async\s+)?(?:PHPContext\.)?(?:__fn_|class_|method_)?([a-zA-Z0-9_]+)/);
                let funcHint = funcMatch ? funcMatch[1] : null;
                if (funcHint === "at" || funcHint === "async" || funcHint === "PHPContext" || funcHint === "callFunction" || funcHint === "callMethod") {
                    funcHint = null;
                }
                const loc = SourceMapRegistry_1.SourceMapRegistry.lookup(funcHint, jsLine);
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
                const jsFunc = line.match(/at\s+(?:async\s+)?([^\s]+)/)?.[1] || "{main}";
                formattedFrames.push(`    #${frameIdx++} ${file}:${lineNum}: ${jsFunc}()`);
                continue;
            }
            // Format pure JS frames like PHP stack frames
            const matchJs = line.match(/at\s+(?:async\s+)?([^\s]+)\s+\((.*?):(\d+):(\d+)\)/) || line.match(/at\s+(?:async\s+)?(.*?):(\d+):(\d+)/);
            if (matchJs) {
                if (matchJs.length === 5) {
                    formattedFrames.push(`    #${frameIdx++} [JS] ${matchJs[2]}:${matchJs[3]}: ${matchJs[1]}()`);
                }
                else {
                    formattedFrames.push(`    #${frameIdx++} [JS] ${matchJs[1]}:${matchJs[2]}: {main}()`);
                }
                continue;
            }
            formattedFrames.push(`    #${frameIdx++} [JS] ${line.replace(/^at\s+/, "")}`);
        }
        if (formattedFrames.length === 0) {
            formattedFrames.push(`    #0 ${phpFile}:${phpLine}: {main}()`);
        }
        return `${header}\nStack trace:\n${formattedFrames.join("\n")}`;
    }
    getPHPStackTraceString() {
        return PHPError.virtualizeJSStack(this.rawJSStack || this.stack || "", this.phpFile, this.phpLine, this.phpTrace);
    }
}
exports.PHPError = PHPError;
class PHPException extends PHPError {
    static phpName = "Exception";
    constructor(message = "", code = 0, previous = null) {
        super(message, code, "[INTERNAL]", 0, [], previous);
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
    constructor(message = "", code = 0, severity = 1, file = "[INTERNAL]", line = 0, previous = null) {
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
    static set_error_handler(ctx, handler, levels = 32767) {
        return ctx.setErrorHandler(handler, levels);
    }
    static restore_error_handler(ctx) {
        return ctx.restoreErrorHandler();
    }
    static async trigger_error(ctx, message, level = 1024) {
        return await ctx.triggerError(message, level);
    }
    static error_reporting(ctx, level) {
        const previous = ctx.errorReportingLevel;
        if (level !== undefined)
            ctx.errorReportingLevel = level;
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
    };
    static register(engine) {
        engine.registerFunctions(ErrorRuntime.functions);
        engine.registerClasses(ErrorRuntime.classes);
    }
}
exports.ErrorRuntime = ErrorRuntime;
//# sourceMappingURL=PHPError.js.map