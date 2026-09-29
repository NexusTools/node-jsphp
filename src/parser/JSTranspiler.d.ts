import { PHPLineLocation } from "../runtime/errors/SourceMapRegistry";
import type { PHPEngine } from "../PHPEngine";
export interface TranspilerOptions {
    engineSHA1: string;
    cacheDir?: string;
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
    constructor();
    transpile(sourceCode: string, filepath: string, options: TranspilerOptions): TranspilationResult;
    private sleepSync;
    private transpileNodeList;
    private transpileNode;
    private getConstName;
    private transpileExpr;
    private transpileTarget;
}
