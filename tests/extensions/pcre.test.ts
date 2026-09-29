import { PHPEngine } from "../../index";

describe("PCRE Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("preg_match and preg_replace", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo preg_match('/[0-9]+/', 'abc123def') ? 'MATCH;' : 'NO;';
      echo preg_replace('/[0-9]+/', 'X', 'abc123def') . ';';
    `);
    expect(out).toBe("MATCH;abcXdef;");
  });
});
