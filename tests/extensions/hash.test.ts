import { PHPEngine } from "../../index";

describe("Hash Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("hash and hash_hmac", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo hash('sha256', 'test') . ';';
      echo hash_hmac('sha256', 'test', 'secret') . ';';
    `);
    expect(out).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08;0329a06b62cd16b33eb6792be8c60b158d89a2ee3a876fce9a881ebb488c0914;");
  });
});
