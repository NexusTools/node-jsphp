"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
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
    test("File handles support asynchronous creation, writing, reading, ownership, and closing", async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), "jsphp-stream-"));
        try {
            const ctx = engine.createContext({ cwd: directory });
            await ctx.eval(`
        $handle = fopen('probe.txt', 'wb');
        $opened = is_resource($handle);
        $written = fwrite($handle, 'contents');
        $closed = fclose($handle);
        $no_longer_resource = !is_resource($handle);
        $handle = fopen('probe.txt', 'rb');
        echo fread($handle, 3) . ';' . stream_get_contents($handle);
        fclose($handle);
        $owner = fileowner('probe.txt');
      `);
            expect(ctx.getVar("opened")).toBe(true);
            expect(ctx.getVar("written")).toBe(8);
            expect(ctx.getVar("closed")).toBe(true);
            expect(ctx.getVar("no_longer_resource")).toBe(true);
            expect(ctx.outputText).toBe("con;tents");
            expect(ctx.getVar("owner")).toBe((await fs.stat(path.join(directory, "probe.txt"))).uid);
        }
        finally {
            await fs.rm(directory, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=streams.test.js.map