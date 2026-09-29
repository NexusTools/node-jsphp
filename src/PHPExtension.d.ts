import type { PHPEngine } from "./PHPEngine";
export declare abstract class PHPExtension {
    abstract readonly name: string;
    readonly version: string;
    constants: Record<string, any>;
    functions: Record<string, Function>;
    classes: Record<string, any>;
    registerFunction(name: string, fn: Function, params?: {
        name: string;
        isOptional?: boolean;
        defaultValue?: any;
        type?: string;
    }[], visibility?: "public" | "protected" | "private"): void;
    onInit(engine: PHPEngine): void | Promise<void>;
}
