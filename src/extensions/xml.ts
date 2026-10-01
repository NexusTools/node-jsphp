import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";

export class SimpleXMLElement {
  public xml: string;
  constructor(xml: string) {
    this.xml = xml;
  }
}

export class XMLExtension extends PHPExtension {
  public readonly name = "xml";

  public onInit(engine: PHPEngine): void {
    this.classes = {
      SimpleXMLElement,
    };
    this.functions = {
      simplexml_load_string: (ctx: PHPContext, xmlStr: string) => {
        return new SimpleXMLElement(xmlStr);
      },
    };
  }
}
