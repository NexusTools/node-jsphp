import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
export declare class SPLExtension extends PHPExtension {
    readonly name = "spl";
    private autoloaders;
    onInit(engine: PHPEngine): void;
}
