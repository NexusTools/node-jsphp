import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";
export interface PHPStackFrame {
    file: string;
    line: number;
    function?: string;
    class?: string;
    type?: string;
    args?: any[];
}
export declare class PHPError extends Error {
    static readonly E_ERROR = 1;
    static readonly E_WARNING = 2;
    static readonly E_PARSE = 4;
    static readonly E_NOTICE = 8;
    static readonly E_CORE_ERROR = 16;
    static readonly E_CORE_WARNING = 32;
    static readonly E_COMPILE_ERROR = 64;
    static readonly E_COMPILE_WARNING = 128;
    static readonly E_USER_ERROR = 256;
    static readonly E_USER_WARNING = 512;
    static readonly E_USER_NOTICE = 1024;
    static readonly E_STRICT = 2048;
    static readonly E_RECOVERABLE_ERROR = 4096;
    static readonly E_DEPRECATED = 8192;
    static readonly E_USER_DEPRECATED = 16384;
    static readonly E_ALL = 32767;
    phpCode: number;
    phpFile: string;
    phpLine: number;
    phpTrace: PHPStackFrame[];
    previous: PHPError | null;
    rawJSStack: string;
    constructor(messageArg?: any, codeArg?: any, fileArg?: any, lineArg?: any, traceArg?: any, previousArg?: any);
    static wrapJSError(err: any): PHPError;
    static __$$__new(ctx: any, messageArg?: any, codeArg?: any, previousArg?: any): Promise<PHPError>;
    __construct(ctx: any, messageArg?: any, codeArg?: any, previousArg?: any): Promise<void>;
    getMessage(): string;
    getmessage(): string;
    getCode(): number;
    getcode(): number;
    getFile(): string;
    getfile(): string;
    getLine(): number;
    getline(): number;
    getPrevious(): PHPError | null;
    getprevious(): PHPError | null;
    gettrace(): PHPStackFrame[];
    gettraceasstring(): string;
    static virtualizeJSStack(jsStack: string, phpFile?: string, phpLine?: number, phpTrace?: PHPStackFrame[]): string;
    getPHPStackTraceString(): string;
}
export declare class PHPException extends PHPError {
    static [SYMBOL_PHP_NAME]: string;
    constructor(messageArg?: any, codeArg?: any, previousArg?: any);
}
export declare class InvalidArgumentException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class BadMethodCallException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class DomainException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class LengthException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class LogicException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class OutOfRangeException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class OverflowException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class RangeException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class RuntimeException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class UnderflowException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class UnexpectedValueException extends PHPException {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class ErrorException extends PHPError {
    static [SYMBOL_PHP_NAME]: string;
    severity: number;
    constructor(message?: string, code?: number, severity?: number, file?: string, line?: number, previous?: any);
    __construct(ctx: any, messageArg?: any, codeArg?: any, severityArg?: any, fileArg?: any, lineArg?: any, previousArg?: any): Promise<void>;
    getSeverity(): number;
    getseverity(): number;
}
export declare class PHPTypeError extends PHPError {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class PHPParseError extends PHPError {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class PHPFatalError extends PHPError {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class PHPNotice extends PHPError {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class PHPWarning extends PHPError {
    static [SYMBOL_PHP_NAME]: string;
}
export declare class PHPExit extends PHPError {
    status: any;
    constructor(status?: any);
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
