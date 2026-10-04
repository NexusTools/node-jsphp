import { PHPExtension } from "../PHPExtension.js";
export class SessionExtension extends PHPExtension {
    name = "session";
    onInit(engine) {
        this.functions = {
            session_start: (ctx) => {
                if (!ctx.superglobals.SESSION) {
                    ctx.superglobals.SESSION = {};
                }
                return true;
            },
            session_id: (ctx, idArg) => "jsphp-session-id-12345",
            session_destroy: (ctx) => {
                ctx.superglobals.SESSION = {};
                return true;
            },
        };
    }
}
//# sourceMappingURL=session.js.map