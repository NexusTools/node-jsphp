export interface OptimizerContext {
    enabledExtensions: Set<string>;
    constants: Map<string, any>;
}
export declare class ASTOptimizer {
    static optimize(ast: any, ctx: OptimizerContext): any;
    private static extractStatements;
    private static literalNode;
}
