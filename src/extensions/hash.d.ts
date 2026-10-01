import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
export declare class HashExtension extends PHPExtension {
    readonly name = "hash";
    onInit(engine: PHPEngine): void;
}
