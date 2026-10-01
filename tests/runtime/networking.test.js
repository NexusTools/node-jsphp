"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Networking Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
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
});
//# sourceMappingURL=networking.test.js.map