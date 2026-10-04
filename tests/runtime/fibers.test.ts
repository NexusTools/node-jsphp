import { PHPEngine } from "../../index.js";

describe("Fibers & Coroutines Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("Fiber initialization and execution state", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $fiber = new Fiber(function() {
        return 'Fiber Result';
      });
      echo $fiber->isStarted() ? 'YES;' : 'NO;';
    `);
    expect(out).toBe("NO;");
  });
});
