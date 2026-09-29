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
}
export declare class PHPContext {
    engine: PHPEngine;
    cwd: string;
    env: Record<string, string>;
    vars: Record<string, any>;
    superglobals: Superglobals;
    outputBuffer: OutputBufferStack;
    includedFiles: Set<string>;
    private stdout;
    private stderr;
    outputText: string;
    constructor(engine: PHPEngine, options?: PHPContextOptions);
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
