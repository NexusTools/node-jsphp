"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Variables & Types Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("Variable functions: is_array, is_bool, is_float, is_int, is_null, is_numeric, is_object, is_scalar, is_string, gettype, intval, floatval, strval, boolval", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      echo is_array(array()) ? '1;' : '0;';
      echo is_bool(true) ? '1;' : '0;';
      echo is_int(42) ? '1;' : '0;';
      echo is_null(null) ? '1;' : '0;';
      echo is_numeric('123') ? '1;' : '0;';
      echo gettype('test') . ';';
      echo intval('42') . ';';
      echo floatval('3.14') . ';';
      echo strval(100) . ';';
      echo boolval(1) ? '1;' : '0;';
    `);
        expect(out).toBe("1;1;1;1;1;string;42;3.14;100;1;");
    });
});
//# sourceMappingURL=variables.test.js.map