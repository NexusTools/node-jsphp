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
const net = __importStar(require("net"));
const path = __importStar(require("path"));
const index_1 = require("../index");
// Helper to encode FastCGI record
function makeFCGIRecord(type, requestId, content) {
    const header = Buffer.alloc(8);
    header.writeUInt8(1, 0); // version
    header.writeUInt8(type, 1);
    header.writeUInt16BE(requestId, 2);
    header.writeUInt16BE(content.length, 4);
    header.writeUInt8(0, 6); // paddingLength
    header.writeUInt8(0, 7); // reserved
    return Buffer.concat([header, content]);
}
// Helper to encode FCGI_PARAMS
function makeFCGIParams(params) {
    const chunks = [];
    for (const [key, val] of Object.entries(params)) {
        const kLen = Buffer.byteLength(key);
        const vLen = Buffer.byteLength(val);
        const header = Buffer.alloc(kLen > 127 ? 4 : 1 + (vLen > 127 ? 4 : 1));
        let off = 0;
        if (kLen > 127) {
            header.writeUInt32BE(kLen | 0x80000000, off);
            off += 4;
        }
        else {
            header.writeUInt8(kLen, off++);
        }
        if (vLen > 127) {
            header.writeUInt32BE(vLen | 0x80000000, off);
            off += 4;
        }
        else {
            header.writeUInt8(vLen, off++);
        }
        chunks.push(header, Buffer.from(key, "utf8"), Buffer.from(val, "utf8"));
    }
    return Buffer.concat(chunks);
}
describe("FastCGI Process Manager (PHP-FPM) Tests", () => {
    let fpmServer;
    const fpmPort = 9090;
    const fixturesDir = path.join(__dirname, "fixtures");
    beforeAll(async () => {
        fpmServer = await (0, index_1.runFPM)(fpmPort, "127.0.0.1");
    });
    afterAll((done) => {
        if (fpmServer) {
            fpmServer.close(() => done());
        }
        else {
            done();
        }
    });
    test("Executes general_test.php over FastCGI protocol", (done) => {
        const client = net.createConnection({ port: fpmPort, host: "127.0.0.1" }, () => {
            const requestId = 1;
            // 1. FCGI_BEGIN_REQUEST
            const beginBody = Buffer.alloc(8);
            beginBody.writeUInt16BE(1, 0); // FCGI_RESPONDER
            beginBody.writeUInt8(0, 2); // flags
            client.write(makeFCGIRecord(1, requestId, beginBody)); // FCGI_BEGIN_REQUEST = 1
            // 2. FCGI_PARAMS
            const testFile = path.join(fixturesDir, "general_test.php");
            const paramsBuf = makeFCGIParams({
                SCRIPT_FILENAME: testFile,
                REQUEST_METHOD: "GET",
                QUERY_STRING: "a=100",
                DOCUMENT_ROOT: fixturesDir,
                SERVER_SOFTWARE: "JSPHP-FPM",
            });
            client.write(makeFCGIRecord(4, requestId, paramsBuf)); // FCGI_PARAMS = 4
            client.write(makeFCGIRecord(4, requestId, Buffer.alloc(0))); // Empty FCGI_PARAMS ends params
            // 3. Empty FCGI_STDIN
            client.write(makeFCGIRecord(5, requestId, Buffer.alloc(0))); // FCGI_STDIN = 5
        });
        let rawData = Buffer.alloc(0);
        client.on("data", (chunk) => {
            rawData = Buffer.concat([rawData, chunk]);
        });
        client.on("end", () => {
            const responseStr = rawData.toString("utf8");
            expect(responseStr).toContain("METHOD: GET");
            expect(responseStr).toContain("SUM: 40");
            expect(responseStr).toContain("MULT: 42");
            expect(responseStr).toContain("QUERY_A: 100");
            expect(responseStr).toContain("STATUS: SUCCESS");
            done();
        });
    });
});
//# sourceMappingURL=fpm.test.js.map