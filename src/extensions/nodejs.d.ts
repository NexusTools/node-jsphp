import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare const SYMBOL_PHP_NODEJS_PROXY: unique symbol;
export declare const SYMBOL_PHP_NODEJS_VALUE: unique symbol;
export declare function wrapJSValue(val: any): any;
export declare function unwrapPHPValue(val: any): any;
export declare class NodeJSExtension extends PHPExtension {
    readonly name = "nodejs";
    onInit(engine: PHPEngine): void;
}
