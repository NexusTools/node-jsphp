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
exports.HashExtension = void 0;
const crypto = __importStar(require("crypto"));
const PHPExtension_1 = require("../PHPExtension");
const PHPVariable_1 = require("../runtime/PHPVariable");
class HashExtension extends PHPExtension_1.PHPExtension {
    name = "hash";
    onInit(engine) {
        this.functions = {
            md5: (ctx, dataArg, rawOutputArg) => {
                const data = dataArg?.get();
                const rawOutput = Boolean(rawOutputArg?.get());
                return this.functions.hash(ctx, new PHPVariable_1.PHPLiteral("md5"), new PHPVariable_1.PHPLiteral(Buffer.isBuffer(data) ? data : String(data ?? "")), new PHPVariable_1.PHPLiteral(rawOutput));
            },
            sha1: (ctx, dataArg, rawOutputArg) => {
                const data = dataArg?.get();
                const rawOutput = Boolean(rawOutputArg?.get());
                return this.functions.hash(ctx, new PHPVariable_1.PHPLiteral("sha1"), new PHPVariable_1.PHPLiteral(Buffer.isBuffer(data) ? data : String(data ?? "")), new PHPVariable_1.PHPLiteral(rawOutput));
            },
            hash: (ctx, algoArg, dataArg, rawOutputArg) => {
                try {
                    const algo = String(algoArg?.get() ?? "");
                    const data = String(dataArg?.get() ?? "");
                    const rawOutput = Boolean(rawOutputArg?.get());
                    const h = crypto.createHash(algo).update(data);
                    return rawOutput ? h.digest() : h.digest("hex");
                }
                catch {
                    return false;
                }
            },
            hash_hmac: (ctx, algoArg, dataArg, keyArg, rawOutputArg) => {
                try {
                    const algo = String(algoArg?.get() ?? "");
                    const data = String(dataArg?.get() ?? "");
                    const key = String(keyArg?.get() ?? "");
                    const rawOutput = Boolean(rawOutputArg?.get());
                    const h = crypto.createHmac(algo, key).update(data);
                    return rawOutput ? h.digest() : h.digest("hex");
                }
                catch {
                    return false;
                }
            },
        };
    }
}
exports.HashExtension = HashExtension;
//# sourceMappingURL=hash.js.map