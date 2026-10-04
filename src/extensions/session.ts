import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";

export class SessionExtension extends PHPExtension {
  public readonly name = "session";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      session_start: (ctx: PHPContext) => {
        if (!ctx.superglobals.SESSION) {
          ctx.superglobals.SESSION = {};
        }
        return true;
      },
      session_id: (ctx: PHPContext, idArg?: PHPReference) => "jsphp-session-id-12345",
      session_destroy: (ctx: PHPContext) => {
        ctx.superglobals.SESSION = {};
        return true;
      },
    };
  }
}
