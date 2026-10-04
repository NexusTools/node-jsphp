import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class OpenSSLExtension extends PHPExtension {
    readonly name = "openssl";
    onInit(engine: PHPEngine): void;
}
