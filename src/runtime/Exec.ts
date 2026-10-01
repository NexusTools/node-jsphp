import { exec } from "child_process";
import { promisify } from "util";
import type { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";
import { defineFunction } from "./Reflection";

const execAsync = promisify(exec);

export class ExecRuntime {
  /**
   * Execute an external program.
   * @param outputArray Output variable passed by reference to receive output lines.
   * @param returnVarObj Output variable passed by reference to receive exit status code.
   */
  public static async exec(ctx: PHPContext, command: string, outputArray?: any, returnVarObj?: any): Promise<string> {
    try {
      const { stdout } = await execAsync(command, { cwd: ctx.cwd });
      const lines = stdout.trimEnd().split(/\r?\n/);
      if (outputArray && typeof outputArray.set === "function") {
        outputArray.set(lines);
      } else if (Array.isArray(outputArray)) {
        outputArray.length = 0;
        outputArray.push(...lines);
      }
      if (returnVarObj && typeof returnVarObj.set === "function") {
        returnVarObj.set(0);
      } else if (returnVarObj && typeof returnVarObj === "object") {
        returnVarObj.val = 0;
      }
      return lines[lines.length - 1] || "";
    } catch (err: any) {
      if (returnVarObj && typeof returnVarObj.set === "function") {
        returnVarObj.set(err.status || 1);
      } else if (returnVarObj && typeof returnVarObj === "object") {
        returnVarObj.val = err.status || 1;
      }
      return "";
    }
  }

  public static async shell_exec(ctx: PHPContext, command: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(command, { cwd: ctx.cwd });
      return stdout;
    } catch {
      return null;
    }
  }

  public static escapeshellarg(ctx: PHPContext, arg: string): string {
    return `'${String(arg ?? "").replace(/'/g, "'\\''")}'`;
  }

  public static escapeshellcmd(ctx: PHPContext, cmd: string): string {
    return String(cmd ?? "").replace(/([#&;`|*?~<>^()\[\]{}$\\\x0A\xFF])/g, "\\$1");
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
