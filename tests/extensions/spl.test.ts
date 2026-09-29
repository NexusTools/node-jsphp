import { PHPEngine } from "../../index";

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
});
