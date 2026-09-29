import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
import { PHPContext } from "../../PHPContext";

export class SPLExtension extends PHPExtension {
  public readonly name = "spl";
  private autoloaders: any[] = [];

  public onInit(engine: PHPEngine): void {
    this.functions = {
      spl_autoload_register: (ctx: PHPContext, callback: any) => {
        if (callback !== undefined && callback !== null) {
          this.autoloaders.push(callback);
          return true;
        }
        return false;
      },
      spl_autoload_unregister: (ctx: PHPContext, callback: any) => {
        this.autoloaders = this.autoloaders.filter((cb) => cb !== callback);
        return true;
      },
      spl_autoload_functions: () => this.autoloaders,
    };
  }
}
