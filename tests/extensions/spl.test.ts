import { PHPEngine } from "../../index.js";
import { PHPLiteral } from "../../src/runtime/PHPVariable.js";

describe("SPL Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("spl_autoload_register and spl_autoload_unregister", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $loader = function($class) {};
      echo spl_autoload_register($loader) ? 'REG;' : 'FAIL;';
      echo spl_autoload_unregister($loader) ? 'UNREG;' : 'FAIL;';
    `);
    expect(out).toBe("REG;UNREG;");
  });

  test("spl_object_id and spl_object_hash preserve object and closure identity", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class Identity {}
      $first = new Identity();
      $second = new Identity();
      $callback = function() {};
      $first_id = spl_object_id($first);
      $again = spl_object_id($first);
      $second_id = spl_object_id($second);
      $first_hash = spl_object_hash($first);
      $second_hash = spl_object_hash($second);
      $callback_id = spl_object_id($callback);
    `);
    expect(ctx.getVar("first_id")).toBe(ctx.getVar("again"));
    expect(ctx.getVar("first_id")).not.toBe(ctx.getVar("second_id"));
    expect(ctx.getVar("first_hash")).toMatch(/^[a-f0-9]{32}$/);
    expect(ctx.getVar("first_hash")).not.toBe(ctx.getVar("second_hash"));
    expect(typeof ctx.getVar("callback_id")).toBe("number");
  });

  test.each(["spl_object_id", "spl_object_hash"])("%s rejects non-objects", async (functionName) => {
    const ctx = engine.createContext();
    const fn = ctx.functions[functionName] || ctx.functionMissing(functionName);
    await expect(fn(ctx, new PHPLiteral(null))).rejects.toThrow("must be of type object");
    await expect(fn(ctx, new PHPLiteral(42))).rejects.toThrow("must be of type object");
    await expect(fn(ctx, new PHPLiteral([]))).rejects.toThrow("must be of type object");
  });

  test("Concurrent contexts can autoload the same class independently", async () => {
    engine.registerClassResolver(async (ctx, className) => {
      if (className === "DeferredClass") {
        await ctx.eval("class DeferredClass { public static function value() { return 42; } }");
      }
    });
    const firstContext = engine.createContext();
    const secondContext = engine.createContext();
    await expect(Promise.all([
      (async () => (await firstContext.resolveClass("deferredclass")).value(firstContext))(),
      (async () => (await secondContext.resolveClass("deferredclass")).value(secondContext))(),
    ])).resolves.toEqual([42, 42]);
  });
});
