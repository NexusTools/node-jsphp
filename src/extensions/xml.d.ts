import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
export declare class SimpleXMLElement {
    xml: string;
    constructor(xmlArg?: any);
}
export declare class XMLExtension extends PHPExtension {
    readonly name = "xml";
    onInit(engine: PHPEngine): void;
}
