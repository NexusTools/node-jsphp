import { PHPEngine } from "../../index.js";
describe("Networking Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("Networking functions: gethostname, ip2long, long2ip, parse_url, http_build_query, header, http_response_code", async () => {
        let out = "";
        let flushedStatus = 0;
        let flushedHeaders = [];
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        ctx.setInternalVar("hasServerResponseHandler", true);
        ctx.setInternalVar("onFlushHeaders", (statusCode, headers) => {
            flushedStatus = statusCode;
            flushedHeaders = headers;
        });
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
        expect(flushedStatus).toBe(200);
        expect(flushedHeaders).toEqual([]);
        expect(ctx.statusCode).toBe(201);
    });
    test("Header output methods use the server response handler", async () => {
        let flushedStatus = 0;
        let flushedHeaders = [];
        const ctx = engine.createContext();
        ctx.setInternalVar("hasServerResponseHandler", true);
        ctx.setInternalVar("onFlushHeaders", (statusCode, headers) => {
            flushedStatus = statusCode;
            flushedHeaders = headers;
        });
        await ctx.eval("header('Location: /redirect'); echo 'redirecting';");
        expect(flushedStatus).toBe(302);
        expect(flushedHeaders).toEqual([{ name: "Location", value: "/redirect" }]);
    });
    test("parse_str decodes nested fields through PHP reference wrappers", async () => {
        const ctx = engine.createContext();
        await ctx.eval(`
      function parse_wrapper($query, &$result) { parse_str($query, $result); }
      parse_wrapper('first.name=hello+world&items[]=one&items[]=two&settings[mode]=safe&same=old&same=new', $query);
      echo $query['first_name'] . ';' . $query['items'][1] . ';' . $query['settings']['mode'] . ';' . $query['same'];
      parse_str('__proto__[polluted]=yes', $safe);
    `);
        expect(ctx.outputText).toBe("hello world;two;safe;new");
        expect(ctx.getVar("query").items).toEqual(["one", "two"]);
        expect({}.polluted).toBeUndefined();
        expect(ctx.getVar("safe")["__proto__"].polluted).toBe("yes");
    });
    test("URL encoding distinguishes form spaces from raw URL encoding", async () => {
        const ctx = engine.createContext();
        await ctx.eval("echo urlencode('a b~') . ';' . rawurlencode('a b~') . ';' . urldecode('%61+%26') . ';' . rawurldecode('%61+%26');");
        expect(ctx.outputText).toBe("a+b%7E;a%20b~;a &;a+&");
    });
});
//# sourceMappingURL=networking.test.js.map