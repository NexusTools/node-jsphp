import { PHPEngine } from "../../index.js";

describe("PDO Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("PDO extension constants and functions", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo extension_loaded('pdo') ? 'LOADED;' : 'NO;';
      echo PDO_FETCH_ASSOC . ';';
    `);
    expect(out).toBe("LOADED;2;");
  });
});
