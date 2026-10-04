import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class MbstringExtension extends PHPExtension {
    readonly name = "mbstring";
    private unwrap;
    onInit(engine: PHPEngine): void;
}
