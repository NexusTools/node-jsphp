import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class SimpleXMLElement {
    xml: string;
    constructor(xmlArg?: any);
}
export declare class XMLExtension extends PHPExtension {
    readonly name = "xml";
    onInit(engine: PHPEngine): void;
}
