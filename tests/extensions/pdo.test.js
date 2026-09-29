"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("PDO Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("PDO extension constants and functions", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      echo extension_loaded('pdo') ? 'LOADED;' : 'NO;';
      echo PDO_FETCH_ASSOC . ';';
    `);
        expect(out).toBe("LOADED;2;");
    });
});
//# sourceMappingURL=pdo.test.js.map