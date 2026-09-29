"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Exec & Process Execution Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("shell_exec, escapeshellarg, escapeshellcmd", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      echo is_string(shell_exec('node -v')) ? 'OK;' : 'FAIL;';
      echo escapeshellarg("hello'world") . ';';
    `);
        expect(out).toContain("OK;'hello'\\''world';");
    });
});
//# sourceMappingURL=exec.test.js.map