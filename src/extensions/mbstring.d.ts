import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
export declare class MbstringExtension extends PHPExtension {
    readonly name = "mbstring";
    private unwrap;
    onInit(engine: PHPEngine): void;
}
