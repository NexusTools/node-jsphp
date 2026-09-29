"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("GD Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
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
//# sourceMappingURL=gd.test.js.map