import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class JSONExtension extends PHPExtension {
    readonly name = "json";
    onInit(engine: PHPEngine): void;
}
