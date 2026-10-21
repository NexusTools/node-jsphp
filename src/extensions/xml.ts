import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_NEW } from "../runtime/Reflection.js";

export class SimpleXMLElement {
  public static [SYMBOL_PHP_NAME] = "SimpleXMLElement";
  public $xml!: PHPReference;

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, xmlArg?: any): Promise<SimpleXMLElement> {
    const obj = Object.create(this.prototype);
    obj.$xml = new PHPVariable("");
    await obj.__construct(ctx, xmlArg);
    return obj;
  }

  public async __construct(ctx: PHPContext, xmlArg?: any): Promise<void> {
    const xml = xmlArg instanceof PHPReference ? await xmlArg.get() : xmlArg;
    await this.$xml.set(String(xml ?? ""));
  }
}

export class XMLExtension extends PHPExtension {
  public readonly name = "xml";

  public onInit(engine: PHPEngine): void {
    this.classes = {
      SimpleXMLElement,
    };
    this.functions = {
      simplexml_load_string: async (ctx: PHPContext, xmlStrArg?: PHPReference) => {
        const xmlStr = String(await xmlStrArg?.get() ?? "");
        return SimpleXMLElement[SYMBOL_PHP_NEW](ctx, new PHPLiteral(xmlStr));
      },
    };
  }
}
