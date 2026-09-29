import * as dns from "dns/promises";
import * as os from "os";
import type { PHPContext } from "../../PHPContext";
import { PHPWarning } from "../errors/PHPError";

export class NetworkingRuntime {
  public static checkServerOutputHandler(ctx: PHPContext, funcName: string): void {
    const hasHandler = ctx.getInternalVar("hasServerResponseHandler") || ctx.internalVars.has("serverOutputHandler");
    if (!hasHandler) {
      throw new PHPWarning(`Cannot modify header information - ${funcName}() is not supported in CLI mode unless a server response handler is provided`);
    }
  }

  public static gethostname(): string {
    return os.hostname();
  }

  public static async gethostbyname(hostname: string): Promise<string> {
    try {
      const res = await dns.lookup(hostname);
      return res.address;
    } catch {
      return hostname;
    }
  }

  public static async gethostbyaddr(ip: string): Promise<string> {
    try {
      const res = await dns.reverse(ip);
      return res[0] || ip;
    } catch {
      return ip;
    }
  }

  public static async gethostbynamel(hostname: string): Promise<string[] | false> {
    try {
      const res = await dns.resolve4(hostname);
      return res;
    } catch {
      return false;
    }
  }

  public static ip2long(ip: string): number | false {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;
    let num = 0;
    for (let i = 0; i < 4; i++) {
      const p = parseInt(parts[i], 10);
      if (isNaN(p) || p < 0 || p > 255) return false;
      num = (num << 8) + p;
    }
    return num >>> 0;
  }

  public static long2ip(num: number): string | false {
    if (num < 0 || num > 4294967295) return false;
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255,
    ].join(".");
  }

  public static parse_url(urlStr: string, component: number = -1): any {
    try {
      const u = new URL(urlStr);
      const parsed: Record<string, any> = {
        scheme: u.protocol.replace(":", ""),
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : undefined,
        user: u.username || undefined,
        pass: u.password || undefined,
        path: u.pathname,
        query: u.search ? u.search.substring(1) : undefined,
        fragment: u.hash ? u.hash.substring(1) : undefined,
      };

      if (component !== -1) {
        switch (component) {
          case 0: return parsed.scheme;
          case 1: return parsed.host;
          case 2: return parsed.port;
          case 3: return parsed.user;
          case 4: return parsed.pass;
          case 5: return parsed.path;
          case 6: return parsed.query;
          case 7: return parsed.fragment;
        }
      }
      return parsed;
    } catch {
      return false;
    }
  }

  public static http_build_query(data: any, numericPrefix = "", argSeparator = "&"): string {
    if (!data || typeof data !== "object") return "";
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(data)) {
      const k = typeof key === "number" ? `${numericPrefix}${key}` : key;
      params.append(k, String(val ?? ""));
    }
    return params.toString().replace(/&/g, argSeparator);
  }

  public static header(ctx: PHPContext, headerStr: string, replace = true, httpResponseCode?: number): void {
    NetworkingRuntime.checkServerOutputHandler(ctx, "header");

    if (httpResponseCode) {
      ctx.response.statusCode = httpResponseCode;
    }

    if (headerStr.startsWith("HTTP/")) {
      const parts = headerStr.split(" ");
      if (parts.length >= 2) {
        const code = parseInt(parts[1], 10);
        if (!isNaN(code)) ctx.response.statusCode = code;
      }
      return;
    }

    const colonIdx = headerStr.indexOf(":");
    if (colonIdx !== -1) {
      const name = headerStr.substring(0, colonIdx).trim();
      const val = headerStr.substring(colonIdx + 1).trim();
      ctx.response.setHeader(name, val, replace);
    }
  }

  public static setcookie(
    ctx: PHPContext,
    name: string,
    value = "",
    expires = 0,
    path = "",
    domain = "",
    secure = false,
    httponly = false
  ): boolean {
    NetworkingRuntime.checkServerOutputHandler(ctx, "setcookie");
    ctx.response.setCookie(name, value, expires, path, domain, secure, httponly, false);
    return true;
  }

  public static setrawcookie(
    ctx: PHPContext,
    name: string,
    value = "",
    expires = 0,
    path = "",
    domain = "",
    secure = false,
    httponly = false
  ): boolean {
    NetworkingRuntime.checkServerOutputHandler(ctx, "setrawcookie");
    ctx.response.setCookie(name, value, expires, path, domain, secure, httponly, true);
    return true;
  }

  public static header_remove(ctx: PHPContext, name?: string): void {
    NetworkingRuntime.checkServerOutputHandler(ctx, "header_remove");
    ctx.response.removeHeader(name);
  }

  public static headers_list(ctx: PHPContext): string[] {
    NetworkingRuntime.checkServerOutputHandler(ctx, "headers_list");
    return ctx.response.getHeadersList();
  }

  public static headers_sent(ctx: PHPContext): boolean {
    NetworkingRuntime.checkServerOutputHandler(ctx, "headers_sent");
    return ctx.response.headersSent;
  }

  public static http_response_code(ctx: PHPContext, responseCode?: number): number {
    NetworkingRuntime.checkServerOutputHandler(ctx, "http_response_code");
    if (responseCode !== undefined) {
      ctx.response.statusCode = responseCode;
      return responseCode;
    }
    return ctx.response.statusCode;
  }
}
