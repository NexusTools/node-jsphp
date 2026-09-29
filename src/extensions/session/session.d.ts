import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
export declare class SessionExtension extends PHPExtension {
    readonly name = "session";
    onInit(engine: PHPEngine): void;
}
