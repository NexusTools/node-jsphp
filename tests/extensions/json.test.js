"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("JSON Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("json_encode and json_decode", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $arr = array('a' => 1, 'b' => 2);
      $json = json_encode($arr);
      echo $json . ';';
      $dec = json_decode($json, true);
      echo $dec['b'] . ';';
    `);
        expect(out).toContain('{"a":1,"b":2};2;');
    });
});
//# sourceMappingURL=json.test.js.map