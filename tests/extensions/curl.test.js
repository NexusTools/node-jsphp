"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("cURL Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("curl_init, curl_setopt, curl_close", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $ch = curl_init('https://example.com');
      echo curl_setopt($ch, CURLOPT_RETURNTRANSFER, true) ? 'OK;' : 'FAIL;';
      echo curl_close($ch) ? 'CLOSED;' : 'FAIL;';
    `);
        expect(out).toBe("OK;CLOSED;");
    });
});
//# sourceMappingURL=curl.test.js.map