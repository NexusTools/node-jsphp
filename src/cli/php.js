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
exports.runCLI = runCLI;
const readline = __importStar(require("readline"));
const path = __importStar(require("path"));
const PHPEngine_1 = require("../PHPEngine");
async function runCLI(args) {
    const engine = new PHPEngine_1.PHPEngine({ watch: false });
    if (args.includes("-v") || args.includes("--version")) {
        console.log("PHP 8.5.0 (cli) (built: Jan 1 2026 00:00:00) (jsphp)");
        console.log("Copyright (c) The PHP Group");
        console.log("Zend Engine v4.5.0, Copyright (c) Zend Technologies");
        return;
    }
    const rIndex = args.indexOf("-r");
    if (rIndex !== -1 && rIndex + 1 < args.length) {
        const code = args[rIndex + 1];
        const ctx = engine.createContext({
            stdout: (data) => process.stdout.write(data),
            stderr: (data) => process.stderr.write(data),
        });
        await ctx.eval(code);
        return;
    }
    if (args.includes("-a")) {
        console.log("Interactive shell / REPL");
        console.log("php > ");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "php > ",
        });
        const ctx = engine.createContext({
            stdout: (data) => process.stdout.write(data),
            stderr: (data) => process.stderr.write(data),
        });
        rl.prompt();
        rl.on("line", async (line) => {
            const trimmed = line.trim();
            if (trimmed === "exit" || trimmed === "quit") {
                rl.close();
                return;
            }
            try {
                await ctx.eval(line, "php shell code");
            }
            catch (err) {
                if (err.name === "PHPExit") {
                    process.exit(err.status);
                }
                else if (err.getPHPStackTraceString) {
                    console.error("\nFatal error:", err.message);
                    console.error(err.getPHPStackTraceString());
                }
                else {
                    console.error(err);
                }
            }
            rl.prompt();
        });
        return;
    }
    // File execution
    const fileArg = args.find((arg) => !arg.startsWith("-"));
    if (fileArg) {
        const filePath = path.resolve(fileArg);
        const ctx = engine.createContext({
            cwd: path.dirname(filePath),
            stdout: (data) => process.stdout.write(data),
            stderr: (data) => process.stderr.write(data),
        });
        await ctx.require(filePath);
        return;
    }
    console.log("Usage: php [-v] [-r code] [-a] [file.php]");
}
//# sourceMappingURL=php.js.map