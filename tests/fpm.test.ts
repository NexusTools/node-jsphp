import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import { runFPM } from "../src/cli/php-fpm";

function makeHeader(type: number, requestId: number, contentLength: number, paddingLength: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(1, 0);
  buf.writeUInt8(type, 1);
  buf.writeUInt16BE(requestId, 2);
  buf.writeUInt16BE(contentLength, 4);
  buf.writeUInt8(paddingLength, 6);
  buf.writeUInt8(0, 7);
  return buf;
}

function encodeNameValuePair(name: string, value: string): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const valBuf = Buffer.from(value, "utf8");
  const nameLen = nameBuf.length;
  const valLen = valBuf.length;

  const headerBuf = Buffer.alloc((nameLen < 128 ? 1 : 4) + (valLen < 128 ? 1 : 4));
  let off = 0;

  if (nameLen < 128) {
    headerBuf.writeUInt8(nameLen, off++);
  } else {
    headerBuf.writeUInt32BE(nameLen | 0x80000000, off);
    off += 4;
  }

  if (valLen < 128) {
    headerBuf.writeUInt8(valLen, off++);
  } else {
    headerBuf.writeUInt32BE(valLen | 0x80000000, off);
    off += 4;
  }

  return Buffer.concat([headerBuf, nameBuf, valBuf]);
}

describe("FastCGI / PHP-FPM Server Protocol Tests", () => {
  let fpmServer: net.Server;
  const testPort = 9090;
  const testScriptPath = path.join(__dirname, "fpm_sample.php");

  beforeAll(async () => {
    fs.writeFileSync(testScriptPath, `<?php echo "FASTCGI_OK;"; ?>`);
    fpmServer = await runFPM(testPort, "127.0.0.1");
  });

  afterAll((done) => {
    if (fs.existsSync(testScriptPath)) {
      fs.unlinkSync(testScriptPath);
    }
    if (fpmServer) {
      fpmServer.close(done);
    } else {
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
