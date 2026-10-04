import { PHPEngine } from "../../index.js";

describe("OpenSSL Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("openssl_random_pseudo_bytes", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $bytes = openssl_random_pseudo_bytes(16);
      echo strlen($bytes) === 16 ? 'OK;' : 'FAIL;';
    `);
    expect(out).toBe("OK;");
  });
});
