import { PHPEngine } from "../../index.js";
describe("XML Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("simplexml_load_string", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $xml = simplexml_load_string('<root><node>value</node></root>');
      echo is_object($xml) ? 'OK;' : 'FAIL;';
    `);
        expect(out).toBe("OK;");
    });
});
//# sourceMappingURL=xml.test.js.map