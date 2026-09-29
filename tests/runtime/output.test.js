"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Output Buffering Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("ob_start, ob_get_clean, ob_get_level", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      ob_start();
      echo 'Buffered content';
      $buf = ob_get_clean();
      echo 'Direct content: ' . $buf;
    `);
        expect(out).toBe("Direct content: Buffered content");
    });
});
//# sourceMappingURL=output.test.js.map