import { Command } from "commander";
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";
import { PHPLiteral } from "../runtime/PHPVariable";

export async function runCLI(rawArgs: string[]): Promise<void> {
  const engine = new PHPEngine({ watch: false });

  const program = new Command();
  program
    .name("php")
    .description("JSPHP Command Line Interface")
    .version(`PHP ${PHPEngine.VERSION} (cli) (built: Jan 1 2026 00:00:00) (jsphp)\nCopyright (c) The PHP Group\nZend Engine v4.5.0, Copyright (c) Zend Technologies`, "-v, --version")
    .allowUnknownOption(true)
    .helpOption("-h, --help", "Display this help message")
    .option("-a, --interactive", "Run interactively (REPL)")
    .option("-c <path>", "Look for php.ini file in the specified directory")
    .option("-n", "No php.ini file will be used")
    .option("-d, --define <setting=value...>", "Define INI entry setting with value")
    .option("-e", "Generate extended information for debugger/profiler")
    .option("-f, --file <file>", "Parse and execute <file>")
    .option("-i, --info", "PHP information")
    .option("-l, --syntax-check", "Syntax check only (lint)")
    .option("-m, --modules", "Show loaded modules")
    .option("-r, --run <code>", "Run PHP <code> without using script tags <?..?>")
    .option("-B, --process-begin <code>", "Run PHP <code> before processing input lines")
    .option("-R, --process-line <code>", "Run PHP <code> for every input line")
    .option("-F, --process-file <file>", "Parse and execute <file> for every input line")
    .option("-E, --process-end <code>", "Run PHP <code> after processing input lines")
    .option("-s, --syntax-highlight", "Output HTML syntax highlighted source code")
    .option("-w, --strip", "Output source with stripped comments and whitespace")
    .option("--ini", "Show configuration file names")
    .option("--rf, --reflection-function <function>", "Show information about function")
    .option("--rc, --reflection-class <class>", "Show information about class")
    .option("--re, --reflection-extension <extension>", "Show information about extension")
    .option("--ri, --reflection-info <extension>", "Show configuration for extension");

  program.parse(rawArgs, { from: "user" });
  const options = program.opts();
  const args = program.args;

  if (rawArgs.includes("-v") || rawArgs.includes("--version")) {
    console.log(`PHP ${PHPEngine.VERSION} (cli) (built: Jan 1 2026 00:00:00) (jsphp)`);
    console.log("Copyright (c) The PHP Group");
    console.log("Zend Engine v4.5.0, Copyright (c) Zend Technologies");
    return;
  }

  if (options.modules) {
    console.log("[PHP Modules]");
    console.log("Core");
    const moduleNames = Array.from(engine.extensions.keys()).sort();
    for (const mod of moduleNames) {
      console.log(mod);
    }
    console.log("[Zend Modules]");
    return;
  }

  if (options.ini) {
    console.log("Configuration File (php.ini) Path: (none)");
    console.log("Loaded Configuration File:         (none)");
    console.log("Scan for additional .ini files in: (none)");
    console.log("Additional .ini files parsed:      (none)");
    return;
  }

  if (options.info) {
    console.log(`phpinfo()`);
    console.log(`PHP Version => ${PHPEngine.VERSION}`);
    console.log(`System => ${process.platform} ${process.arch}`);
    console.log(`Build Date => Jan 1 2026 00:00:00`);
    console.log(`Server API => Command Line Interface`);
    console.log(`Virtual Directory Support => disabled`);
    console.log(`Configuration File (php.ini) Path => (none)`);
    console.log(`Loaded Configuration File => (none)`);
    return;
  }

  if (options.reflectionFunction) {
    const fnName = String(options.reflectionFunction).toLowerCase();
    const fn = engine.functions[fnName];
    if (fn !== undefined) {
      console.log(`Function [ <internal:${fnName}> function ${fnName} ] { }`);
    } else {
      console.error(`Function ${options.reflectionFunction} does not exist`);
      process.exit(1);
    }
    return;
  }

  if (options.reflectionClass) {
    const clsName = String(options.reflectionClass).toLowerCase();
    const cls = engine.classes[clsName];
    if (cls) {
      console.log(`Class [ <user> class ${cls.name || options.reflectionClass} ] { }`);
    } else {
      console.error(`Class ${options.reflectionClass} does not exist`);
      process.exit(1);
    }
    return;
  }

  if (options.reflectionExtension || options.reflectionInfo) {
    const extName = String(options.reflectionExtension || options.reflectionInfo).toLowerCase();
    const ext = engine.extensions.get(extName);
    if (ext) {
      console.log(`Extension [ <persistent> extension # ${ext.name} version ${ext.version} ] { }`);
    } else {
      console.error(`Extension ${extName} does not exist`);
      process.exit(1);
    }
    return;
  }

  if (options.syntaxCheck) {
    const fileToLint = options.file || args[0];
    if (!fileToLint) {
      console.error("No input file specified for syntax check.");
      process.exit(1);
    }
    const resolvedPath = path.resolve(fileToLint);
    try {
      const code = fs.readFileSync(resolvedPath, "utf8");
      await engine.compileCode(code, resolvedPath);
      console.log(`No syntax errors detected in ${resolvedPath}`);
      return;
    } catch (err: any) {
      console.error(`Parse error: ${err.message} in ${resolvedPath}`);
      process.exit(255);
    }
  }

  if (options.run) {
    const scriptArgs = [ "-r", ...args ];
    const ctx = engine.createContext({
      stdout: (data) => process.stdout.write(data),
      stderr: (data) => process.stderr.write(data),
      superglobals: {
        server: {
          argv: scriptArgs,
          argc: String(scriptArgs.length),
        },
      },
    });
    try {
      await ctx.eval(options.run, "cli code");
    } catch (err: any) {
      if (err?.name === "PHPExit") {
        process.exit(err.status || 0);
      }
      throw err;
    }
    return;
  }

  if (options.processLine || options.processFile || options.processBegin || options.processEnd) {
    const ctx = engine.createContext({
      stdout: (data) => process.stdout.write(data),
      stderr: (data) => process.stderr.write(data),
    });

    if (options.processBegin) {
      await ctx.eval(options.processBegin, "process-begin");
    }

    if (options.processLine || options.processFile) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });

      for await (const line of rl) {
        ctx.setVar("arg", line);
        if (options.processLine) {
          await ctx.eval(options.processLine, "process-line");
        }
        if (options.processFile) {
          await ctx.require(path.resolve(options.processFile));
        }
      }
    }

    if (options.processEnd) {
      await ctx.eval(options.processEnd, "process-end");
    }
    return;
  }

  if (options.interactive) {
    console.log("Interactive shell");
    console.log("");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "php > ",
    });

    const ctx = engine.createContext({
      stdout: (data) => process.stdout.write(data),
      stderr: (data) => process.stderr.write(data),
    });

    let buffer = "";

    rl.prompt();
    rl.on("line", async (line) => {
      const trimmed = line.trim();
      if ((trimmed === "exit" || trimmed === "quit" || trimmed === "exit;") && !buffer) {
        rl.close();
        return;
      }

      buffer += (buffer ? "\n" : "") + line;

      const openBraces = (buffer.match(/\{/g) || []).length;
      const closeBraces = (buffer.match(/\}/g) || []).length;
      const openParens = (buffer.match(/\(/g) || []).length;
      const closeParens = (buffer.match(/\)/g) || []).length;

      if (openBraces > closeBraces || openParens > closeParens) {
        rl.setPrompt("   > ");
        rl.prompt();
        return;
      }

      rl.setPrompt("php > ");
      let codeToEval = buffer.trim();
      buffer = "";

      if (codeToEval && !codeToEval.endsWith(";") && !codeToEval.endsWith("}") && !codeToEval.endsWith("{")) {
        codeToEval += ";";
      }

      const beforeLen = ctx.outputText.length;
      try {
        await ctx.eval(codeToEval, "php shell code");
        if (ctx.outputText.length > beforeLen && !ctx.outputText.endsWith("\n")) {
          process.stdout.write("\n");
        }
      } catch (err: any) {
        if (err.name === "PHPExit") {
          process.exit(err.status || 0);
        } else if (err.getPHPStackTraceString) {
          console.error("Fatal error:", err.message);
          console.error(err.getPHPStackTraceString());
        } else {
          console.error("Error:", err.message || err);
        }
      }
      rl.prompt();
    });
    return;
  }

  const fileToExec = options.file || args[0];
  if (fileToExec) {
    const filePath = path.resolve(fileToExec);
    const positionalArgs = options.file ? args : args.slice(1);
    const scriptArgs = [ filePath, ...positionalArgs ];

    const ctx = engine.createContext({
      cwd: path.dirname(filePath),
      stdout: (data) => process.stdout.write(data),
      stderr: (data) => process.stderr.write(data),
      superglobals: {
        server: {
          SCRIPT_FILENAME: filePath,
          SCRIPT_NAME: filePath,
          PHP_SELF: filePath,
          argv: scriptArgs,
          argc: String(scriptArgs.length),
        },
      },
    });

    try {
      await ctx.require(filePath);
    } catch (err: any) {
      if (err?.name === "PHPExit") {
        process.exit(err.status || 0);
      }
      throw err;
    }
    return;
  }

  program.help();
}
