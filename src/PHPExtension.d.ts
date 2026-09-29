import type { PHPEngine } from "./PHPEngine";
export declare abstract class PHPExtension {
    abstract readonly name: string;
    readonly version: string;
    constants: Record<string, any>;
    functions: Record<string, Function>;
    classes: Record<string, any>;
    onInit(engine: PHPEngine): void | Promise<void>;
}
