import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
export declare class PCREExtension extends PHPExtension {
    readonly name = "pcre";
    private compilePattern;
    private captures;
    private storeMatches;
    onInit(engine: PHPEngine): void;
}
