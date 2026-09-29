"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionExtension = void 0;
const PHPExtension_1 = require("../../PHPExtension");
class SessionExtension extends PHPExtension_1.PHPExtension {
    name = "session";
    onInit(engine) {
        this.functions = {
            session_start: (ctx) => {
                if (!ctx.superglobals.SESSION) {
                    ctx.superglobals.SESSION = {};
                }
                return true;
            },
            session_id: (ctx, id) => "jsphp-session-id-12345",
            session_destroy: (ctx) => {
                ctx.superglobals.SESSION = {};
                return true;
            },
        };
    }
}
exports.SessionExtension = SessionExtension;
//# sourceMappingURL=session.js.map