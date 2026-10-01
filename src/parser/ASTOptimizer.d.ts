import type { PHPEngine } from "../PHPEngine";
export declare class ASTOptimizer {
    static optimize(ast: any, engine: PHPEngine): any;
    private static extractStatements;
}
