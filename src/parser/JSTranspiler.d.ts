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
    private currentClassNameOriginal;
    private currentNamespaceName;
    private currentNamespaceNameOriginal;
    private classImports;
    private classImportsOriginal;
    private switchLabelCounter;
    private switchLabelStack;
    private foreachDepth;
    constructor();
    transpile(code: string, filepath?: string, options?: TranspileOptions): TranspilationResult;
    private transpileNodeList;
    private transpileStmt;
    private containsYield;
    private orderClassConstants;
    private getConstName;
    private transpileClassReferenceLower;
    private transpileClassReferenceOriginal;
    private transpileClassReference;
    private transpileExpr;
}
