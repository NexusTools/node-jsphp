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
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const index_1 = require("../index");
describe("HTTP Server SAPI Tests", () => {
    let server;
    const testPort = 8888;
    const docRoot = path.join(__dirname, "http_server_test_dir");
    beforeAll(async () => {
        if (!fs.existsSync(docRoot)) {
            fs.mkdirSync(docRoot, { recursive: true });
        }
        // Create static index.html
        fs.writeFileSync(path.join(docRoot, "index.html"), "<!DOCTYPE html><html><body><h1>Static Test</h1></body></html>");
        // Create general_test.php in docRoot
        fs.writeFileSync(path.join(docRoot, "general_test.php"), `<?php
function calculate_sum($a, $b) {
    return $a + $b;
}

class TestCalculator {
    public function multiply($x, $y) {
        return $x * $y;
    }
}

$calc = new TestCalculator();
$sumResult = calculate_sum(15, 25);
$multResult = $calc->multiply(6, 7);

echo "METHOD: " . ($_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN') . "\\n";
echo "SUM: " . $sumResult . "\\n";
echo "MULT: " . $multResult . "\\n";
echo "QUERY_A: " . ($_GET['a'] ?? 'NONE') . "\\n";
echo "STATUS: SUCCESS\\n";
`);
        // Create fatal_error_test.php in docRoot
        fs.writeFileSync(path.join(docRoot, "fatal_error_test.php"), `<?php
function cause_error() {
    non_existent_function_call();
}
cause_error();
`);
        fs.writeFileSync(path.join(docRoot, "unexpected_error.php"), "<?php $value = 1; $value['invalid'] = 2;");
        server = await (0, index_1.runHTTPServer)(testPort, docRoot);
    });
    afterAll((done) => {
        if (server) {
            server.close(() => {
                if (fs.existsSync(docRoot)) {
                    fs.rmSync(docRoot, { recursive: true, force: true });
                }
                done();
            });
        }
        else {
            done();
        }
    });
    function makeRequest(urlPath, method = "GET", postData = "") {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: "127.0.0.1",
                port: testPort,
                path: urlPath,
                method: method,
                headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
            };
            const req = http.request(options, (res) => {
                let body = "";
                res.on("data", (chunk) => { body += chunk; });
                res.on("end", () => {
                    resolve({ status: res.statusCode || 0, headers: res.headers, body });
                });
            });
            req.on("error", reject);
            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }
    test("Serves static html files", async () => {
        const res = await makeRequest("/index.html");
        expect(res.status).toBe(200);
        expect(res.body).toContain("Static Test");
    });
    test("Executes general_test.php with classes, functions and query params", async () => {
        const res = await makeRequest("/general_test.php?a=100");
        expect(res.status).toBe(200);
        expect(res.body).toContain("METHOD: GET");
        expect(res.body).toContain("SUM: 40");
        expect(res.body).toContain("MULT: 42");
        expect(res.body).toContain("QUERY_A: 100");
        expect(res.body).toContain("STATUS: SUCCESS");
    });
    test("Returns HTTP 500 and PHP Stack Trace on fatal errors", async () => {
        const res = await makeRequest("/fatal_error_test.php");
        expect(res.status).toBe(500);
        expect(res.headers["content-type"]).toContain("text/html");
        expect(res.body).toContain("PHP Fatal Error");
        expect(res.body).toContain("PHP Stack Trace");
        expect(res.body).toContain("undefined function");
    });
    test("Virtualizes unexpected runtime errors instead of exposing JavaScript frames", async () => {
        const res = await makeRequest("/unexpected_error.php");
        expect(res.status).toBe(500);
        expect(res.body).toContain("PHP Stack Trace");
        expect(res.body).not.toContain("eval at compileCode");
        expect(res.body).not.toContain("PHPContext.js");
        expect(res.body).not.toContain("PHPContext.ts");
        expect(res.body).not.toContain("node:internal");
    });
});
//# sourceMappingURL=http_server.test.js.map