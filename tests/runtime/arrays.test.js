import { PHPEngine } from "../../index.js";
import { PHPLiteral } from "../../src/runtime/PHPVariable.js";
describe("Arrays Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({ watch: false });
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
    test("array_fill supports starting indices and empty arrays", async () => {
        const ctx = engine.createContext();
        await ctx.eval(`
      $values = array_fill(0, 3, true);
      $offset = array_fill(5, 2, 'item');
      $negative = array_fill(-2, 3, 'item');
      $empty = array_fill(5, 0, 'item');
    `);
        expect(ctx.getVar("values")).toEqual([true, true, true]);
        expect(ctx.getVar("offset")).toEqual({ 5: "item", 6: "item" });
        expect(ctx.getVar("negative")).toEqual({ "-2": "item", "-1": "item", 0: "item" });
        expect(ctx.getVar("empty")).toEqual([]);
        const fn = ctx.functions["array_fill"] || ctx.functionMissing("array_fill");
        await expect(fn(ctx, new PHPLiteral(0), new PHPLiteral(-1), new PHPLiteral("item"))).rejects.toThrow("must be greater than or equal to 0");
    });
});
//# sourceMappingURL=arrays.test.js.map