"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecRuntime = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const Reflection_1 = require("./Reflection");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ExecRuntime {
    /**
     * Execute an external program.
     * @param outputArray Output variable passed by reference to receive output lines.
     * @param returnVarObj Output variable passed by reference to receive exit status code.
     */
    static async exec(ctx, commandArg, outputArray, returnVarObj) {
        const command = String(commandArg?.get() ?? "");
        try {
            const { stdout } = await execAsync(command, { cwd: ctx.cwd });
            const lines = stdout.trimEnd().split(/\r?\n/);
            if (outputArray && typeof outputArray.set === "function") {
                outputArray.set(lines);
            }
            if (returnVarObj && typeof returnVarObj.set === "function") {
                returnVarObj.set(0);
            }
            return lines[lines.length - 1] || "";
        }
        catch (err) {
            if (returnVarObj && typeof returnVarObj.set === "function") {
                returnVarObj.set(err.status || 1);
            }
            return "";
        }
    }
    static async shell_exec(ctx, commandArg) {
        const command = String(commandArg?.get() ?? "");
        try {
            const { stdout } = await execAsync(command, { cwd: ctx.cwd });
            return stdout;
        }
        catch {
            return null;
        }
    }
    static escapeshellarg(ctx, argParam) {
        const arg = String(argParam?.get() ?? "");
        return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    static escapeshellcmd(ctx, cmdParam) {
        const cmd = String(cmdParam?.get() ?? "");
        return cmd.replace(/([#&;`|*?~<>^()\[\]{}$\\\x0A\xFF])/g, "\\$1");
    }
    static functions = {
        "exec": ExecRuntime.exec,
        "shell_exec": ExecRuntime.shell_exec,
        "escapeshellarg": ExecRuntime.escapeshellarg,
        "escapeshellcmd": ExecRuntime.escapeshellcmd,
    };
    static register(engine) {
        engine.registerFunctions(ExecRuntime.functions);
    }
}
exports.ExecRuntime = ExecRuntime;
(0, Reflection_1.defineFunction)(ExecRuntime.exec, {
    name: "exec",
    parameters: [{ name: "command" }, { name: "output", byref: true }, { name: "result_code", byref: true }],
});
//# sourceMappingURL=Exec.js.map