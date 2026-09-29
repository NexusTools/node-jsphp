import { PHPEngine } from "../../index";

describe("Networking Runtime Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("Networking functions: gethostname, ip2long, long2ip, parse_url, http_build_query, header, http_response_code", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    ctx.setInternalVar("hasServerResponseHandler", true);

    await ctx.eval(`
      echo long2ip(ip2long('127.0.0.1')) . ';';
      $u = parse_url('https://example.com:8080/path?a=1#frag');
      echo $u['host'] . ';';
      echo $u['port'] . ';';
      echo http_build_query(array('a' => '1', 'b' => '2')) . ';';
      http_response_code(201);
      echo http_response_code() . ';';
    `);
    expect(out).toBe("127.0.0.1;example.com;8080;a=1&b=2;201;");
  });

  test("Header output methods throw error in CLI mode without server response handler", async () => {
    const ctx = engine.createContext();
    await expect(ctx.eval("header('Location: /redirect');")).rejects.toThrow("Cannot modify header information");
  });
});
