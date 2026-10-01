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
    constants: Map<string, any>;
    functions: Map<string, Function>;
    classes: Map<string, any>;
    internalVars: Map<string, any>;
    private classResolvers;
    private resolvingClasses;
    private compiledCache;
    private watcher?;
    private transpiler;
    private cacheDir?;
    constructor(options?: PHPEngineOptions);
    getInternalVar(name: string): any;
    setInternalVar(name: string, value: any): void;
    registerFunction(name: string, fn: Function): void;
    registerConstant(name: string, value: any): void;
    registerClass(name: string, value: any): void;
    registerClassResolver(resolver: (ctx: PHPContext, className: string) => any): void;
    resolveClass(name: string, ctx: PHPContext): Promise<any>;
    getConstant(name: string): any;
    private registerCoreFunctions;
    private registerRuntimeImplementations;
    registerExtension(extension: PHPExtension): void;
    getConfigurationSHA1(): string;
    compileFile(filepath: string): Promise<Function>;
    compileCode(code: string, filepath?: string): Promise<Function>;
    createContext(options?: PHPContextOptions): PHPContext;
    private initWatcher;
    close(): void;
}
