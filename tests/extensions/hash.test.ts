import { PHPEngine } from "../../index.js";

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

  test("md5 and sha1 return hexadecimal or raw binary digests", async () => {
    const ctx = engine.createContext();
    await ctx.eval("echo md5('test') . ';' . sha1('test'); $raw_md5 = md5('test', true); $raw_sha1 = sha1('test', true);");
    expect(ctx.outputText).toBe("098f6bcd4621d373cade4e832627b4f6;a94a8fe5ccb19ba61c4c0873d391e987982fbbd3");
    expect(Buffer.isBuffer(ctx.getVar("raw_md5"))).toBe(true);
    expect(ctx.getVar("raw_md5").length).toBe(16);
    expect(ctx.getVar("raw_sha1").length).toBe(20);
  });
});
