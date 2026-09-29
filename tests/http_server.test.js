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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const php_http_server_1 = require("../src/cli/php-http-server");
describe("PHP HTTP Server & URL Resolution Tests", () => {
    let server;
    const testPort = 8888;
    const testDir = path.join(__dirname, "http_server_test_dir");
    beforeAll(async () => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        // Create test files
        fs.writeFileSync(path.join(testDir, "index.php"), `<?php echo "INDEX_PHP_OK;"; ?>`);
        fs.writeFileSync(path.join(testDir, "test.php"), `<?php echo "TEST_PHP_OK;"; ?>`);
        fs.writeFileSync(path.join(testDir, "static.html"), `<h1>STATIC_HTML_OK</h1>`);
        const subDir = path.join(testDir, "sub");
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir, { recursive: true });
        }
        fs.writeFileSync(path.join(subDir, "index.html"), `<h1>SUB_INDEX_HTML_OK</h1>`);
        server = await (0, php_http_server_1.runHTTPServer)(testPort, testDir);
    });
    afterAll((done) => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        if (server) {
            server.close(done);
        }
        else {
            done();
        }
    });
    function httpGet(urlPath) {
        return new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${testPort}${urlPath}`, (res) => {
                let text = "";
                res.on("data", (chunk) => { text += chunk; });
                res.on("end", () => {
                    resolve({ status: res.statusCode || 200, text, headers: res.headers });
                });
            }).on("error", reject);
        });
    }
    test("Resolves '/' to index.php and executes PHP", async () => {
        const res = await httpGet("/");
        expect(res.status).toBe(200);
        expect(res.text).toContain("INDEX_PHP_OK;");
    });
    test("Resolves '/test' to test.php and executes PHP", async () => {
        const res = await httpGet("/test");
        expect(res.status).toBe(200);
        expect(res.text).toContain("TEST_PHP_OK;");
    });
    test("Serves static html file for '/static.html'", async () => {
        const res = await httpGet("/static.html");
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("text/html");
        expect(res.text).toContain("STATIC_HTML_OK");
    });
    test("Resolves '/sub' to sub/index.html and serves static html", async () => {
        const res = await httpGet("/sub");
        expect(res.status).toBe(200);
        expect(res.text).toContain("SUB_INDEX_HTML_OK");
    });
    test("Returns 404 for non-existent path '/nonexistent'", async () => {
        const res = await httpGet("/nonexistent");
        expect(res.status).toBe(404);
        expect(res.text).toContain("404 Not Found");
    });
});
//# sourceMappingURL=http_server.test.js.map