"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XMLExtension = exports.SimpleXMLElement = void 0;
const PHPExtension_1 = require("../PHPExtension");
const PHPVariable_1 = require("../runtime/PHPVariable");
class SimpleXMLElement {
    xml;
    constructor(xmlArg) {
        this.xml = xmlArg && typeof xmlArg === "object" && typeof xmlArg.get === "function" ? String(xmlArg.get() ?? "") : String(xmlArg ?? "");
    }
}
exports.SimpleXMLElement = SimpleXMLElement;
class XMLExtension extends PHPExtension_1.PHPExtension {
    name = "xml";
    onInit(engine) {
        this.classes = {
            SimpleXMLElement,
        };
        this.functions = {
            simplexml_load_string: (ctx, xmlStrArg) => {
                const xmlStr = String(xmlStrArg?.get() ?? "");
                return new SimpleXMLElement(new PHPVariable_1.PHPLiteral(xmlStr));
            },
        };
    }
}
exports.XMLExtension = XMLExtension;
//# sourceMappingURL=xml.js.map