import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { runHTTPServer } from "../src/cli/php-http-server";

describe("PHP HTTP Server & URL Resolution Tests", () => {
  let server: http.Server;
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

    server = await runHTTPServer(testPort, testDir);
  });

  afterAll((done) => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  function httpGet(urlPath: string): Promise<{ status: number; text: string; headers: http.IncomingHttpHeaders }> {
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
