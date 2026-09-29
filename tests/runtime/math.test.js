"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Math Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("Math functions: abs, ceil, floor, round, max, min, pow, sqrt, rand, mt_rand", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      echo abs(-5) . ';';
      echo ceil(4.2) . ';';
      echo floor(4.8) . ';';
      echo round(4.56, 1) . ';';
      echo max(1, 5, 2) . ';';
      echo min(1, 5, 2) . ';';
      echo pow(2, 3) . ';';
      echo sqrt(16) . ';';
      $r = rand(1, 10);
      echo ($r >= 1 && $r <= 10) ? 'OK;' : 'FAIL;';
    `);
        expect(out).toBe("5;5;4;4.6;5;1;8;4;OK;");
    });
});
//# sourceMappingURL=math.test.js.map