import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
export interface PHPStackFrame {
    file: string;
    line: number;
    function?: string;
    class?: string;
    type?: string;
    args?: any[];
}
export declare class PHPError extends Error {
    phpCode: number;
    phpFile: string;
    phpLine: number;
    phpTrace: PHPStackFrame[];
    previous: PHPError | null;
    rawJSStack: string;
    constructor(messageArg?: any, codeArg?: any, fileArg?: any, lineArg?: any, traceArg?: any, previousArg?: any);
    getMessage(): string;
    getCode(): number;
    getFile(): string;
    getLine(): number;
    getPrevious(): PHPError | null;
    static virtualizeJSStack(jsStack: string, phpFile?: string, phpLine?: number, phpTrace?: PHPStackFrame[]): string;
    getPHPStackTraceString(): string;
}
export declare class PHPException extends PHPError {
    static phpName: string;
    constructor(messageArg?: any, codeArg?: any, previousArg?: any);
}
export declare class PHPTypeError extends PHPError {
}
export declare class PHPParseError extends PHPError {
}
export declare class PHPFatalError extends PHPError {
}
export declare class PHPNotice extends PHPError {
}
export declare class PHPWarning extends PHPError {
}
export declare class PHPExit extends PHPError {
    status: any;
    constructor(status?: any);
}
export declare class ErrorException extends PHPError {
    severity: number;
    constructor(message?: string, code?: number, severity?: number, file?: string, line?: number, previous?: PHPError | null);
    getSeverity(): number;
}
export declare class ErrorRuntime {
    static debug_backtrace(ctx: PHPContext): any;
    static debug_print_backtrace(ctx: PHPContext): Promise<string>;
    static set_error_handler(ctx: PHPContext, handlerArg: any, levelsArg?: any): any;
    static restore_error_handler(ctx: PHPContext): boolean;
    static trigger_error(ctx: PHPContext, messageArg: any, levelArg?: any): Promise<boolean>;
    static error_reporting(ctx: PHPContext, levelArg?: any): number;
    static functions: {
        debug_backtrace: typeof ErrorRuntime.debug_backtrace;
        debug_print_backtrace: typeof ErrorRuntime.debug_print_backtrace;
        set_error_handler: typeof ErrorRuntime.set_error_handler;
        restore_error_handler: typeof ErrorRuntime.restore_error_handler;
        trigger_error: typeof ErrorRuntime.trigger_error;
        user_error: typeof ErrorRuntime.trigger_error;
        error_reporting: typeof ErrorRuntime.error_reporting;
    };
    static classes: {
        exception: typeof PHPException;
        errorexception: typeof ErrorException;
        invalidargumentexception: typeof PHPException;
        badmethodcallexception: typeof PHPException;
        domainexception: typeof PHPException;
        lengthexception: typeof PHPException;
        logicexception: typeof PHPException;
        outofrangeexception: typeof PHPException;
        overflowexception: typeof PHPException;
        rangeexception: typeof PHPException;
        runtimeexception: typeof PHPException;
        underflowexception: typeof PHPException;
        unexpectedvalueexception: typeof PHPException;
        error: typeof PHPError;
        typeerror: typeof PHPTypeError;
        parseerror: typeof PHPParseError;
        fatalerror: typeof PHPFatalError;
        warning: typeof PHPWarning;
        notice: typeof PHPNotice;
    };
    static register(engine: PHPEngine): void;
}
