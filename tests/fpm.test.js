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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const php_fpm_1 = require("../src/cli/php-fpm");
function makeHeader(type, requestId, contentLength, paddingLength) {
    const buf = Buffer.alloc(8);
    buf.writeUInt8(1, 0);
    buf.writeUInt8(type, 1);
    buf.writeUInt16BE(requestId, 2);
    buf.writeUInt16BE(contentLength, 4);
    buf.writeUInt8(paddingLength, 6);
    buf.writeUInt8(0, 7);
    return buf;
}
function encodeNameValuePair(name, value) {
    const nameBuf = Buffer.from(name, "utf8");
    const valBuf = Buffer.from(value, "utf8");
    const nameLen = nameBuf.length;
    const valLen = valBuf.length;
    const headerBuf = Buffer.alloc((nameLen < 128 ? 1 : 4) + (valLen < 128 ? 1 : 4));
    let off = 0;
    if (nameLen < 128) {
        headerBuf.writeUInt8(nameLen, off++);
    }
    else {
        headerBuf.writeUInt32BE(nameLen | 0x80000000, off);
        off += 4;
    }
    if (valLen < 128) {
        headerBuf.writeUInt8(valLen, off++);
    }
    else {
        headerBuf.writeUInt32BE(valLen | 0x80000000, off);
        off += 4;
    }
    return Buffer.concat([headerBuf, nameBuf, valBuf]);
}
describe("FastCGI / PHP-FPM Server Protocol Tests", () => {
    let fpmServer;
    const testPort = 9090;
    const testScriptPath = path.join(__dirname, "fpm_sample.php");
    beforeAll(async () => {
        fs.writeFileSync(testScriptPath, `<?php echo "FASTCGI_OK;"; ?>`);
        fpmServer = await (0, php_fpm_1.runFPM)(testPort, "127.0.0.1");
    });
    afterAll((done) => {
        if (fs.existsSync(testScriptPath)) {
            fs.unlinkSync(testScriptPath);
        }
        if (fpmServer) {
            fpmServer.close(done);
        }
        else {
            done();
        }
    });
    test("Communicates over FastCGI protocol and returns PHP output", (done) => {
        const client = net.connect(testPort, "127.0.0.1", () => {
            // 1. FCGI_BEGIN_REQUEST
            const beginBuf = Buffer.alloc(8);
            beginBuf.writeUInt16BE(1, 0); // role = FCGI_RESPONDER
            beginBuf.writeUInt8(0, 2); // flags = 0
            const beginRecord = Buffer.concat([makeHeader(1, 1, 8, 0), beginBuf]);
            client.write(beginRecord);
            // 2. FCGI_PARAMS
            const p1 = encodeNameValuePair("SCRIPT_FILENAME", testScriptPath);
            const p2 = encodeNameValuePair("REQUEST_METHOD", "GET");
            const pBuf = Buffer.concat([p1, p2]);
            const paramsRecord = Buffer.concat([makeHeader(4, 1, pBuf.length, 0), pBuf]);
            const paramsEof = makeHeader(4, 1, 0, 0);
            client.write(Buffer.concat([paramsRecord, paramsEof]));
            // 3. FCGI_STDIN EOF
            const stdinEof = makeHeader(5, 1, 0, 0);
            client.write(stdinEof);
        });
        let receivedData = Buffer.alloc(0);
        client.on("data", (chunk) => {
            receivedData = Buffer.concat([receivedData, chunk]);
        });
        client.on("end", () => {
            const responseText = receivedData.toString("utf8");
            expect(responseText).toContain("FASTCGI_OK;");
            done();
        });
    });
});
//# sourceMappingURL=fpm.test.js.map