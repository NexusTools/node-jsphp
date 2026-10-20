import { PHPEngine } from "../../index.js";
describe("Output Buffering Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({ watch: false });
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
    test("ob_get_length and ob_get_flush report and flush buffered output", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      ob_start();
      echo 'Buffered';
      $length = ob_get_length();
      $contents = ob_get_flush();
      echo $length . ':' . $contents;
    `);
        expect(out).toBe("Buffered8:Buffered");
    });
});
//# sourceMappingURL=output.test.js.map