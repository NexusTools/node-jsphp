import { PHPEngine } from "../../index.js";

describe("JSON Extension Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
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
