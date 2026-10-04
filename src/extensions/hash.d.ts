import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class HashExtension extends PHPExtension {
    readonly name = "hash";
    onInit(engine: PHPEngine): void;
}
