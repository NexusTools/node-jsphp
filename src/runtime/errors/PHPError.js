"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorException = exports.PHPExit = exports.PHPWarning = exports.PHPNotice = exports.PHPFatalError = exports.PHPParseError = exports.PHPTypeError = exports.PHPException = exports.PHPError = void 0;
const SourceMapRegistry_1 = require("./SourceMapRegistry");
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
    static virtualizeJSStack(jsStack, phpFile = "[INTERNAL]", phpLine = 0, phpTrace = []) {
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
            const matchAnon = line.match(/<anonymous>:(\d+):(\d+)/);
            if (matchAnon) {
                const jsLine = parseInt(matchAnon[1], 10);
                const loc = SourceMapRegistry_1.SourceMapRegistry.lookup(null, jsLine);
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