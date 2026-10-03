import { PHPEngine, PHPFunction } from "./PHPEngine";
export declare abstract class PHPExtension {
    abstract readonly name: string;
    readonly version: string;
    constants: Record<string, any>;
    functions: Record<string, PHPFunction>;
    classes: Record<string, any>;
    registerFunction(name: string, fn: PHPFunction, params?: {
        name: string;
        isOptional?: boolean;
        defaultValue?: any;
        type?: string;
    }[], visibility?: "public" | "protected" | "private"): void;
    abstract onInit(engine: PHPEngine): void | Promise<void>;
}
