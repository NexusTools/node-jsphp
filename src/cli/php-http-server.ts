import * as http from "http";
import * as path from "path";
import * as fs from "fs/promises";
import { PHPEngine } from "../PHPEngine";

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

export async function runHTTPServer(port: number = 8080, docRoot: string = process.cwd()): Promise<http.Server> {
  const engine = new PHPEngine();
  const absoluteCwd = path.resolve(docRoot);

  const server = http.createServer(async (req, res) => {
    const rawUrl = req.url || "/";
    const [urlPath, queryString] = rawUrl.split("?");
    const decodedPath = decodeURIComponent(urlPath);

    // Resolve candidates
    const resolvedCandidate = await resolveCandidate(absoluteCwd, decodedPath);

    if (!resolvedCandidate) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!DOCTYPE html><html><body><h1>404 Not Found</h1><p>The requested URL ${decodedPath} was not found on this server.</p></body></html>`);
      return;
    }

    const { fullPath, isPHP } = resolvedCandidate;

    if (isPHP) {
      // Parse GET params
      const getParams: Record<string, string> = {};
      if (queryString) {
        const sp = new URLSearchParams(queryString);
        for (const [k, v] of sp.entries()) {
          getParams[k] = v;
        }
      }

      // Parse POST body if present
      const bodyChunks: Buffer[] = [];
      req.on("data", (chunk) => bodyChunks.push(chunk));

      await new Promise<void>((resolve) => req.on("end", resolve));
      const postData = Buffer.concat(bodyChunks).toString("utf8");
      const postParams: Record<string, string> = {};

      if (postData && req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
        const sp = new URLSearchParams(postData);
        for (const [k, v] of sp.entries()) {
          postParams[k] = v;
        }
      }

      let phpOutput = "";
      const ctx = engine.createContext({
        cwd: absoluteCwd,
        stdout: (data) => { phpOutput += data; },
        stderr: (data) => console.error(data),
        superglobals: {
          server: {
            REQUEST_METHOD: req.method || "GET",
            REQUEST_URI: rawUrl,
            DOCUMENT_ROOT: absoluteCwd,
            SCRIPT_FILENAME: fullPath,
            HTTP_HOST: req.headers.host || `127.0.0.1:${port}`,
          },
          get: getParams,
          post: postParams,
          cookie: parseCookieHeader(req.headers.cookie || ""),
        },
      });

      ctx.setInternalVar("hasServerResponseHandler", true);

      try {
        await ctx.require(fullPath);

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
      } catch (err: any) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
        }
        res.end(`PHP HTTP Server Error: ${err.message || err}`);
      }
    } else {
      // Serve static file
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

  return new Promise((resolve) => {
    server.listen(port, () => {
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
      // Try directory index files: index.php -> index.html
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
    // Path does not exist as-is; try extension resolutions
  }

  // Candidate 1: urlPath + .php (e.g. /test -> /test.php)
  const phpPath = targetPath + ".php";
  if (await fileExists(phpPath)) {
    return { fullPath: phpPath, isPHP: true };
  }

  // Candidate 2: urlPath + .html (e.g. /test -> /test.html)
  const htmlPath = targetPath + ".html";
  if (await fileExists(htmlPath)) {
    return { fullPath: htmlPath, isPHP: false };
  }

  // Candidate 3: urlPath/index.php
  const dirPhpPath = path.join(targetPath, "index.php");
  if (await fileExists(dirPhpPath)) {
    return { fullPath: dirPhpPath, isPHP: true };
  }

  // Candidate 4: urlPath/index.html
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
