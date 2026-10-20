import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME } from "../runtime/Reflection.js";
export declare class SPLFileInfo {
    static [SYMBOL_PHP_NAME]: string;
    $filePath: PHPReference;
    static __$$__new(ctx: PHPContext, filePath?: any): Promise<SPLFileInfo>;
    __construct(ctx: PHPContext, filePath?: any): Promise<void>;
    getpathname(ctx: PHPContext): string;
    isdir(ctx: PHPContext): boolean;
    __tostring(ctx: PHPContext): string;
    toString(): string;
}
export declare class RecursiveDirectoryIterator {
    static [SYMBOL_PHP_NAME]: string;
    static __php_constants: Map<string, number>;
    static __$$__new(ctx: PHPContext, directory?: any): Promise<RecursiveDirectoryIterator>;
    __construct(ctx: PHPContext, directory?: any): Promise<void>;
}
export declare class RecursiveIteratorIterator {
    static [SYMBOL_PHP_NAME]: string;
    static __php_constants: Map<string, number>;
    static __$$__new(ctx: PHPContext, iterator?: any): Promise<RecursiveIteratorIterator>;
    __construct(ctx: PHPContext, iterator?: any): Promise<void>;
}
export declare class RecursiveRegexIterator {
    static [SYMBOL_PHP_NAME]: string;
    static __php_constants: Map<string, number>;
}
export declare class FilesystemIterator {
    static [SYMBOL_PHP_NAME]: string;
    static __php_constants: Map<string, number>;
}
export declare class RegexIterator {
    static [SYMBOL_PHP_NAME]: string;
    static __php_constants: Map<string, number>;
    static __$$__new(ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<RegexIterator>;
    __construct(ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<void>;
}
export declare class SPLExtension extends PHPExtension {
    readonly name = "spl";
    private objectIds;
    private nextObjectId;
    private getAutoloaders;
    private getObjectId;
    onInit(engine: PHPEngine): void;
}
