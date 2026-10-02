import * as readline from "readline";
import * as path from "path";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";

export async function runCLI(args: string[]): Promise<void> {
  const engine = new PHPEngine({ watch: false });

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
      } catch (err: any) {
        if (err.name === "PHPExit") {
          process.exit(err.status);
        } else if (err.getPHPStackTraceString) {
          console.error("\nFatal error:", err.message);
          console.error(err.getPHPStackTraceString());
        } else {
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
