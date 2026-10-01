import { PHPLineLocation } from "../runtime/SourceMapRegistry";
import type { PHPEngine } from "../PHPEngine";
export interface TranspilerOptions {
    engineSHA1: string;
    cacheDir?: string | null;
    engine: PHPEngine;
}
export interface TranspilationResult {
    code: string;
    map: string;
    cached: boolean;
    lineMap: Map<number, PHPLineLocation>;
}
export declare class JSTranspiler {
    private parser;
    private currentClassName;
    private currentNamespaceName;
    private classImports;
    constructor();
    transpile(sourceCode: string, filepath: string, options: TranspilerOptions): TranspilationResult;
    private sleepSync;
    private transpileNodeList;
    private transpileNode;
    private orderClassConstants;
    private getConstName;
    private transpileClassReference;
    private transpileExpr;
    private transpileTarget;
}
