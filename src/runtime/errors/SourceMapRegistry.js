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
exports.SourceMapRegistry = void 0;
const path = __importStar(require("path"));
class SourceMapRegistry {
    static fileLineMaps = new Map();
    static funcToFileMaps = new Map();
    static recentLineMaps = [];
    static register(filepath, lineMap) {
        if (filepath && filepath !== "eval") {
            const resolved = path.resolve(filepath);
            this.fileLineMaps.set(resolved, lineMap);
            this.recentLineMaps.push({ file: resolved, map: lineMap });
            for (const loc of lineMap.values()) {
                if (loc.function) {
                    this.funcToFileMaps.set(loc.function.toLowerCase(), resolved);
                }
            }
        }
        else {
            this.recentLineMaps.push({ file: "eval", map: lineMap });
        }
    }
    static lookup(funcNameHint, jsLine) {
        const candidates = [jsLine, jsLine - 2, jsLine - 1, jsLine + 1, jsLine + 2];
        if (funcNameHint) {
            const cleanHint = funcNameHint.toLowerCase().replace(/^__fn_/, "").replace(/^method_/, "").replace(/^class_/, "");
            const file = this.funcToFileMaps.get(cleanHint);
            if (file) {
                const map = this.fileLineMaps.get(file);
                if (map) {
                    for (const cand of candidates) {
                        if (map.has(cand))
                            return map.get(cand);
                    }
                    let bestKey = -1;
                    for (const k of map.keys()) {
                        if (k <= jsLine && k > bestKey)
                            bestKey = k;
                    }
                    if (bestKey !== -1)
                        return map.get(bestKey);
                }
            }
        }
        // Search recent line maps in reverse
        for (let i = this.recentLineMaps.length - 1; i >= 0; i--) {
            const entry = this.recentLineMaps[i];
            for (const cand of candidates) {
                if (entry.map.has(cand))
                    return entry.map.get(cand);
            }
        }
        return undefined;
    }
}
exports.SourceMapRegistry = SourceMapRegistry;
//# sourceMappingURL=SourceMapRegistry.js.map