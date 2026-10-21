import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_NEW } from "../runtime/Reflection.js";
export declare class SimpleXMLElement {
    static [SYMBOL_PHP_NAME]: string;
    $xml: PHPReference;
    static [SYMBOL_PHP_NEW](ctx: PHPContext, xmlArg?: any): Promise<SimpleXMLElement>;
    __construct(ctx: PHPContext, xmlArg?: any): Promise<void>;
}
export declare class XMLExtension extends PHPExtension {
    readonly name = "xml";
    onInit(engine: PHPEngine): void;
}
