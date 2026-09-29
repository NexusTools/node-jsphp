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
            const res = await dns.lookup(hostname);
            return res.address;
        }
        catch {
            return hostname;
        }
    }
    static async gethostbyaddr(ip) {
        try {
            const res = await dns.reverse(ip);
            return res[0] || ip;
        }
        catch {
            return ip;
        }
    }
    static async gethostbynamel(hostname) {
        try {
            const res = await dns.resolve4(hostname);
            return res;
        }
        catch {
            return false;
        }
    }
    static ip2long(ip) {
        const parts = ip.split(".");
        if (parts.length !== 4)
            return false;
        let num = 0;
        for (let i = 0; i < 4; i++) {
            const p = parseInt(parts[i], 10);
            if (isNaN(p) || p < 0 || p > 255)
                return false;
            num = (num << 8) + p;
        }
        return num >>> 0;
    }
    static long2ip(num) {
        if (num < 0 || num > 4294967295)
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
            const u = new URL(urlStr);
            const parsed = {
                scheme: u.protocol.replace(":", ""),
                host: u.hostname,
                port: u.port ? parseInt(u.port, 10) : undefined,
                user: u.username || undefined,
                pass: u.password || undefined,
                path: u.pathname,
                query: u.search ? u.search.substring(1) : undefined,
                fragment: u.hash ? u.hash.substring(1) : undefined,
            };
            if (component !== -1) {
                // PHP URL component constants mapping
                switch (component) {
                    case 0: return parsed.scheme;
                    case 1: return parsed.host;
                    case 2: return parsed.port;
                    case 3: return parsed.user;
                    case 4: return parsed.pass;
                    case 5: return parsed.path;
                    case 6: return parsed.query;
                    case 7: return parsed.fragment;
                }
            }
            return parsed;
        }
        catch {
            return false;
        }
    }
    static http_build_query(data, numericPrefix = "", argSeparator = "&") {
        if (!data || typeof data !== "object")
            return "";
        const params = new URLSearchParams();
        for (const [key, val] of Object.entries(data)) {
            const k = typeof key === "number" ? `${numericPrefix}${key}` : key;
            params.append(k, String(val ?? ""));
        }
        return params.toString().replace(/&/g, argSeparator);
    }
    static header(ctx, headerStr, replace = true, httpResponseCode) {
        if (httpResponseCode) {
            ctx.superglobals.SERVER["HTTP_RESPONSE_CODE"] = httpResponseCode;
        }
        if (!ctx.superglobals.SERVER["RESPONSE_HEADERS"]) {
            ctx.superglobals.SERVER["RESPONSE_HEADERS"] = {};
        }
        const colonIdx = headerStr.indexOf(":");
        if (colonIdx !== -1) {
            const name = headerStr.substring(0, colonIdx).trim().toLowerCase();
            const val = headerStr.substring(colonIdx + 1).trim();
            ctx.superglobals.SERVER["RESPONSE_HEADERS"][name] = val;
        }
    }
    static http_response_code(ctx, responseCode) {
        if (responseCode !== undefined) {
            ctx.superglobals.SERVER["HTTP_RESPONSE_CODE"] = responseCode;
            return responseCode;
        }
        return ctx.superglobals.SERVER["HTTP_RESPONSE_CODE"] || 200;
    }
}
exports.NetworkingRuntime = NetworkingRuntime;
//# sourceMappingURL=Networking.js.map