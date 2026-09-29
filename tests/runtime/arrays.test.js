"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Arrays Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("Array functions: count, sizeof, array_keys, array_values, array_flip, array_reverse", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $arr = array('a' => 1, 'b' => 2);
      echo count($arr) . ';';
      echo sizeof($arr) . ';';
      echo implode(',', array_keys($arr)) . ';';
      echo implode(',', array_values($arr)) . ';';
      $flipped = array_flip($arr);
      echo $flipped['1'] . ';';
    `);
        expect(out).toBe("2;2;a,b;1,2;a;");
    });
    test("Array functions: in_array, array_search, array_key_exists, key_exists, array_merge, array_combine", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $arr = array('x' => 10, 'y' => 20);
      echo in_array(10, $arr) ? 'YES;' : 'NO;';
      echo array_search(20, $arr) . ';';
      echo array_key_exists('x', $arr) ? 'EXISTS;' : 'NO;';
      echo key_exists('y', $arr) ? 'EXISTS;' : 'NO;';
      $comb = array_combine(array('a', 'b'), array(1, 2));
      echo $comb['b'] . ';';
    `);
        expect(out).toBe("YES;y;EXISTS;EXISTS;2;");
    });
    test("Array functions: array_slice, array_push, array_pop, array_shift, array_unshift, array_unique, sort, rsort", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $arr = array(3, 1, 2, 2);
      $uniq = array_unique($arr);
      sort($uniq);
      echo implode(',', $uniq) . ';';
      rsort($uniq);
      echo implode(',', $uniq) . ';';
    `);
        expect(out).toBe("1,2,3;3,2,1;");
    });
});
//# sourceMappingURL=arrays.test.js.map