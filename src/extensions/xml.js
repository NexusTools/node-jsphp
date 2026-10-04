import { PHPExtension } from "../PHPExtension.js";
import { PHPLiteral } from "../runtime/PHPVariable.js";
export class SimpleXMLElement {
    xml;
    constructor(xmlArg) {
        this.xml = xmlArg && typeof xmlArg === "object" && typeof xmlArg.get === "function" ? String(xmlArg.get() ?? "") : String(xmlArg ?? "");
    }
}
export class XMLExtension extends PHPExtension {
    name = "xml";
    onInit(engine) {
        this.classes = {
            SimpleXMLElement,
        };
        this.functions = {
            simplexml_load_string: (ctx, xmlStrArg) => {
                const xmlStr = String(xmlStrArg?.get() ?? "");
                return new SimpleXMLElement(new PHPLiteral(xmlStr));
            },
        };
    }
}
//# sourceMappingURL=xml.js.map