"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecRuntime = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ExecRuntime {
    static register(engine) {
        const register = engine.registerFunction.bind(engine);
        register("exec", async (ctx, command, output, status) => ExecRuntime.exec(ctx, command, output, status));
        register("shell_exec", async (ctx, command) => ExecRuntime.shell_exec(ctx, command));
        register("escapeshellarg", (ctx, argument) => ExecRuntime.escapeshellarg(argument));
        register("escapeshellcmd", (ctx, command) => ExecRuntime.escapeshellcmd(command));
    }
    static async exec(ctx, command, outputArray, returnVarObj) {
        try {
            const { stdout } = await execAsync(command, { cwd: ctx.cwd });
            const lines = stdout.trimEnd().split(/\r?\n/);
            if (Array.isArray(outputArray)) {
                outputArray.length = 0;
                outputArray.push(...lines);
            }
            if (returnVarObj && typeof returnVarObj === "object") {
                returnVarObj.val = 0;
            }
            return lines[lines.length - 1] || "";
        }
        catch (err) {
            if (returnVarObj && typeof returnVarObj === "object") {
                returnVarObj.val = err.status || 1;
            }
            return "";
        }
    }
    static async shell_exec(ctx, command) {
        try {
            const { stdout } = await execAsync(command, { cwd: ctx.cwd });
            return stdout;
        }
        catch {
            return null;
        }
    }
    static escapeshellarg(arg) {
        return `'${String(arg ?? "").replace(/'/g, "'\\''")}'`;
    }
    static escapeshellcmd(cmd) {
        return String(cmd ?? "").replace(/([#&;`|*?~<>^()\[\]{}$\\\x0A\xFF])/g, "\\$1");
    }
}
exports.ExecRuntime = ExecRuntime;
//# sourceMappingURL=Exec.js.map