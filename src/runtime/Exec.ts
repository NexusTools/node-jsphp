import { exec } from "child_process";
import { promisify } from "util";
import type { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";

const execAsync = promisify(exec);

export class ExecRuntime {
  public static register(engine: PHPEngine): void {
    const register = engine.registerFunction.bind(engine);
    register("exec", async (ctx: PHPContext, command: string, output?: any[], status?: any) => ExecRuntime.exec(ctx, command, output, status));
    register("shell_exec", async (ctx: PHPContext, command: string) => ExecRuntime.shell_exec(ctx, command));
    register("escapeshellarg", (ctx: PHPContext, argument: string) => ExecRuntime.escapeshellarg(argument));
    register("escapeshellcmd", (ctx: PHPContext, command: string) => ExecRuntime.escapeshellcmd(command));
  }

  public static async exec(ctx: PHPContext, command: string, outputArray?: any[], returnVarObj?: any): Promise<string> {
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
    } catch (err: any) {
      if (returnVarObj && typeof returnVarObj === "object") {
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

  public static escapeshellarg(arg: string): string {
    return `'${String(arg ?? "").replace(/'/g, "'\\''")}'`;
  }

  public static escapeshellcmd(cmd: string): string {
    return String(cmd ?? "").replace(/([#&;`|*?~<>^()\[\]{}$\\\x0A\xFF])/g, "\\$1");
  }
}
