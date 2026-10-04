import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class PCREExtension extends PHPExtension {
    readonly name = "pcre";
    private compilePattern;
    private captures;
    private storeMatches;
    onInit(engine: PHPEngine): void;
}
