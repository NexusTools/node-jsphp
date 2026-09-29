import * as net from "net";
import * as path from "path";
import { PHPEngine } from "../PHPEngine";

const FCGI_VERSION_1 = 1;
const FCGI_BEGIN_REQUEST = 1;
const FCGI_ABORT_REQUEST = 2;
const FCGI_END_REQUEST = 3;
const FCGI_PARAMS = 4;
const FCGI_STDIN = 5;
const FCGI_STDOUT = 6;
const FCGI_STDERR = 7;

function makeHeader(type: number, requestId: number, contentLength: number, paddingLength: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(FCGI_VERSION_1, 0);
  buf.writeUInt8(type, 1);
  buf.writeUInt16BE(requestId, 2);
  buf.writeUInt16BE(contentLength, 4);
  buf.writeUInt8(paddingLength, 6);
  buf.writeUInt8(0, 7);
  return buf;
}

function writeRecord(socket: net.Socket, type: number, requestId: number, content: Buffer): void {
  let offset = 0;
  while (offset < content.length || content.length === 0) {
    const chunkLen = Math.min(content.length - offset, 65535);
    const chunk = content.subarray(offset, offset + chunkLen);
    const paddingLen = (8 - (chunkLen % 8)) % 8;
    const header = makeHeader(type, requestId, chunkLen, paddingLen);
    socket.write(header);
    if (chunkLen > 0) socket.write(chunk);
    if (paddingLen > 0) socket.write(Buffer.alloc(paddingLen));
    offset += chunkLen;
    if (content.length === 0) break;
  }
}

function parseNameValuePairs(buf: Buffer): Record<string, string> {
  const params: Record<string, string> = {};
  let offset = 0;
  while (offset < buf.length) {
    if (offset >= buf.length) break;
    let nameLen = buf[offset++];
    if (nameLen >> 7) {
      nameLen = ((nameLen & 0x7f) << 24) | (buf[offset++] << 16) | (buf[offset++] << 8) | buf[offset++];
    }
    if (offset >= buf.length) break;
    let valLen = buf[offset++];
    if (valLen >> 7) {
      valLen = ((valLen & 0x7f) << 24) | (buf[offset++] << 16) | (buf[offset++] << 8) | buf[offset++];
    }
    const name = buf.toString("utf8", offset, offset + nameLen);
    offset += nameLen;
    const value = buf.toString("utf8", offset, offset + valLen);
    offset += valLen;
    params[name] = value;
  }
  return params;
}

interface FCGIRequestState {
  requestId: number;
  role: number;
  keepConn: boolean;
  paramsBuffers: Buffer[];
  params: Record<string, string>;
  stdinBuffers: Buffer[];
}

export async function runFPM(port: number = 9000, host: string = "127.0.0.1"): Promise<net.Server> {
  const engine = new PHPEngine();

  const server = net.createServer((socket) => {
    let rxBuffer = Buffer.alloc(0);
    const requests = new Map<number, FCGIRequestState>();

    socket.on("data", (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);

      while (rxBuffer.length >= 8) {
        const version = rxBuffer.readUInt8(0);
        const type = rxBuffer.readUInt8(1);
        const requestId = rxBuffer.readUInt16BE(2);
        const contentLength = rxBuffer.readUInt16BE(4);
        const paddingLength = rxBuffer.readUInt8(6);
        const totalRecordLen = 8 + contentLength + paddingLength;

        if (rxBuffer.length < totalRecordLen) {
          break; // Wait for complete record
        }

        const content = rxBuffer.subarray(8, 8 + contentLength);
        rxBuffer = rxBuffer.subarray(totalRecordLen);

        if (type === FCGI_BEGIN_REQUEST) {
          const role = content.readUInt16BE(0);
          const flags = content.readUInt8(2);
          const keepConn = Boolean(flags & 1);
          requests.set(requestId, {
            requestId,
            role,
            keepConn,
            paramsBuffers: [],
            params: {},
            stdinBuffers: [],
          });
        } else if (type === FCGI_PARAMS) {
          const req = requests.get(requestId);
          if (req) {
            if (content.length > 0) {
              req.paramsBuffers.push(content);
            } else {
              const fullParamsBuf = Buffer.concat(req.paramsBuffers);
              req.params = parseNameValuePairs(fullParamsBuf);
            }
          }
        } else if (type === FCGI_STDIN) {
          const req = requests.get(requestId);
          if (req) {
            if (content.length > 0) {
              req.stdinBuffers.push(content);
            } else {
              // STDIN EOF -> Execute request
              executeFCGIRequest(engine, socket, req).then(() => {
                requests.delete(requestId);
                if (!req.keepConn) {
                  socket.end();
                }
              }).catch((err) => {
                const errBuf = Buffer.from(`Status: 500 Internal Server Error\r\nContent-Type: text/plain\r\n\r\nPHP-FPM Error: ${err.message || err}`);
                writeRecord(socket, FCGI_STDOUT, requestId, errBuf);
                writeRecord(socket, FCGI_STDOUT, requestId, Buffer.alloc(0));

                const endBuf = Buffer.alloc(8);
                endBuf.writeUInt32BE(1, 0); // AppStatus 1
                endBuf.writeUInt8(0, 4); // ProtocolStatus complete
                writeRecord(socket, FCGI_END_REQUEST, requestId, endBuf);

                requests.delete(requestId);
                if (!req.keepConn) {
                  socket.end();
                }
              });
            }
          }
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`[jsphp-fpm] FastCGI server listening on ${host}:${port}`);
      resolve(server);
    });
  });
}

async function executeFCGIRequest(
  engine: PHPEngine,
  socket: net.Socket,
  req: FCGIRequestState
): Promise<void> {
  const p = req.params;
  const scriptPath = p["SCRIPT_FILENAME"] || p["PATH_TRANSLATED"] || "";
  const docRoot = p["DOCUMENT_ROOT"] || path.dirname(scriptPath);

  // Parse GET parameters
  const queryString = p["QUERY_STRING"] || "";
  const getParams: Record<string, string> = {};
  if (queryString) {
    const sp = new URLSearchParams(queryString);
    for (const [k, v] of sp.entries()) {
      getParams[k] = v;
    }
  }

  // Parse POST parameters
  const postData = Buffer.concat(req.stdinBuffers).toString("utf8");
  const postParams: Record<string, string> = {};
  if (postData && p["CONTENT_TYPE"]?.includes("application/x-www-form-urlencoded")) {
    const sp = new URLSearchParams(postData);
    for (const [k, v] of sp.entries()) {
      postParams[k] = v;
    }
  }

  let outputText = "";
  const ctx = engine.createContext({
    cwd: docRoot,
    stdout: (data) => { outputText += data; },
    stderr: (data) => {
      writeRecord(socket, FCGI_STDERR, req.requestId, Buffer.from(data));
    },
    superglobals: {
      server: p,
      get: getParams,
      post: postParams,
      cookie: parseCookieHeader(p["HTTP_COOKIE"] || ""),
      env: process.env as Record<string, string>,
    },
  });

  await ctx.require(scriptPath);

  // Default headers if none explicitly emitted by PHP
  let finalBuf: Buffer;
  if (outputText.startsWith("Status:") || outputText.startsWith("HTTP/") || outputText.includes("Content-Type:")) {
    finalBuf = Buffer.from(outputText, "utf8");
  } else {
    const defaultHeaders = "Status: 200 OK\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n";
    finalBuf = Buffer.from(defaultHeaders + outputText, "utf8");
  }

  writeRecord(socket, FCGI_STDOUT, req.requestId, finalBuf);
  writeRecord(socket, FCGI_STDOUT, req.requestId, Buffer.alloc(0)); // EOF

  const endBuf = Buffer.alloc(8);
  endBuf.writeUInt32BE(0, 0); // AppStatus 0
  endBuf.writeUInt8(0, 4); // ProtocolStatus COMPLETE
  writeRecord(socket, FCGI_END_REQUEST, req.requestId, endBuf);
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[name] = decodeURIComponent(val);
    }
  }
  return cookies;
}
