import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
export declare class CurlHandle {
    url: string;
    options: Record<number, any>;
}
export declare class CurlExtension extends PHPExtension {
    readonly name = "curl";
    onInit(engine: PHPEngine): void;
}
