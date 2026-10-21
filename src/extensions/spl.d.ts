import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_NEW } from "../runtime/Reflection.js";
export declare class SPLFileInfo {
    static [SYMBOL_PHP_NAME]: string;
    $filePath: PHPReference;
    static [SYMBOL_PHP_NEW](ctx: PHPContext, filePath?: any): Promise<SPLFileInfo>;
    __construct(ctx: PHPContext, filePath?: any): Promise<void>;
    getpathname(ctx: PHPContext): Promise<string>;
    isdir(ctx: PHPContext): Promise<boolean>;
    __tostring(ctx: PHPContext): Promise<string>;
    toString(): string;
}
export declare class RecursiveDirectoryIterator {
    static [SYMBOL_PHP_NAME]: string;
    static [SYMBOL_PHP_CONSTANTS]: {
        current_as_fileinfo: number;
        key_as_pathname: number;
        key_as_filename: number;
        follow_symlink: number;
        skip_dots: number;
        unix_pathnames: number;
    };
    static [SYMBOL_PHP_NEW](ctx: PHPContext, directory?: any): Promise<RecursiveDirectoryIterator>;
    __construct(ctx: PHPContext, directory?: any): Promise<void>;
}
export declare class RecursiveIteratorIterator {
    static [SYMBOL_PHP_NAME]: string;
    static [SYMBOL_PHP_CONSTANTS]: {
        leaves_only: number;
        self_first: number;
        child_first: number;
    };
    static [SYMBOL_PHP_NEW](ctx: PHPContext, iterator?: any): Promise<RecursiveIteratorIterator>;
    __construct(ctx: PHPContext, iterator?: any): Promise<void>;
}
export declare class RecursiveRegexIterator {
    static [SYMBOL_PHP_NAME]: string;
    static [SYMBOL_PHP_CONSTANTS]: {
        get_match: number;
        all_matches: number;
        split: number;
        replace: number;
    };
    static [SYMBOL_PHP_NEW](ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<RecursiveRegexIterator>;
    __construct(ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<void>;
}
export declare class FilesystemIterator {
    static [SYMBOL_PHP_NAME]: string;
    static [SYMBOL_PHP_CONSTANTS]: {
        current_as_fileinfo: number;
        key_as_pathname: number;
        key_as_filename: number;
        follow_symlink: number;
        skip_dots: number;
        unix_pathnames: number;
    };
    static [SYMBOL_PHP_NEW](ctx: PHPContext, directory?: any, flagsArg?: any): Promise<FilesystemIterator>;
    __construct(ctx: PHPContext, directory?: any, flagsArg?: any): Promise<void>;
}
export declare class RegexIterator {
    static [SYMBOL_PHP_NAME]: string;
    static [SYMBOL_PHP_CONSTANTS]: {
        get_match: number;
        all_matches: number;
        split: number;
        replace: number;
    };
    static [SYMBOL_PHP_NEW](ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<RegexIterator>;
    __construct(ctx: PHPContext, iterator?: any, patternArg?: any, modeArg?: any): Promise<void>;
}
export declare class SPLExtension extends PHPExtension {
    readonly name = "spl";
    private readonly objectIdSymbol;
    private objectIds;
    private nextObjectId;
    private getAutoloaders;
    private getObjectId;
    onInit(engine: PHPEngine): void;
}
