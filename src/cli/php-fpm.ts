import * as http from "http";
import * as path from "path";
import { PHPEngine } from "../PHPEngine";

export async function runFPM(port: number = 9000, docRoot: string = process.cwd()): Promise<void> {
  const engine = new PHPEngine();

  const server = http.createServer(async (req, res) => {
    const reqUrl = req.url || "/";
    const scriptPath = path.join(docRoot, reqUrl.split("?")[0]);

    const ctx = engine.createContext({
      cwd: docRoot,
      stdout: (data) => res.write(data),
      stderr: (data) => console.error(data),
      superglobals: {
        server: {
          REQUEST_METHOD: req.method || "GET",
          REQUEST_URI: reqUrl,
          DOCUMENT_ROOT: docRoot,
          SCRIPT_FILENAME: scriptPath,
        },
      },
    });

    res.statusCode = 200;
    try {
      await ctx.require(scriptPath);
    } catch (err: any) {
      res.statusCode = 500;
      res.write(`PHP-FPM Error: ${err.message || err}`);
    } finally {
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`[jsphp-fpm] listening on port ${port}, document root: ${docRoot}`);
  });
}
