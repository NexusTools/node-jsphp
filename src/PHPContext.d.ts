import { Writable } from "stream";
import { PHPEngine } from "./PHPEngine";
import { Superglobals, SuperglobalsOptions } from "./runtime/superglobals/Superglobals";
import { OutputBufferStack } from "./runtime/output/OutputBuffer";
export interface PHPContextOptions {
    cwd?: string;
    env?: Record<string, string>;
    stdout?: Writable | ((data: string) => void);
    stderr?: Writable | ((data: string) => void);
    superglobals?: SuperglobalsOptions;
    errorReporting?: number;
}
export declare class PHPResponse {
    statusCode: number;
    headers: {
        name: string;
        value: string;
    }[];
    headersSent: boolean;
    setHeader(name: string, value: string, replace?: boolean): void;
    removeHeader(name?: string): void;
    getHeader(name: string): string | undefined;
    getHeadersList(): string[];
    setCookie(name: string, value?: string, expires?: number, path?: string, domain?: string, secure?: boolean, httponly?: boolean, raw?: boolean): void;
}
export declare class PHPContext {
    engine: PHPEngine;
    cwd: string;
    env: Record<string, string>;
    vars: Record<string, any>;
    internalVars: Map<string, any>;
    superglobals: Superglobals;
    outputBuffer: OutputBufferStack;
    response: PHPResponse;
    errorHandlerStack: any[];
    errorReportingLevel: number;
    includedFiles: Set<string>;
    private stdout;
    private stderr;
    outputText: string;
    constructor(engine: PHPEngine, options?: PHPContextOptions);
    isInstanceOf(obj: any, className: string): boolean;
    getPHPBacktrace(): any[];
    setErrorHandler(handler: any, levels?: number): any;
    restoreErrorHandler(): boolean;
    triggerError(message: string, level?: number, file?: string, line?: number): Promise<boolean>;
    getInternalVar(name: string): any;
    setInternalVar(name: string, value: any): void;
    get responseHeaders(): Record<string, string>;
    get statusCode(): number;
    flushHeaders(): void;
    echo(data: any): Promise<void>;
    private writeStdout;
    getConstant(name: string): any;
    defineConstant(name: string, val: any): void;
    getVar(name: string): any;
    setVar(name: string, value: any): void;
    getProperty(obj: any, prop: string): Promise<any>;
    setProperty(obj: any, prop: string, value: any): Promise<void>;
    callMethod(obj: any, method: string, args?: any[]): Promise<any>;
    callFunction(name: string, args?: any[]): Promise<any>;
    createObject(className: string, args?: any[]): Promise<any>;
    eval(code: string, filepath?: string): Promise<any>;
    private fileExists;
    include(filepath: string): Promise<any>;
    includeOnce(filepath: string): Promise<any>;
    require(filepath: string): Promise<any>;
    requireOnce(filepath: string): Promise<any>;
    static runFile(filepath: string, options?: PHPContextOptions): Promise<PHPContext>;
    static runCode(code: string, options?: PHPContextOptions): Promise<PHPContext>;
}
