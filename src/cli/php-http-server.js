"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHTTPServer = runHTTPServer;
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const PHPEngine_1 = require("../PHPEngine");
async function runHTTPServer(port = 8080, docRoot = process.cwd()) {
    const engine = new PHPEngine_1.PHPEngine();
    const server = http.createServer(async (req, res) => {
        const reqUrl = req.url || "/";
        const scriptPath = path.join(docRoot, reqUrl.split("?")[0]);
        const ctx = engine.createContext({
            cwd: docRoot,
            stdout: (data) => res.write(data),
            stderr: (data) => console.error(data),
            superglobals: {
                server: {
                    REQUEST_METHOD: req.method || "GET",
                    REQUEST_URI: reqUrl,
                    DOCUMENT_ROOT: docRoot,
                    SCRIPT_FILENAME: scriptPath,
                },
            },
        });
        res.statusCode = 200;
        try {
            await ctx.require(scriptPath);
        }
        catch (err) {
            res.statusCode = 500;
            res.write(`PHP HTTP Server Error: ${err.message || err}`);
        }
        finally {
            res.end();
        }
    });
    server.listen(port, () => {
        console.log(`[jsphp-http-server] listening on http://127.0.0.1:${port}, document root: ${docRoot}`);
    });
}
//# sourceMappingURL=php-http-server.js.map