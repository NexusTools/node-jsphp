import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";
import { PHPTypeError } from "../runtime/PHPError";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable";

export class SPLExtension extends PHPExtension {
  public readonly name = "spl";
  private autoloaders: any[] = [];
  private objectIds = new WeakMap<object, number>();
  private nextObjectId = 1;

  private getObjectId(valueArg: any, functionName: string): number {
    const value = valueArg && typeof valueArg === "object" && typeof valueArg.get === "function" ? valueArg.get() : valueArg;
    if (value === null || (typeof value !== "object" && typeof value !== "function") || Array.isArray(value)) {
      throw new PHPTypeError(`${functionName}(): Argument #1 ($object) must be of type object`);
    }
    let objectId = this.objectIds.get(value);
    if (objectId === undefined) {
      objectId = this.nextObjectId++;
      this.objectIds.set(value, objectId);
    }
    return objectId;
  }

  public onInit(engine: PHPEngine): void {
    engine.registerClassResolver(async (ctx: PHPContext, requestedName: string) => {
      for (const callback of this.autoloaders) {
        if (typeof callback === "string") await ctx.callFunction(callback.toLowerCase(), [new PHPLiteral(requestedName)]);
        else if (Array.isArray(callback) && callback.length === 2) await ctx.callStaticMethod(String(callback[0]).toLowerCase(), String(callback[1]).toLowerCase(), [new PHPLiteral(requestedName)], undefined, String(callback[0]));
        else if (typeof callback === "function") await callback.apply(ctx, [ctx, new PHPLiteral(requestedName)]);
        if (String(requestedName).toLowerCase() in engine.classes || String(requestedName).toLowerCase() in ctx.classes) return;
      }
    });

    this.functions = {
      spl_object_id: (ctx: PHPContext, value?: PHPReference) => this.getObjectId(value, "spl_object_id"),
      spl_object_hash: (ctx: PHPContext, value?: PHPReference) => this.getObjectId(value, "spl_object_hash").toString(16).padStart(32, "0"),
      spl_autoload_register: (ctx: PHPContext, callbackArg?: PHPReference) => {
        const callback = callbackArg?.get();
        if (callback !== undefined && callback !== null) {
          this.autoloaders.push(callback);
          return true;
        }
        return false;
      },
      spl_autoload_unregister: (ctx: PHPContext, callbackArg?: PHPReference) => {
        const callback = callbackArg?.get();
        this.autoloaders = this.autoloaders.filter((cb) => cb !== callback);
        return true;
      },
      spl_autoload_functions: () => this.autoloaders,
    };
  }
}
