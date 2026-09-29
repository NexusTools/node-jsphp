import { OptimizerContext } from "./ASTOptimizer";
export interface TranspilerOptions {
    engineSHA1: string;
    cacheDir?: string;
    optimizerCtx: OptimizerContext;
}
export interface TranspilationResult {
    code: string;
    map: string;
    cached: boolean;
}
export declare class JSTranspiler {
    private parser;
    constructor();
    transpile(sourceCode: string, filepath: string, options: TranspilerOptions): TranspilationResult;
    private transpileNodeList;
    private transpileNode;
    private transpileExpr;
    private transpileTarget;
}
