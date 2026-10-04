import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class SessionExtension extends PHPExtension {
    readonly name = "session";
    onInit(engine: PHPEngine): void;
}
