"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorException = exports.PHPExit = exports.PHPWarning = exports.PHPNotice = exports.PHPFatalError = exports.PHPParseError = exports.PHPTypeError = exports.PHPException = exports.PHPError = void 0;
class PHPError extends Error {
    phpCode;
    phpFile;
    phpLine;
    phpTrace;
    previous;
    constructor(message = "", code = 0, file = "[INTERNAL]", line = 0, trace = [], previous = null) {
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
    getMessage() {
        return this.message;
    }
    getCode() {
        return this.phpCode;
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
    static virtualizeJSStack(jsStack, phpFile, phpLine, phpTrace) {
        const lines = jsStack.split("\n");
        const header = lines[0] || "PHP Error";
        const formattedFrames = [];
        if (phpTrace.length > 0) {
            phpTrace.forEach((frame, idx) => {
                const fileLoc = `${frame.file || "[INTERNAL]"}:${frame.line || 0}`;
                const funcStr = frame.class
                    ? `${frame.class}${frame.type || "->"}${frame.function || "main"}`
                    : frame.function || "{main}";
                formattedFrames.push(`    #${idx} ${fileLoc}: ${funcStr}()`);
            });
        }
        else {
            formattedFrames.push(`    #0 ${phpFile}:${phpLine}: [INTERNAL]`);
        }
        return `${header}\nStack trace:\n${formattedFrames.join("\n")}`;
    }
    getPHPStackTraceString() {
        return PHPError.virtualizeJSStack(this.stack || "", this.phpFile, this.phpLine, this.phpTrace);
    }
}
exports.PHPError = PHPError;
class PHPException extends PHPError {
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
//# sourceMappingURL=PHPError.js.map