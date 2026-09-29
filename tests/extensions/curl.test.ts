import { PHPEngine } from "../../index";

describe("cURL Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("curl_init, curl_setopt, curl_close", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $ch = curl_init('https://example.com');
      echo curl_setopt($ch, CURLOPT_RETURNTRANSFER, true) ? 'OK;' : 'FAIL;';
      echo curl_close($ch) ? 'CLOSED;' : 'FAIL;';
    `);
    expect(out).toBe("OK;CLOSED;");
  });
});
