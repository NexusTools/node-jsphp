import { PHPExtension } from "./PHPExtension.js";
import { PHPContext, PHPContextOptions } from "./PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference, PHPPropertyReference, PHPArrayOffsetReference } from "./runtime/PHPVariable.js";
import { PHPInterface } from "./runtime/PHPInterface.js";
import { PHPError, PHPFatalError } from "./runtime/PHPError.js";
import { encodePhpIdentifier, normalizePhpRegistryName, encodePhpMethodName, encodePhpPropertyName } from "./runtime/Reflection.js";
export declare function PROXY_HANDLER(ctx: PHPContext): ProxyHandler<any>;
export declare function STATIC_PROXY_HANDLER(ctx: PHPContext): ProxyHandler<any>;
export type PHPFunction = (ctx: PHPContext, ...args: PHPReference[]) => Promise<any>;
export interface PHPEngineOptions {
    extensions?: PHPExtension[];
    disabledExtensions?: string[];
    constants?: Record<string, any>;
    functions?: Record<string, PHPFunction>;
    classes?: Record<string, any>;
    cacheDir?: string | null;
    watch?: boolean;
}
export declare function getDefaultExtensions(): PHPExtension[];
export declare class PHPEngine {
    static readonly REVISION = 447;
    static readonly VERSION = "8.5.0";
    static readonly TRUE: PHPLiteral;
    static readonly FALSE: PHPLiteral;
    static readonly NULL: PHPLiteral;
    extensions: Record<string, PHPExtension>;
    constants: Record<string, any>;
    functions: Record<string, PHPFunction>;
    classes: Record<string, any>;
    interfaces: Record<string, any>;
    internalVars: Record<string, any>;
    readonly symbols: {
        PHPVariable: typeof PHPVariable;
        PHPLiteral: typeof PHPLiteral;
        PHPFatalError: typeof PHPFatalError;
        PHPError: typeof PHPError;
        SYMBOL_PHP_NAME: symbol;
        SYMBOL_PHP_META: symbol;
        SYMBOL_PHP_CONSTANTS: symbol;
        SYMBOL_PHP_PROPERTIES: symbol;
        SYMBOL_PHP_METHODS: symbol;
        SYMBOL_PHP_CLASS: symbol;
        SYMBOL_PHP_PARENT: symbol;
        SYMBOL_PHP_NEW: symbol;
        SYMBOL_PHP_INIT: symbol;
        SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS: symbol;
        SYMBOL_PHP_CLASS_INTERFACES: symbol;
        SYMBOL_PHP_METHOD_THEN: symbol;
        SYMBOL_PHP_STATIC_METHOD_PROTOTYPE: symbol;
        encodePhpIdentifier: typeof encodePhpIdentifier;
        normalizePhpRegistryName: typeof normalizePhpRegistryName;
        encodePhpMethodName: typeof encodePhpMethodName;
        encodePhpPropertyName: typeof encodePhpPropertyName;
        PHPReference: typeof PHPReference;
        PHPInterface: typeof PHPInterface;
        PHPPropertyReference: typeof PHPPropertyReference;
        PHPArrayOffsetReference: typeof PHPArrayOffsetReference;
        PROXY_HANDLER: typeof PROXY_HANDLER;
        STATIC_PROXY_HANDLER: typeof STATIC_PROXY_HANDLER;
    };
    private classResolvers;
    private resolvingClasses;
    private compiledCache;
    private watcher?;
    private transpiler;
    private cacheDir?;
    private static coreConstants;
    constructor(options?: PHPEngineOptions);
    /**
     * Gets an internal variable value. The `name` parameter must be provided in lowercase.
     */
    getInternalVar(name: string): any;
    /**
     * Sets an internal variable value. The `name` parameter must be provided in lowercase.
     */
    setInternalVar(name: string, value: any): void;
    registerFunction(name: string, fn: PHPFunction): void;
    registerFunctions(functions: Record<string, PHPFunction>): void;
    registerConstant(name: string, value: any): void;
    registerConstants(constants: Record<string, any>): void;
    registerClass(name: string, value: any): void;
    registerClasses(classes: Record<string, any>): void;
    /**
     * Registers a class resolver callback. Resolver should handle lowercase class names.
     */
    registerClassResolver(resolver: (ctx: PHPContext, className: string) => any): void;
    /**
     * Resolves a class by name using registered class resolvers.
     */
    resolveClass(name: string, originalName: string, ctx: PHPContext): Promise<any>;
    private registerCoreInterfaces;
    private registerRuntimeImplementations;
    registerExtension(extension: PHPExtension): void;
    getConfigurationSHA1(): string;
    clearCompiledCache(): void;
    compileFile(filepath: string): Promise<Function>;
    compileCode(code: string, filepath?: string): Promise<Function>;
    contexts: Set<PHPContext>;
    createContext(options?: PHPContextOptions): PHPContext;
    private initWatcher;
    clearCache(): void;
    close(): Promise<void>;
}
