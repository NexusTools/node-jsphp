import { PHPExtension } from "./PHPExtension.js";
import { PHPContext, PHPContextOptions } from "./PHPContext.js";
import { PHPLiteral, PHPReference } from "./runtime/PHPVariable.js";
export type PHPFunction = (ctx: PHPContext, ...args: PHPReference[]) => any;
export interface PHPEngineOptions {
    extensions?: PHPExtension[];
    constants?: Record<string, any>;
    functions?: Record<string, PHPFunction>;
    classes?: Record<string, any>;
    cacheDir?: string | null;
    watch?: boolean;
}
export declare class PHPEngine {
    static readonly REVISION = 280;
    static readonly VERSION = "8.5.0";
    static readonly TRUE: PHPLiteral;
    static readonly FALSE: PHPLiteral;
    static readonly NULL: PHPLiteral;
    extensions: Map<string, PHPExtension>;
    constants: Record<string, any>;
    functions: Record<string, PHPFunction>;
    classes: Record<string, any>;
    internalVars: Record<string, any>;
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
    /**
     * Registers a function. The `name` parameter must be provided in lowercase.
     */
    registerFunction(name: string, fn: Function): void;
    /**
     * Registers multiple functions using Object.assign. All keys must be provided in lowercase.
     */
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
    private registerRuntimeImplementations;
    registerExtension(extension: PHPExtension): void;
    getConfigurationSHA1(): string;
    compileFile(filepath: string): Promise<Function>;
    compileCode(code: string, filepath?: string): Promise<Function>;
    createContext(options?: PHPContextOptions): PHPContext;
    private initWatcher;
    close(): void;
}
