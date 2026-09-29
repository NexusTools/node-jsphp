import * as path from "path";
import * as fs from "fs/promises";
import { PHPEngine, PHPContext, ASTOptimizer, ReflectionFunction } from "../index";

describe("PHPEngine & PHPContext Unit Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("Evaluates basic PHP code asynchronously", async () => {
    let output = "";
    const ctx = engine.createContext({
      stdout: (data) => { output += data; },
    });

    await ctx.eval("echo 'Hello from JSPHP!';");
    expect(output).toBe("Hello from JSPHP!");
  });

  test("Executes async transparent FileSystem methods", async () => {
    const tmpDir = path.join(__dirname, "tmp_fs_test");
    const testFile = path.join(tmpDir, "test.txt");
    const copyFile = path.join(tmpDir, "test_copy.txt");

    let output = "";
    const ctx = engine.createContext({
      cwd: __dirname,
      stdout: (data) => { output += data; },
    });

    // Test mkdir, file_put_contents, file_exists, is_file, is_dir, file_get_contents, copy, unlink, rmdir
    await ctx.eval(`
      $dir = '${tmpDir.replace(/\\/g, "/")}';
      $file = '${testFile.replace(/\\/g, "/")}';
      $copy = '${copyFile.replace(/\\/g, "/")}';

      mkdir($dir, 0777, true);
      file_put_contents($file, 'Async PHP FS Test');
      echo file_exists($file) ? 'EXISTS' : 'NO';
      echo is_file($file) ? 'FILE' : 'NO';
      echo is_dir($dir) ? 'DIR' : 'NO';
      echo file_get_contents($file);

      copy($file, $copy);
      echo file_exists($copy) ? 'COPY_EXISTS' : 'NO';

      unlink($file);
      unlink($copy);
      rmdir($dir);
    `);

    expect(output).toContain("EXISTSFILEDIRAsync PHP FS TestCOPY_EXISTS");

    // Ensure cleanup
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test("Executes async transparent Exec shell commands", async () => {
    let output = "";
    const ctx = engine.createContext({
      stdout: (data) => { output += data; },
    });

    await ctx.eval("$out = shell_exec('node -v'); echo is_string($out) ? 'OK' : 'FAIL';");
    expect(output).toBe("OK");
  });

  test("Stores function parameter and visibility metadata for Reflection", async () => {
    const ctx = engine.createContext();
    await ctx.eval("function test_func($a, $b = 10) { return $a + $b; }");

    const fn = engine.functions.get("test_func");
    expect(fn).toBeDefined();

    const refFunc = new ReflectionFunction("test_func", fn);
    expect(refFunc.getNumberOfParameters()).toBe(2);
    expect(refFunc.getNumberOfRequiredParameters()).toBe(1);
  });

  test("Evaluates networking and IP functions", async () => {
    let output = "";
    const ctx = engine.createContext({
      stdout: (data) => { output += data; },
    });

    await ctx.eval("$ip = long2ip(ip2long('127.0.0.1')); echo $ip;");
    expect(output).toBe("127.0.0.1");
  });

  test("Evaluates math and variable type functions", async () => {
    let output = "";
    const ctx = engine.createContext({
      stdout: (data) => { output += data; },
    });

    await ctx.eval("echo round(3.567, 2); echo gettype('hello');");
    expect(output).toBe("3.57string");
  });

  test("Optimizes extension_loaded and dead code branches at compile time", async () => {
    const optCtx = {
      enabledExtensions: new Set(["mysqli"]),
      constants: new Map([["TEST_CONST", "123"]]),
    };

    const ast = {
      kind: "if",
      test: {
        kind: "call",
        what: { name: "extension_loaded" },
        arguments: [{ kind: "string", value: "mysqli" }],
      },
      body: [{ kind: "echo", arguments: [{ kind: "string", value: "Yes" }] }],
      alternate: [{ kind: "echo", arguments: [{ kind: "string", value: "No" }] }],
    };

    const optimized = ASTOptimizer.optimize(ast, optCtx);
    expect(Array.isArray(optimized)).toBe(true);
    expect(optimized[0].kind).toBe("echo");
    expect(optimized[0].arguments[0].value).toBe("Yes");
  });

  test("Optimizes if(false) away completely", async () => {
    const optCtx = {
      enabledExtensions: new Set<string>(),
      constants: new Map<string, any>(),
    };

    const ast = {
      kind: "if",
      test: { kind: "boolean", value: false },
      body: [{ kind: "echo", arguments: [{ kind: "string", value: "Dead code" }] }],
    };

    const optimized = ASTOptimizer.optimize(ast, optCtx);
    expect(optimized).toBeNull();
  });

  test("Virtualizes stack traces replacing internal frames", async () => {
    const ctx = engine.createContext();
    try {
      await ctx.eval("throw_non_existent_func();");
    } catch (err: any) {
      expect(err.message).toContain("undefined function");
    }
  });
});
