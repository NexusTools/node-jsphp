import { PHPEngine } from "./PHPEngine.js";
import type { PHPFunction } from "./PHPEngine.js";
export declare abstract class PHPExtension {
    abstract readonly name: string;
    readonly version: string;
    constants: Record<string, any>;
    functions: Record<string, PHPFunction>;
    classes: Record<string, any>;
    registerFunction(name: string, fn: PHPFunction): void;
    abstract onInit(engine: PHPEngine): void | Promise<void>;
}
