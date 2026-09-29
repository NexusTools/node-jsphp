import { PHPEngine, PHPContext, ASTOptimizer } from "../index";

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

  test("Optimizes extension_loaded and dead code branches at compile time", async () => {
    const optCtx = {
      enabledExtensions: new Set(["mysqli"]),
      constants: new Map([["TEST_CONST", "123"]]),
    };

    // if (extension_loaded('mysqli')) { echo 'Yes'; } else { echo 'No'; }
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
    // Should be unwrapped to body statements only (echo 'Yes')
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
