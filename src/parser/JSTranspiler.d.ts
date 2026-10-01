import type { PHPEngine } from "../PHPEngine";
export interface TranspileOptions {
    engineSHA1?: string;
    cacheDir?: string;
    engine?: PHPEngine;
}
export interface TranspilationResult {
    code: string;
    map?: string;
}
export declare class JSTranspiler {
    private parser;
    private currentClassName;
    private currentNamespaceName;
    private classImports;
    constructor();
    transpile(code: string, filepath?: string, options?: TranspileOptions): TranspilationResult;
    private transpileNodeList;
    private transpileStmt;
    private orderClassConstants;
    private getConstName;
    private transpileClassReference;
    private transpileExpr;
}
