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
const fs = __importStar(require("fs/promises"));
const PHPEngine_1 = require("../PHPEngine");
const PHPError_1 = require("../runtime/PHPError");
const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
};
async function runHTTPServer(port = 8080, docRoot = process.cwd(), cacheDir) {
    const engine = new PHPEngine_1.PHPEngine({ cacheDir: cacheDir || null });
    const absoluteCwd = path.resolve(docRoot);
    const server = http.createServer(async (req, res) => {
        const rawUrl = req.url || "/";
        const [urlPath, queryString] = rawUrl.split("?");
        const decodedPath = decodeURIComponent(urlPath);
        // Resolve candidates
        const resolvedCandidate = await resolveCandidate(absoluteCwd, decodedPath);
        if (!resolvedCandidate) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(`<!DOCTYPE html><html><body><h1>404 Not Found</h1><p>The requested URL ${decodedPath} was not found on this server.</p></body></html>`);
            return;
        }
        const { fullPath, isPHP } = resolvedCandidate;
        if (isPHP) {
            // Parse GET params
            const getParams = {};
            if (queryString) {
                const sp = new URLSearchParams(queryString);
                for (const [k, v] of sp.entries()) {
                    getParams[k] = v;
                }
            }
            // Parse POST body if present
            const bodyChunks = [];
            const reqMethod = (req.method || "GET").toUpperCase();
            if (reqMethod !== "GET" && reqMethod !== "HEAD") {
                req.on("data", (chunk) => bodyChunks.push(chunk));
                if (!req.readableEnded) {
                    req.resume();
                    await new Promise((resolve) => {
                        req.on("end", resolve);
                        req.on("error", () => resolve());
                    });
                }
            }
            const postData = Buffer.concat(bodyChunks).toString("utf8");
            const postParams = {};
            if (postData && req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
                const sp = new URLSearchParams(postData);
                for (const [k, v] of sp.entries()) {
                    postParams[k] = v;
                }
            }
            let phpOutput = "";
            const hostHeader = req.headers.host || `127.0.0.1:${port}`;
            const [hostName, hostPort] = hostHeader.split(":");
            const ctx = engine.createContext({
                cwd: absoluteCwd,
                stdout: (data) => { phpOutput += data; },
                stderr: (data) => console.error(data),
                superglobals: {
                    server: {
                        REQUEST_METHOD: req.method || "GET",
                        REQUEST_URI: rawUrl,
                        DOCUMENT_ROOT: absoluteCwd.replace(/\\/g, "/"),
                        SCRIPT_FILENAME: fullPath.replace(/\\/g, "/"),
                        SCRIPT_NAME: decodedPath,
                        PHP_SELF: decodedPath,
                        HTTP_HOST: hostHeader,
                        SERVER_NAME: hostName || "127.0.0.1",
                        SERVER_PORT: hostPort || String(port),
                        SERVER_ADDR: "127.0.0.1",
                        REMOTE_ADDR: req.socket.remoteAddress || "127.0.0.1",
                        SERVER_SOFTWARE: "JSPHP HTTP Server / 8.5.0",
                        HTTP_USER_AGENT: req.headers["user-agent"] || "Mozilla/5.0",
                        HTTP_ACCEPT: req.headers["accept"] || "*/*",
                    },
                    get: getParams,
                    post: postParams,
                    cookie: parseCookieHeader(req.headers.cookie || ""),
                },
            });
            ctx.setInternalVar("hasServerResponseHandler", true);
            try {
                await ctx.require(fullPath);
            }
            catch (err) {
                if (err instanceof PHPError_1.PHPExit || err?.name === "PHPExit") {
                    // Normal exit/redirect
                }
                else {
                    console.error("-> PHP FATAL ERROR CAUGHT:", err);
                    if (!res.headersSent) {
                        res.statusCode = 500;
                        res.setHeader("Content-Type", "text/html; charset=utf-8");
                    }
                    const stackTrace = typeof err.getPHPStackTraceString === "function"
                        ? err.getPHPStackTraceString()
                        : PHPError_1.PHPError.virtualizeJSStack(err.stack || String(err));
                    const htmlError = `<!DOCTYPE html><html><head><title>500 Internal Server Error</title></head><body>` +
                        `<h1>PHP Fatal Error</h1>` +
                        `<p><strong>Message:</strong> ${escapeHtml(err.message || String(err))}</p>` +
                        `<h3>PHP Stack Trace</h3>` +
                        `<pre style="background:#f4f4f4;padding:12px;border:1px solid #ccc;font-family:monospace;">${escapeHtml(stackTrace)}</pre>` +
                        `</body></html>`;
                    res.end(htmlError);
                    return;
                }
            }
            const statusCode = ctx.response.statusCode;
            res.statusCode = statusCode;
            for (const h of ctx.response.headers) {
                if (h.name.toLowerCase() === "set-cookie") {
                    const existing = res.getHeader("Set-Cookie");
                    if (existing) {
                        const arr = Array.isArray(existing) ? existing : [String(existing)];
                        res.setHeader("Set-Cookie", [...arr, h.value]);
                    }
                    else {
                        res.setHeader("Set-Cookie", [h.value]);
                    }
                }
                else {
                    res.setHeader(h.name, h.value);
                }
            }
            if (!res.getHeader("Content-Type")) {
                res.setHeader("Content-Type", "text/html; charset=utf-8");
            }
            res.end(phpOutput);
        }
        else {
            // Serve static file
            try {
                const fileData = await fs.readFile(fullPath);
                const ext = path.extname(fullPath).toLowerCase();
                const contentType = MIME_TYPES[ext] || "application/octet-stream";
                res.statusCode = 200;
                res.setHeader("Content-Type", contentType);
                res.end(fileData);
            }
            catch (err) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.end(`Server Error: ${err.message || err}`);
            }
        }
    });
    server.on("close", () => engine.close());
    return new Promise((resolve) => {
        server.listen(port, "0.0.0.0", () => {
            console.log(`[jsphp-http-server] listening on http://127.0.0.1:${port}, document root: ${absoluteCwd}`);
            resolve(server);
        });
    });
}
async function resolveCandidate(docRoot, urlPath) {
    const targetPath = path.join(docRoot, urlPath);
    try {
        const stat = await fs.stat(targetPath);
        if (stat.isFile()) {
            return { fullPath: targetPath, isPHP: targetPath.endsWith(".php") };
        }
        if (stat.isDirectory()) {
            // Try directory index files: index.php -> index.html
            const indexPath = path.join(targetPath, "index.php");
            if (await fileExists(indexPath)) {
                return { fullPath: indexPath, isPHP: true };
            }
            const indexHtmlPath = path.join(targetPath, "index.html");
            if (await fileExists(indexHtmlPath)) {
                return { fullPath: indexHtmlPath, isPHP: false };
            }
        }
    }
    catch {
        // Path does not exist as-is; try extension resolutions
    }
    // Candidate 1: urlPath + .php (e.g. /test -> /test.php)
    const phpPath = targetPath + ".php";
    if (await fileExists(phpPath)) {
        return { fullPath: phpPath, isPHP: true };
    }
    // Candidate 2: urlPath + .html (e.g. /test -> /test.html)
    const htmlPath = targetPath + ".html";
    if (await fileExists(htmlPath)) {
        return { fullPath: htmlPath, isPHP: false };
    }
    // Candidate 3: urlPath/index.php
    const dirPhpPath = path.join(targetPath, "index.php");
    if (await fileExists(dirPhpPath)) {
        return { fullPath: dirPhpPath, isPHP: true };
    }
    // Candidate 4: urlPath/index.html
    const dirHtmlPath = path.join(targetPath, "index.html");
    if (await fileExists(dirHtmlPath)) {
        return { fullPath: dirHtmlPath, isPHP: false };
    }
    return null;
}
async function fileExists(filePath) {
    try {
        const stat = await fs.stat(filePath);
        return stat.isFile();
    }
    catch {
        return false;
    }
}
function parseCookieHeader(cookieHeader) {
    const cookies = {};
    if (!cookieHeader)
        return cookies;
    const pairs = cookieHeader.split(";");
    for (const pair of pairs) {
        const idx = pair.indexOf("=");
        if (idx > 0) {
            const name = pair.slice(0, idx).trim();
            const val = pair.slice(idx + 1).trim();
            cookies[name] = decodeURIComponent(val);
        }
    }
    return cookies;
}
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
//# sourceMappingURL=php-http-server.js.map