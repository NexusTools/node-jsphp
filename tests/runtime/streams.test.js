"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Streams Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("stream_context_create, stream_get_wrappers, stream_is_local", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $wrappers = stream_get_wrappers();
      echo in_array('file', $wrappers) ? 'OK;' : 'FAIL;';
      echo stream_is_local('file://test.txt') ? 'LOCAL;' : 'REMOTE;';
    `);
        expect(out).toBe("OK;LOCAL;");
    });
});
//# sourceMappingURL=streams.test.js.map