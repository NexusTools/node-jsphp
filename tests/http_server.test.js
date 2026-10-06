import { jest } from "@jest/globals";
import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { runHTTPServer, runHTTPServerCLI } from "../index.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe("HTTP Server SAPI Tests", () => {
    let server;
    const testPort = 8888;
    const docRoot = path.join(__dirname, "http_server_test_dir");
    beforeAll(async () => {
        jest.setTimeout(120000);
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
        fs.writeFileSync(path.join(docRoot, "ext_test.php"), `<?php
echo "NODEJS: " . (function_exists('njs_import') || function_exists('nodejs_require') ? 'YES' : 'NO') . "\\n";
echo "MYSQLI: " . (function_exists('mysqli_connect') ? 'YES' : 'NO') . "\\n";
echo "PCRE: " . (function_exists('preg_match') ? 'YES' : 'NO') . "\\n";
`);
        server = await runHTTPServer(testPort, docRoot);
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
    test("Default server includes nodejs and mysqli extensions", async () => {
        const res = await makeRequest("/ext_test.php");
        expect(res.status).toBe(200);
        expect(res.body).toContain("NODEJS: YES");
        expect(res.body).toContain("MYSQLI: YES");
        expect(res.body).toContain("PCRE: YES");
    });
    test("Disables specified extensions using disabledExtensions option", async () => {
        const customServer = await runHTTPServer(8890, docRoot, { disabledExtensions: ["nodejs", "mysqli"] });
        try {
            const res = await new Promise((resolve, reject) => {
                http.get("http://127.0.0.1:8890/ext_test.php", (r) => {
                    let b = "";
                    r.on("data", (chunk) => { b += chunk; });
                    r.on("end", () => resolve({ status: r.statusCode || 0, body: b }));
                }).on("error", reject);
            });
            expect(res.status).toBe(200);
            expect(res.body).toContain("NODEJS: NO");
            expect(res.body).toContain("MYSQLI: NO");
            expect(res.body).toContain("PCRE: YES");
        }
        finally {
            customServer.close();
        }
    });
    test("CLI --disable-extension flag disables specified extensions", async () => {
        const cliServer = await runHTTPServerCLI(["-p", "8891", "-d", docRoot, "--disable-extension", "nodejs", "--disable-extension", "mysqli", "--no-cluster"]);
        try {
            const res = await new Promise((resolve, reject) => {
                http.get("http://127.0.0.1:8891/ext_test.php", (r) => {
                    let b = "";
                    r.on("data", (chunk) => { b += chunk; });
                    r.on("end", () => resolve({ status: r.statusCode || 0, body: b }));
                }).on("error", reject);
            });
            expect(res.status).toBe(200);
            expect(res.body).toContain("NODEJS: NO");
            expect(res.body).toContain("MYSQLI: NO");
            expect(res.body).toContain("PCRE: YES");
        }
        finally {
            if (cliServer && "close" in cliServer) {
                await new Promise((resolve) => cliServer.close(() => resolve()));
            }
        }
    });
    test("Serves WordPress setup-config.php with rendered text and stylesheet", async () => {
        const wpDir = path.join(__dirname, "../wordpress-test");
        const wpServer = await runHTTPServer(8889, wpDir, { cacheDir: path.join(__dirname, "../.test_cache") });
        try {
            const res = await new Promise((resolve, reject) => {
                http.get("http://127.0.0.1:8889/wp-admin/setup-config.php", (r) => {
                    let b = "";
                    r.on("data", (chunk) => { b += chunk; });
                    r.on("end", () => resolve({ status: r.statusCode || 0, body: b }));
                }).on("error", reject);
            });
            console.log("STEP -1 HEAD:\n", res.body.slice(0, res.body.indexOf("</head>") + 7));
            expect(res.status).toBe(200);
            expect(res.body).toContain("wp-core-ui");
            expect(res.body).toMatch(/<link\s+rel=['"]stylesheet['"].*?install/i);
            const resStep1 = await new Promise((resolve, reject) => {
                http.get("http://127.0.0.1:8889/wp-admin/setup-config.php?step=1", (r) => {
                    let b = "";
                    r.on("data", (chunk) => { b += chunk; });
                    r.on("end", () => resolve({ status: r.statusCode || 0, body: b }));
                }).on("error", reject);
            });
            console.log("STEP 1 HEAD:\n", resStep1.body.slice(0, resStep1.body.indexOf("</head>") + 7));
            expect(resStep1.status).toBe(200);
            expect(resStep1.body).toContain("Database Name");
            expect(resStep1.body).toContain("Username");
            expect(resStep1.body).toContain("Password");
            expect(resStep1.body).toContain("wp-core-ui");
            expect(resStep1.body).toMatch(/<link\s+rel=['"]stylesheet['"].*?install/i);
        }
        finally {
            wpServer.close();
        }
    }, 180000);
});
//# sourceMappingURL=http_server.test.js.map