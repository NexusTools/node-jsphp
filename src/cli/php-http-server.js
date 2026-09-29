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
async function runHTTPServer(port = 8080, docRoot = process.cwd()) {
    const engine = new PHPEngine_1.PHPEngine();
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
            req.on("data", (chunk) => bodyChunks.push(chunk));
            await new Promise((resolve) => req.on("end", resolve));
            const postData = Buffer.concat(bodyChunks).toString("utf8");
            const postParams = {};
            if (postData && req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
                const sp = new URLSearchParams(postData);
                for (const [k, v] of sp.entries()) {
                    postParams[k] = v;
                }
            }
            let phpOutput = "";
            const ctx = engine.createContext({
                cwd: absoluteCwd,
                stdout: (data) => { phpOutput += data; },
                stderr: (data) => console.error(data),
                superglobals: {
                    server: {
                        REQUEST_METHOD: req.method || "GET",
                        REQUEST_URI: rawUrl,
                        DOCUMENT_ROOT: absoluteCwd,
                        SCRIPT_FILENAME: fullPath,
                        HTTP_HOST: req.headers.host || `127.0.0.1:${port}`,
                    },
                    get: getParams,
                    post: postParams,
                    cookie: parseCookieHeader(req.headers.cookie || ""),
                },
            });
            ctx.setInternalVar("hasServerResponseHandler", true);
            try {
                await ctx.require(fullPath);
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
            catch (err) {
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                }
                res.end(`PHP HTTP Server Error: ${err.message || err}`);
            }
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
    return new Promise((resolve) => {
        server.listen(port, () => {
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
//# sourceMappingURL=php-http-server.js.map