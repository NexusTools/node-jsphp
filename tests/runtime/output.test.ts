import { PHPEngine } from "../../index.js";

describe("Output Buffering Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("ob_start, ob_get_clean, ob_get_level", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      ob_start();
      echo 'Buffered content';
      $buf = ob_get_clean();
      echo 'Direct content: ' . $buf;
    `);
    expect(out).toBe("Direct content: Buffered content");
  });
});
