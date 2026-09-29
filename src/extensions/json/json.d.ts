import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
export declare class JSONExtension extends PHPExtension {
    readonly name = "json";
    onInit(engine: PHPEngine): void;
}
