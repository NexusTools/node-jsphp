import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
import { PHPContext } from "../../PHPContext";

export class SPLExtension extends PHPExtension {
  public readonly name = "spl";
  private autoloaders: Function[] = [];

  public onInit(engine: PHPEngine): void {
    this.functions = {
      spl_autoload_register: (ctx: PHPContext, callback: Function) => {
        if (typeof callback === "function") {
          this.autoloaders.push(callback);
          return true;
        }
        return false;
      },
      spl_autoload_unregister: (ctx: PHPContext, callback: Function) => {
        const idx = this.autoloaders.indexOf(callback);
        if (idx !== -1) {
          this.autoloaders.splice(idx, 1);
          return true;
        }
        return false;
      },
    };
  }
}
