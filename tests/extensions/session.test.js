"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Session Extension Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("session_start, session_id, session_destroy", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      echo session_start() ? 'STARTED;' : 'FAIL;';
      echo session_id() !== '' ? 'ID_OK;' : 'FAIL;';
      echo session_destroy() ? 'DESTROYED;' : 'FAIL;';
    `);
        expect(out).toBe("STARTED;ID_OK;DESTROYED;");
    });
});
//# sourceMappingURL=session.test.js.map