import * as http from "http";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import cluster from "cluster";
import { Command } from "commander";
import { PHPEngine, getDefaultExtensions } from "../PHPEngine.js";
import { PHPError, PHPExit } from "../runtime/PHPError.js";
import { NodeJSExtension } from "../extensions/nodejs.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export interface HTTPServerOptions {
  cacheDir?: string;
  enableNodeJS?: boolean;
  disabledExtensions?: string[];
}

export async function runHTTPServerCLI(rawArgs: string[]): Promise<http.Server | void> {
  const program = new Command();
  program
    .name("php-http-server")
    .description("JSPHP Multiprocess HTTP Web Server")
    .option("-p, --port <number>", "Port number to listen on", "8080")
    .option("-d, --docroot <path>", "Document root directory", process.cwd())
    .option("-w, --workers <number>", "Number of cluster worker processes", String(os.cpus().length))
    .option("--no-cluster", "Disable Node.js cluster multiprocess mode")
    .option(
      "--disable-extension <extension>",
      "Disable a specific PHP extension",
      (val: string, memo: string[]) => {
        memo.push(...val.split(",").map((s) => s.trim()));
        return memo;
      },
      []
    )
    .option("-c, --cache-dir <path>", "Transpilation cache directory");

  program.parse(rawArgs, { from: "user" });
  const options = program.opts();

  const port = parseInt(options.port, 10) || 8080;
  const docRoot = path.resolve(options.docroot || process.cwd());
  const numWorkers = parseInt(options.workers, 10) || os.cpus().length;
  const disabledExtensions: string[] = options.disableExtension || [];
  const useCluster = options.cluster !== false;

  if (useCluster && cluster.isPrimary) {
    console.log(`[jsphp-http-server] Primary process ${process.pid} is running`);
    console.log(`[jsphp-http-server] Spawning ${numWorkers} worker process(es)...`);
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }
    cluster.on("exit", (worker) => {
      console.log(`[jsphp-http-server] Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork();
    });
  } else {
    return await runHTTPServer(port, docRoot, { cacheDir: options.cacheDir, disabledExtensions });
  }
}

export async function runHTTPServer(
  port: number = 8080,
  docRoot: string = process.cwd(),
  optionsArg?: string | HTTPServerOptions
): Promise<http.Server> {
  const options: HTTPServerOptions = typeof optionsArg === "string" ? { cacheDir: optionsArg } : (optionsArg || {});
  const disabledExts = (options.disabledExtensions || []).map((e) => e.toLowerCase());
  if (options.enableNodeJS === false && !disabledExts.includes("nodejs")) {
    disabledExts.push("nodejs");
  }

  const allExts = [...getDefaultExtensions(), new NodeJSExtension()].filter(
    (ext) => !disabledExts.includes(ext.name.toLowerCase())
  );

  const engine = new PHPEngine({ cacheDir: options.cacheDir || null, extensions: allExts });
  const absoluteCwd = path.resolve(docRoot);

  const server = http.createServer(async (req, res) => {
    const rawUrl = req.url || "/";
    const [urlPath, queryString] = rawUrl.split("?");
    const decodedPath = decodeURIComponent(urlPath);

    const resolvedCandidate = await resolveCandidate(absoluteCwd, decodedPath);

    if (!resolvedCandidate) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!DOCTYPE html><html><body><h1>404 Not Found</h1><p>The requested URL ${decodedPath} was not found on this server.</p></body></html>`);
      return;
    }

    const { fullPath, isPHP } = resolvedCandidate;

    if (isPHP) {
      const getParams: Record<string, string> = {};
      if (queryString) {
        const sp = new URLSearchParams(queryString);
        for (const [k, v] of sp.entries()) {
          getParams[k] = v;
        }
      }

      const bodyChunks: Buffer[] = [];
      const reqMethod = (req.method || "GET").toUpperCase();

      if (reqMethod !== "GET" && reqMethod !== "HEAD") {
        req.on("data", (chunk) => bodyChunks.push(chunk));
        if (!req.readableEnded) {
          req.resume();
          await new Promise<void>((resolve) => {
            req.on("end", resolve);
            req.on("error", () => resolve());
          });
        }
      }

      const postData = Buffer.concat(bodyChunks).toString("utf8");
      const postParams: Record<string, string> = {};

      if (postData && req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
        const sp = new URLSearchParams(postData);
        for (const [k, v] of sp.entries()) {
          postParams[k] = v;
        }
      }

      let phpOutput = "";
      const hostHeader = req.headers.host || `127.0.0.1:${port}`;
      const [hostName, hostPort] = hostHeader.split(":");

      const ctx = engine.createContext({
        cwd: absoluteCwd,
        stdout: (data) => { phpOutput += data; },
        stderr: (data) => console.error(data),
        superglobals: {
          server: {
            REQUEST_METHOD: req.method || "GET",
            REQUEST_URI: rawUrl,
            DOCUMENT_ROOT: absoluteCwd.replace(/\\/g, "/"),
            SCRIPT_FILENAME: fullPath.replace(/\\/g, "/"),
            SCRIPT_NAME: decodedPath,
            PHP_SELF: decodedPath,
            HTTP_HOST: hostHeader,
            SERVER_NAME: hostName || "127.0.0.1",
            SERVER_PORT: hostPort || String(port),
            SERVER_ADDR: "127.0.0.1",
            REMOTE_ADDR: req.socket.remoteAddress || "127.0.0.1",
            SERVER_SOFTWARE: `JSPHP HTTP Server / ${PHPEngine.VERSION}`,
            HTTP_USER_AGENT: req.headers["user-agent"] || "Mozilla/5.0",
            HTTP_ACCEPT: req.headers["accept"] || "*/*",
          },
          get: getParams,
          post: postParams,
          cookie: parseCookieHeader(req.headers.cookie || ""),
        },
      });

      ctx.setInternalVar("hasServerResponseHandler", true);

      try {
        await ctx.require(fullPath);
      } catch (err: any) {
        if (err instanceof PHPExit || err?.name === "PHPExit") {
          // Normal exit/redirect
        } else {
          console.error("HTTP_500_ERR:", err);
          const stackTrace = typeof err.getPHPStackTraceString === "function"
            ? err.getPHPStackTraceString()
            : PHPError.virtualizeJSStack(err.stack || String(err));

          const htmlError = `<!DOCTYPE html><html><head><title>500 Internal Server Error</title></head><body>` +
                            `<pre style="background:#f4f4f4;padding:12px;border:1px solid #ccc;font-family:monospace;">${escapeHtml(stackTrace)}</pre>` +
                            `</body></html>`;
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
          }
          res.end(htmlError);
          return;
        }
      }

      const statusCode = ctx.response.statusCode;
      res.statusCode = statusCode;

      for (const h of ctx.response.headers) {
        if (h.name.toLowerCase() === "set-cookie") {
          const existing = res.getHeader("Set-Cookie");
          if (existing) {
            const arr = Array.isArray(existing) ? existing : [String(existing)];
            res.setHeader("Set-Cookie", [...arr, h.value]);
          } else {
            res.setHeader("Set-Cookie", [h.value]);
          }
        } else {
          res.setHeader(h.name, h.value);
        }
      }

      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }

      res.end(phpOutput);
      ctx.close();
    } else {
      try {
        const fileData = await fs.readFile(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.statusCode = 200;
        res.setHeader("Content-Type", contentType);
        res.end(fileData);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(`Server Error: ${err.message || err}`);
      }
    }
  });

  server.on("close", () => engine.close());

  return new Promise((resolve) => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`[jsphp-http-server] listening on http://127.0.0.1:${port}, document root: ${absoluteCwd}`);
      resolve(server);
    });
  });
}

async function resolveCandidate(docRoot: string, urlPath: string): Promise<{ fullPath: string; isPHP: boolean } | null> {
  const targetPath = path.join(docRoot, urlPath);

  try {
    const stat = await fs.stat(targetPath);
    if (stat.isFile()) {
      return { fullPath: targetPath, isPHP: targetPath.endsWith(".php") };
    }
    if (stat.isDirectory()) {
      const indexPath = path.join(targetPath, "index.php");
      if (await fileExists(indexPath)) {
        return { fullPath: indexPath, isPHP: true };
      }
      const indexHtmlPath = path.join(targetPath, "index.html");
      if (await fileExists(indexHtmlPath)) {
        return { fullPath: indexHtmlPath, isPHP: false };
      }
    }
  } catch {
    // Try extension resolution
  }

  const phpPath = targetPath + ".php";
  if (await fileExists(phpPath)) {
    return { fullPath: phpPath, isPHP: true };
  }

  const htmlPath = targetPath + ".html";
  if (await fileExists(htmlPath)) {
    return { fullPath: htmlPath, isPHP: false };
  }

  const dirPhpPath = path.join(targetPath, "index.php");
  if (await fileExists(dirPhpPath)) {
    return { fullPath: dirPhpPath, isPHP: true };
  }

  const dirHtmlPath = path.join(targetPath, "index.html");
  if (await fileExists(dirHtmlPath)) {
    return { fullPath: dirHtmlPath, isPHP: false };
  }

  return null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
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

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
