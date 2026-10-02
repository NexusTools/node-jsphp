import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";
import { PHPTypeError } from "../runtime/PHPError";

export class SPLExtension extends PHPExtension {
  public readonly name = "spl";
  private autoloaders: any[] = [];
  private objectIds = new WeakMap<object, number>();
  private nextObjectId = 1;

  private getObjectId(value: any, functionName: string): number {
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
        if (typeof callback === "string") await ctx.callFunction(callback, [requestedName]);
        else if (Array.isArray(callback) && callback.length === 2) await ctx.callStaticMethod(callback[0], callback[1], [requestedName]);
        else if (typeof callback === "function") await callback.apply(ctx, [ctx, requestedName]);
        if (String(requestedName).toLowerCase() in engine.classes) return;
      }
    });

    this.functions = {
      spl_object_id: (ctx: PHPContext, value: any) => this.getObjectId(value, "spl_object_id"),
      spl_object_hash: (ctx: PHPContext, value: any) => this.getObjectId(value, "spl_object_hash").toString(16).padStart(32, "0"),
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
