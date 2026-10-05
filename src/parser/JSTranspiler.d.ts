import type { PHPEngine } from "../PHPEngine.js";
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
    private currentFuncName;
    private currentNamespaceName;
    private currentNamespaceNameOriginal;
    private classImports;
    private classImportsOriginal;
    private switchLabelCounter;
    private switchLabelStack;
    private foreachDepth;
    constructor();
    transpile(code: string, filepath?: string, options?: TranspileOptions): TranspilationResult;
    private collectFunctionsInNodes;
    private transpileFunctionNode;
    private transpileNodeList;
    private transpileStmt;
    private containsYield;
    private orderClassConstants;
    private transpileCallArgs;
    private collectVariablesInScope;
    private static readonly SUPERGLOBALS;
    private isSuperglobal;
    private getConstName;
    private transpilePropertyOffset;
    private transpileListAssignItem;
    private transpileListAssign;
    private transpileMethodOffset;
    private transpileClassReferenceLower;
    private transpileClassReferenceOriginal;
    private transpileClassReference;
    private transpileExpr;
}
