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
exports.StreamRuntime = exports.PHPStreamContext = void 0;
const fs = __importStar(require("fs/promises"));
class PHPStreamContext {
    options;
    constructor(options = {}) {
        this.options = options;
    }
}
exports.PHPStreamContext = PHPStreamContext;
class StreamRuntime {
    static stream_context_create(options = {}) {
        return new PHPStreamContext(options);
    }
    static async stream_get_contents(stream, maxLength = -1, offset = -1) {
        try {
            if (typeof stream === "string") {
                return await fs.readFile(stream, "utf8");
            }
            return "";
        }
        catch {
            return false;
        }
    }
    static stream_get_wrappers() {
        return ["file", "http", "https", "ftp", "ftps", "compress.zlib", "compress.bzip2", "php", "data", "glob", "phar"];
    }
    static stream_is_local(stream) {
        if (typeof stream === "string") {
            return !stream.includes("://") || stream.startsWith("file://");
        }
        return true;
    }
}
exports.StreamRuntime = StreamRuntime;
//# sourceMappingURL=Streams.js.map