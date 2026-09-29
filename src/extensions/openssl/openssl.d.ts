import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
export declare class OpenSSLExtension extends PHPExtension {
    readonly name = "openssl";
    onInit(engine: PHPEngine): void;
}
