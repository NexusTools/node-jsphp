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
exports.NetworkingRuntime = void 0;
const dns = __importStar(require("dns/promises"));
const os = __importStar(require("os"));
class NetworkingRuntime {
    static gethostname() {
        return os.hostname();
    }
    static async gethostbyname(hostname) {
        try {
            const res = await dns.lookup(hostname, { family: 4 });
            return res.address;
        }
        catch {
            return hostname;
        }
    }
    static async gethostbyaddr(ip) {
        try {
            const names = await dns.reverse(ip);
            return names[0] || false;
        }
        catch {
            return false;
        }
    }
    static ip2long(ip) {
        const parts = (ip || "").split(".");
        if (parts.length !== 4)
            return false;
        let num = 0;
        for (let i = 0; i < 4; i++) {
            const n = parseInt(parts[i], 10);
            if (isNaN(n) || n < 0 || n > 255)
                return false;
            num = (num << 8) + n;
        }
        return num >>> 0;
    }
    static long2ip(num) {
        if (typeof num !== "number" || num < 0 || num > 4294967295)
            return false;
        return [
            (num >>> 24) & 255,
            (num >>> 16) & 255,
            (num >>> 8) & 255,
            num & 255,
        ].join(".");
    }
    static parse_url(urlStr, component = -1) {
        try {
            const parsed = new URL(urlStr, "http://localhost");
            const obj = {
                scheme: parsed.protocol.replace(":", ""),
                host: parsed.hostname,
                port: parsed.port ? parseInt(parsed.port, 10) : undefined,
                user: parsed.username || undefined,
                pass: parsed.password || undefined,
                path: parsed.pathname,
                query: parsed.search ? parsed.search.substring(1) : undefined,
                fragment: parsed.hash ? parsed.hash.substring(1) : undefined,
            };
            if (component === 0)
                return obj.scheme;
            if (component === 1)
                return obj.host;
            if (component === 2)
                return obj.port;
            if (component === 3)
                return obj.user;
            if (component === 4)
                return obj.pass;
            if (component === 5)
                return obj.path;
            if (component === 6)
                return obj.query;
            if (component === 7)
                return obj.fragment;
            // Filter undefined
            const cleanObj = {};
            for (const [k, v] of Object.entries(obj)) {
                if (v !== undefined)
                    cleanObj[k] = v;
            }
            return cleanObj;
        }
        catch {
            return false;
        }
    }
    static http_build_query(data, numericPrefix = "", argSeparator = "&") {
        if (!data || typeof data !== "object")
            return "";
        const params = new URLSearchParams();
        function build(obj, prefix = "") {
            for (const [key, val] of Object.entries(obj)) {
                const fullKey = prefix
                    ? `${prefix}[${key}]`
                    : /^\d+$/.test(key) && numericPrefix
                        ? `${numericPrefix}${key}`
                        : key;
                if (val !== null && typeof val === "object") {
                    build(val, fullKey);
                }
                else if (val !== undefined) {
                    params.append(fullKey, String(val ?? ""));
                }
            }
        }
        build(data);
        return params.toString().replace(/\+/g, "%20").replace(/&/g, argSeparator);
    }
    static header(ctx, headerStr, replace = true, code) {
        if (!headerStr)
            return;
        if (ctx.response.headersSent) {
            ctx.triggerError(`Cannot modify header information - headers already sent`, 2);
            return;
        }
        const idx = headerStr.indexOf(":");
        if (idx !== -1) {
            const name = headerStr.substring(0, idx).trim();
            const value = headerStr.substring(idx + 1).trim();
            ctx.response.setHeader(name, value, replace);
        }
        else if (headerStr.toUpperCase().startsWith("HTTP/")) {
            const parts = headerStr.split(" ");
            if (parts.length >= 2) {
                const statusCode = parseInt(parts[1], 10);
                if (!isNaN(statusCode)) {
                    ctx.response.statusCode = statusCode;
                }
            }
        }
        if (code) {
            ctx.response.statusCode = code;
        }
    }
    static setcookie(ctx, name, value = "", expires = 0, path = "", domain = "", secure = false, httponly = false) {
        if (ctx.response.headersSent) {
            ctx.triggerError(`Cannot set cookie - headers already sent`, 2);
            return false;
        }
        ctx.response.setCookie(name, value, expires, path, domain, secure, httponly, false);
        return true;
    }
    static setrawcookie(ctx, name, value = "", expires = 0, path = "", domain = "", secure = false, httponly = false) {
        if (ctx.response.headersSent) {
            ctx.triggerError(`Cannot set raw cookie - headers already sent`, 2);
            return false;
        }
        ctx.response.setCookie(name, value, expires, path, domain, secure, httponly, true);
        return true;
    }
    static header_remove(ctx, name) {
        ctx.response.removeHeader(name);
    }
    static headers_list(ctx) {
        return ctx.response.getHeadersList();
    }
    static headers_sent(ctx) {
        return ctx.response.headersSent;
    }
    static http_response_code(ctx, code) {
        if (code !== undefined) {
            ctx.response.statusCode = code;
            return true;
        }
        return ctx.response.statusCode;
    }
}
exports.NetworkingRuntime = NetworkingRuntime;
//# sourceMappingURL=Networking.js.map