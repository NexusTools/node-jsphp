import { exec } from "child_process";
import { promisify } from "util";
import type { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";
import { PHPVariable, PHPReference } from "./PHPVariable.js";
import { defineFunction } from "./Reflection.js";

const execAsync = promisify(exec);

export class ExecRuntime {
  /**
   * Execute an external program.
   * @param outputArray Output variable passed by reference to receive output lines.
   * @param returnVarObj Output variable passed by reference to receive exit status code.
   */
  public static async exec(ctx: PHPContext, commandArg?: PHPReference, outputArray?: PHPReference, returnVarObj?: PHPReference): Promise<string> {
    const command = String(await commandArg?.get() ?? "");
    try {
      const { stdout } = await execAsync(command, { cwd: ctx.cwd });
      const lines = stdout.trimEnd().split(/\r?\n/);
      if (outputArray && typeof outputArray.set === "function") {
        await outputArray.set(lines);
      }
      if (returnVarObj && typeof returnVarObj.set === "function") {
        await returnVarObj.set(0);
      }
      return lines[lines.length - 1] || "";
    } catch (err: any) {
      if (returnVarObj && typeof returnVarObj.set === "function") {
        await returnVarObj.set(err.status || 1);
      }
      return "";
    }
  }

  public static async shell_exec(ctx: PHPContext, commandArg?: PHPReference): Promise<string | null> {
    const command = String(await commandArg?.get() ?? "");
    try {
      const { stdout } = await execAsync(command, { cwd: ctx.cwd });
      return stdout;
    } catch {
      return null;
    }
  }

  public static async escapeshellarg(ctx: PHPContext, argParam?: PHPReference): Promise<string> {
    const arg = String(await argParam?.get() ?? "");
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  public static async escapeshellcmd(ctx: PHPContext, cmdParam?: PHPReference): Promise<string> {
    const cmd = String(await cmdParam?.get() ?? "");
    return cmd.replace(/([#&;`|*?~<>^()\[\]{}$\\\x0A\xFF])/g, "\\$1");
  }

  static functions = {
    "exec": ExecRuntime.exec,
    "shell_exec": ExecRuntime.shell_exec,
    "escapeshellarg": ExecRuntime.escapeshellarg,
    "escapeshellcmd": ExecRuntime.escapeshellcmd,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(ExecRuntime.functions);
  }
}

defineFunction(ExecRuntime.exec, {
  name: "exec",
  parameters: [{ name: "command" }, { name: "output", byref: true }, { name: "result_code", byref: true }],
});
