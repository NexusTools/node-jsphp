import { PHPEngine } from "../../index.js";

describe("Session Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("session_start, session_id, session_destroy", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo session_start() ? 'STARTED;' : 'FAIL;';
      echo session_id() !== '' ? 'ID_OK;' : 'FAIL;';
      echo session_destroy() ? 'DESTROYED;' : 'FAIL;';
    `);
    expect(out).toBe("STARTED;ID_OK;DESTROYED;");
  });
});
