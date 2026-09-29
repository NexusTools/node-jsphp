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
    constructor(message?: string, code?: number, file?: string, line?: number, trace?: PHPStackFrame[], previous?: PHPError | null);
    getMessage(): string;
    getCode(): number;
    getFile(): string;
    getLine(): number;
    getPrevious(): PHPError | null;
    static virtualizeJSStack(jsStack: string, phpFile: string, phpLine: number, phpTrace: PHPStackFrame[]): string;
    getPHPStackTraceString(): string;
}
export declare class PHPException extends PHPError {
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
export declare class ErrorException extends PHPError {
    severity: number;
    constructor(message?: string, code?: number, severity?: number, file?: string, line?: number, previous?: PHPError | null);
    getSeverity(): number;
}
