import { PHPEngine } from "../../index.js";

describe("GD Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("GD image functions: imagecreatetruecolor, imagesx, imagesy, gd_info", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $img = imagecreatetruecolor(100, 200);
      echo imagesx($img) . ';';
      echo imagesy($img) . ';';
      $info = gd_info();
      echo $info['GD Version'] !== '' ? 'OK;' : 'FAIL;';
    `);
    expect(out).toBe("100;200;OK;");
  });
});
