import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class GDImage {
    width: number;
    height: number;
    buffer?: Buffer;
    constructor(width: number, height: number);
}
export declare class GDExtension extends PHPExtension {
    readonly name = "gd";
    onInit(engine: PHPEngine): void;
}
