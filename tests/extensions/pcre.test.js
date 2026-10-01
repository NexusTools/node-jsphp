"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("PCRE Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("preg_match and preg_replace", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      echo preg_match('/[0-9]+/', 'abc123def') ? 'MATCH;' : 'NO;';
      echo preg_replace('/[0-9]+/', 'X', 'abc123def') . ';';
    `);
        expect(out).toBe("MATCH;abcXdef;");
    });
    test("preg_match_all supports delimiters, output captures, and match ordering", async () => {
        const ctx = engine.createContext();
        await ctx.eval(`
      $count = preg_match_all('#([a-z]+)([0-9]+)#i', 'a1 B22', $matches);
      $set_count = preg_match_all('~([a-z]+)([0-9]+)~i', 'a1 B22', $sets, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
      preg_match('/(a)(z)?/', 'a', $single, PREG_UNMATCHED_AS_NULL);
      $empty_count = preg_match_all('/(?=a)/', 'aa');
      echo preg_replace('#[0-9]#', 'X', 'a1b2');
    `);
        expect(ctx.getVar("count")).toBe(2);
        expect(ctx.getVar("matches")).toEqual([["a1", "B22"], ["a", "B"], ["1", "22"]]);
        expect(ctx.getVar("set_count")).toBe(2);
        expect(ctx.getVar("sets")[1]).toEqual([["B22", 3], ["B", 3], ["22", 4]]);
        expect(ctx.getVar("single")).toEqual(["a", "a", null]);
        expect(ctx.getVar("empty_count")).toBe(2);
        expect(ctx.outputText).toBe("aXbX");
    });
});
//# sourceMappingURL=pcre.test.js.map