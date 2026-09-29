"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("MySQLi Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("MySQLi extension constants and functions", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      echo extension_loaded('mysqli') ? 'LOADED;' : 'NO;';
      echo MYSQLI_ASSOC . ';';
    `);
        expect(out).toBe("LOADED;1;");
    });
});
//# sourceMappingURL=mysqli.test.js.map