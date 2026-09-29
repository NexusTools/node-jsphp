"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XMLExtension = exports.SimpleXMLElement = void 0;
const PHPExtension_1 = require("../../PHPExtension");
class SimpleXMLElement {
    xml;
    constructor(xml) {
        this.xml = xml;
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
            simplexml_load_string: (ctx, xmlStr) => {
                return new SimpleXMLElement(xmlStr);
            },
        };
    }
}
exports.XMLExtension = XMLExtension;
//# sourceMappingURL=xml.js.map