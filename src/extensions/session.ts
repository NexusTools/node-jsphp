import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";

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
      session_id: (ctx: PHPContext, id?: string) => "jsphp-session-id-12345",
      session_destroy: (ctx: PHPContext) => {
        ctx.superglobals.SESSION = {};
        return true;
      },
    };
  }
}
