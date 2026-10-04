import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";

export class SimpleXMLElement {
  public xml: string;
  constructor(xmlArg?: any) {
    this.xml = xmlArg && typeof xmlArg === "object" && typeof xmlArg.get === "function" ? String(xmlArg.get() ?? "") : String(xmlArg ?? "");
  }
}

export class XMLExtension extends PHPExtension {
  public readonly name = "xml";

  public onInit(engine: PHPEngine): void {
    this.classes = {
      SimpleXMLElement,
    };
    this.functions = {
      simplexml_load_string: (ctx: PHPContext, xmlStrArg?: PHPReference) => {
        const xmlStr = String(xmlStrArg?.get() ?? "");
        return new SimpleXMLElement(new PHPLiteral(xmlStr));
      },
    };
  }
}
