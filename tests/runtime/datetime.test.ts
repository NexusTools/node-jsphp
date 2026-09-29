import { PHPEngine } from "../../index";

describe("DateTime Runtime Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("DateTime functions: time, microtime, date, strtotime, date_default_timezone_get, date_default_timezone_set", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo time() > 0 ? 'OK;' : 'FAIL;';
      echo is_string(microtime()) ? 'OK;' : 'FAIL;';
      echo date('Y', strtotime('2026-01-01')) . ';';
      date_default_timezone_set('America/New_York');
      echo date_default_timezone_get() . ';';
    `);
    const year = new Date("2026-01-01").getFullYear();
    expect(out).toBe(`OK;OK;${year};America/New_York;`);
  });
});
