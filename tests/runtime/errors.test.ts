import { PHPEngine, ErrorException } from "../../index.js";

describe("PHP Error Handling & set_error_handler Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("Internal variables on PHPEngine and PHPContext are invisible to PHP userland", async () => {
    engine.setInternalVar("secretEngineKey", "ENGINE_SECRET");
    const ctx = engine.createContext();
    ctx.setInternalVar("secretContextKey", "CONTEXT_SECRET");

    expect(ctx.getInternalVar("secretEngineKey")).toBe("ENGINE_SECRET");
    expect(ctx.getInternalVar("secretContextKey")).toBe("CONTEXT_SECRET");

    // PHP userland cannot see internal variables in $GLOBALS or getVar
    expect(ctx.getVar("secretEngineKey")).toBeUndefined();
    expect(ctx.getVar("secretContextKey")).toBeUndefined();
  });

  test("set_error_handler catches trigger_error and converts to ErrorException", async () => {
    const ctx = engine.createContext();

    await ctx.eval(`
      set_error_handler(function($errno, $errstr, $errfile, $errline) {
        throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
      });

      $caught = false;
      try {
        trigger_error("Custom User Warning", E_USER_WARNING);
      } catch (ErrorException $e) {
        $caught = $e->getMessage();
      }
    `);

    expect(ctx.getVar("caught")).toContain("Custom User Warning");
  });

  test("restore_error_handler restores default handler", async () => {
    const ctx = engine.createContext();

    await ctx.eval(`
      set_error_handler(function($errno, $errstr) {
        return true; // Suppress
      });
      restore_error_handler();
    `);

    expect(ctx.errorHandlerStack.length).toBe(0);
  });
});
