import { PHPExtension } from "../PHPExtension.js";
export class SessionExtension extends PHPExtension {
    name = "session";
    onInit(engine) {
        this.functions = {
            session_start: async (ctx) => {
                if (!ctx.superglobals.SESSION) {
                    ctx.superglobals.SESSION = {};
                }
                return true;
            },
            session_id: async (ctx, idArg) => "jsphp-session-id-12345",
            session_destroy: async (ctx) => {
                ctx.superglobals.SESSION = {};
                return true;
            },
        };
    }
}
//# sourceMappingURL=session.js.map