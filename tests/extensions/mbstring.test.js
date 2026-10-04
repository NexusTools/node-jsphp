import { PHPEngine } from "../../index.js";
describe("MBString Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("mb_strlen, mb_substr, mb_strtolower, mb_strtoupper", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      echo mb_strlen('hello') . ';';
      echo mb_substr('hello', 1, 3) . ';';
      echo mb_strtolower('HELLO') . ';';
      echo mb_strtoupper('hello') . ';';
    `);
        expect(out).toBe("5;ell;hello;HELLO;");
    });
});
//# sourceMappingURL=mbstring.test.js.map