import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";
export declare class PCREExtension extends PHPExtension {
    readonly name = "pcre";
    private cleanExtendedRegexPattern;
    private compilePattern;
    private fixReplacement;
    private captures;
    private storeMatches;
    preg_quote(ctx: PHPContext, strArg?: PHPReference, delimiterArg?: PHPReference): Promise<string>;
    onInit(engine: PHPEngine): void;
}
