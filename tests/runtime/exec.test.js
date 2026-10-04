import { PHPEngine } from "../../index.js";
describe("Exec & Process Execution Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({ watch: false });
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