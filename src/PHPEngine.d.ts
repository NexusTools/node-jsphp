import { PHPExtension } from "./PHPExtension";
import { PHPContext, PHPContextOptions } from "./PHPContext";
export interface PHPEngineOptions {
    extensions?: PHPExtension[];
    constants?: Record<string, any>;
    cacheDir?: string | null;
    watch?: boolean;
}
export declare class PHPEngine {
    extensions: Map<string, PHPExtension>;
    constants: Record<string, any>;
    functions: Record<string, Function>;
    classes: Record<string, any>;
    internalVars: Record<string, any>;
    private classResolvers;
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
    registerFunctions(functions: Record<string, Function>): void;
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
    /**
     * Gets a constant value by name. The `name` parameter must be provided in lowercase or exact casing.
     */
    getConstant(name: string): any;
    private static coreFunctions;
    private registerRuntimeImplementations;
    registerExtension(extension: PHPExtension): void;
    getConfigurationSHA1(): string;
    compileFile(filepath: string): Promise<Function>;
    compileCode(code: string, filepath?: string): Promise<Function>;
    createContext(options?: PHPContextOptions): PHPContext;
    private initWatcher;
    close(): void;
}
