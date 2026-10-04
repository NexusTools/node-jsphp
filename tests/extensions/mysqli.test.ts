import { PHPEngine } from "../../index.js";

describe("MySQLi Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("MySQLi extension constants and functions", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo extension_loaded('mysqli') ? 'LOADED;' : 'NO;';
      echo MYSQLI_ASSOC . ';';
    `);
    expect(out).toBe("LOADED;1;");
  });
});
