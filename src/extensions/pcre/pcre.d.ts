import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
export declare class PCREExtension extends PHPExtension {
    readonly name = "pcre";
    onInit(engine: PHPEngine): void;
}
