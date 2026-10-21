import { PHPExtension } from "../PHPExtension.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_NEW } from "../runtime/Reflection.js";
export class SimpleXMLElement {
    static [SYMBOL_PHP_NAME] = "SimpleXMLElement";
    $xml;
    static async [SYMBOL_PHP_NEW](ctx, xmlArg) {
        const obj = Object.create(this.prototype);
        obj.$xml = new PHPVariable("");
        await obj.__construct(ctx, xmlArg);
        return obj;
    }
    async __construct(ctx, xmlArg) {
        const xml = xmlArg instanceof PHPReference ? await xmlArg.get() : xmlArg;
        await this.$xml.set(String(xml ?? ""));
    }
}
export class XMLExtension extends PHPExtension {
    name = "xml";
    onInit(engine) {
        this.classes = {
            SimpleXMLElement,
        };
        this.functions = {
            simplexml_load_string: async (ctx, xmlStrArg) => {
                const xmlStr = String(await xmlStrArg?.get() ?? "");
                return SimpleXMLElement[SYMBOL_PHP_NEW](ctx, new PHPLiteral(xmlStr));
            },
        };
    }
}
//# sourceMappingURL=xml.js.map