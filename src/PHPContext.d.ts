import { Writable } from "stream";
import { PHPEngine } from "./PHPEngine";
import { Superglobals, SuperglobalsOptions } from "./runtime/Superglobals";
import { OutputBufferStack } from "./runtime/OutputBuffer";
export declare class PHPReference {
    readonly get: () => any;
    readonly set: (value: any) => void;
    constructor(get: () => any, set: (value: any) => void);
}
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
    /** Sets an HTTP response header. */
    setHeader(name: string, value: string, replace?: boolean): void;
    /** Removes an HTTP response header. */
    removeHeader(name?: string): void;
    /** Gets an HTTP response header value by name. */
    getHeader(name: string): string | undefined;
    /** Gets all formatted HTTP response headers. */
    getHeadersList(): string[];
    /** Sets a Set-Cookie HTTP header. */
    setCookie(name: string, value?: string, expires?: number, path?: string, domain?: string, secure?: boolean, httponly?: boolean, raw?: boolean): void;
}
export declare class PHPContext {
    engine: PHPEngine;
    cwd: string;
    env: Record<string, string>;
    vars: Record<string, any>;
    constants: Record<string, any>;
    functions: Record<string, Function>;
    classes: Record<string, any>;
    internalVars: Record<string, any>;
    private scopes;
    private globalBindings;
    private staticBindings;
    staticVars: Map<string, any>;
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
    currentClassStack: any[];
    get currentClass(): any;
    /**
     * Checks if an object is an instance of a class or interface.
     * @param className Class or interface name in lowercase.
     */
    isInstanceOf(obj: any, className: string): boolean;
    /** Gets virtualized PHP stack trace frames for error handling and backtraces. */
    getPHPBacktrace(): any[];
    /** Sets a user-defined error handler function. */
    setErrorHandler(handler: any, levels?: number): any;
    /** Restores the previous error handler from the stack. */
    restoreErrorHandler(): boolean;
    /** Triggers a userland error or warning. */
    triggerError(message: string, level?: number, file?: string, line?: number): Promise<boolean>;
    /** Gets an internal variable value. */
    getInternalVar(name: string): any;
    /** Sets an internal variable value. */
    setInternalVar(name: string, value: any): void;
    /** Gets response headers as a key-value dictionary. */
    get responseHeaders(): Record<string, string>;
    /** Gets the current HTTP status code. */
    get statusCode(): number;
    /** Flushes response headers to the client. */
    flushHeaders(): void;
    /** Writes output text to stdout or active output buffer. */
    echo(data: any): Promise<void>;
    private writeStdout;
    /**
     * Gets a constant value by lowercase or exact name.
     * @param name Constant name in lowercase or exact key.
     */
    getConstant(name: string): any;
    /**
     * Checks if a constant is defined.
     * @param name Constant name in lowercase or exact key.
     */
    hasConstant(name: string): boolean;
    /**
     * Defines a constant.
     * @param name Constant name in lowercase or exact key.
     */
    defineConstant(name: string, val: any): void;
    /** Gets a variable value from the current or global scope. */
    getVar(name: string): any;
    /** Sets a variable value in the current scope. */
    setVar(name: string, value: any): any;
    /** Binds a variable name to global scope. */
    bindGlobal(name: string): void;
    /** Pushes a new variable scope. */
    pushScope(): void;
    /** Pops the current variable scope. */
    popScope(): void;
    /** Sets a single array offset on a variable. */
    setVarOffset(name: string, key: any, value: any): any;
    /** Sets nested array offsets on a variable. */
    setVarOffsets(name: string, keys: any[], value: any): any;
    private assignOffsets;
    private assignOffset;
    /** Initializes a static variable in function scope. */
    initStaticVar(scope: string, name: string, value: any): void;
    /** Evaluates whether a value is truthy in PHP. */
    isTruthy(val: any): boolean;
    /**
     * Gets a property on an object or array.
     * @param prop Property name in lowercase.
     */
    getProperty(obj: any, prop: string): Promise<any>;
    /**
     * Sets a property on an object or array.
     * @param prop Property name in lowercase.
     */
    setProperty(obj: any, prop: string, value: any): Promise<any>;
    /** Sets a single property offset on an object. */
    setPropertyOffset(obj: any, prop: string, key: any, value: any): Promise<any>;
    /** Sets nested property offsets on an object. */
    setPropertyOffsets(obj: any, prop: string, keys: any[], value: any): Promise<any>;
    /**
     * Calls a method on an object.
     * Expects method name in lowercase.
     * @param method Method name in lowercase.
     */
    callMethod(obj: any, method: string, args?: any[]): Promise<any>;
    /** Gets a PHPReference wrapper for a variable name. */
    getVarRef(name: string): PHPReference;
    /**
     * Calls a global function.
     * Expects function name in lowercase.
     * @param name Function name in lowercase.
     */
    callFunction(name: string, args?: any[], references?: (string | null)[]): Promise<any>;
    /**
     * Resolves a class by lowercase name.
     * @param className Class name in lowercase.
     */
    resolveClass(className: string): Promise<any>;
    /**
     * Gets a static class constant.
     * @param className Class name in lowercase.
     * @param name Constant name in lowercase.
     */
    getClassConstant(className: string, name: string): Promise<any>;
    /**
     * Gets a static class property.
     * @param className Class name in lowercase.
     * @param name Property name in lowercase.
     */
    getStaticProperty(className: string, name: string): Promise<any>;
    /**
     * Sets a static class property.
     * @param className Class name in lowercase.
     * @param name Property name in lowercase.
     */
    setStaticProperty(className: string, name: string, value: any): Promise<any>;
    /** Sets static property array offsets. */
    setStaticPropertyOffsets(className: string, name: string, keys: any[], value: any): Promise<any>;
    /**
     * Calls a static method on a class.
     * @param className Class name in lowercase.
     * @param method Method name in lowercase.
     */
    callStaticMethod(className: string, method: string, args?: any[], targetObj?: any): Promise<any>;
    /**
     * Creates an instance of a class.
     * @param className Class name in lowercase.
     */
    createObject(className: string, args?: any[]): Promise<any>;
    /** Evaluates PHP code in the context. */
    eval(code: string, filepath?: string): Promise<any>;
    private fileExists;
    private normalizeFilePath;
    /** Includes a PHP file. */
    include(filepath: string): Promise<any>;
    /** Includes a PHP file if not already included. */
    includeOnce(filepath: string): Promise<any>;
    /** Requires a PHP file. */
    require(filepath: string): Promise<any>;
    /** Requires a PHP file if not already required. */
    requireOnce(filepath: string): Promise<any>;
    /** Helper to create an engine, context, and execute a file. */
    static runFile(filepath: string, options?: PHPContextOptions): Promise<PHPContext>;
    /** Helper to create an engine, context, and execute inline PHP code. */
    static runCode(code: string, options?: PHPContextOptions): Promise<PHPContext>;
}
