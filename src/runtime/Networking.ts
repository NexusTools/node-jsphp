import * as dns from "dns/promises";
import * as os from "os";
import { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";
import { PHPWarning } from "./PHPError";

export class NetworkingRuntime {
  public static register(engine: PHPEngine): void {
    const register = engine.registerFunction.bind(engine);
    register("gethostname", () => NetworkingRuntime.gethostname());
    register("gethostbyname", async (ctx: PHPContext, name: string) => NetworkingRuntime.gethostbyname(name));
    register("gethostbyaddr", async (ctx: PHPContext, address: string) => NetworkingRuntime.gethostbyaddr(address));
    register("ip2long", (ctx: PHPContext, address: string) => NetworkingRuntime.ip2long(address));
    register("long2ip", (ctx: PHPContext, value: number) => NetworkingRuntime.long2ip(value));
    register("parse_url", (ctx: PHPContext, url: string, component = -1) => NetworkingRuntime.parse_url(url, component));
    register("parse_str", (ctx: PHPContext, query: string, result?: any) => NetworkingRuntime.parse_str(ctx, query, result));
    register("urlencode", (ctx: PHPContext, value: any) => NetworkingRuntime.urlencode(value));
    register("rawurlencode", (ctx: PHPContext, value: any) => NetworkingRuntime.urlencode(value, true));
    register("urldecode", (ctx: PHPContext, value: any) => NetworkingRuntime.urldecode(value));
    register("rawurldecode", (ctx: PHPContext, value: any) => NetworkingRuntime.urldecode(value, true));
    register("http_build_query", (ctx: PHPContext, data: any, prefix = "", separator = "&") => NetworkingRuntime.http_build_query(data, prefix, separator));
    register("header", (ctx: PHPContext, value: string, replace = true, code?: number) => NetworkingRuntime.header(ctx, value, replace, code));
    register("setcookie", (ctx: PHPContext, name: string, value = "", expires = 0, path = "", domain = "", secure = false, httpOnly = false) => NetworkingRuntime.setcookie(ctx, name, value, expires, path, domain, secure, httpOnly));
    register("setrawcookie", (ctx: PHPContext, name: string, value = "", expires = 0, path = "", domain = "", secure = false, httpOnly = false) => NetworkingRuntime.setrawcookie(ctx, name, value, expires, path, domain, secure, httpOnly));
    register("header_remove", (ctx: PHPContext, name?: string) => NetworkingRuntime.header_remove(ctx, name));
    register("headers_list", (ctx: PHPContext) => NetworkingRuntime.headers_list(ctx));
    register("headers_sent", (ctx: PHPContext) => NetworkingRuntime.headers_sent(ctx));
    register("http_response_code", (ctx: PHPContext, code?: number) => NetworkingRuntime.http_response_code(ctx, code));
  }

  public static parse_str(ctx: PHPContext, query: string, result?: any): void {
    const parsed: Record<string, any> = Object.create(null);
    for (const [name, value] of new URLSearchParams(String(query ?? ""))) {
      const bracket = name.indexOf("[");
      const base = (bracket < 0 ? name : name.slice(0, bracket)).replace(/[ .]/g, "_");
      if (!base) continue;
      const keys = [base, ...Array.from(name.slice(bracket < 0 ? name.length : bracket).matchAll(/\[([^\]]*)\]/g), (match) => match[1])];
      let target = parsed;
      keys.forEach((part, index) => {
        const key = part === "" ? String(Math.max(-1, ...Object.keys(target).filter((entry) => /^(0|[1-9]\d*)$/.test(entry)).map(Number)) + 1) : part;
        if (index === keys.length - 1) target[key] = value;
        else {
          if (!target[key] || typeof target[key] !== "object") target[key] = Object.create(null);
          target = target[key];
        }
      });
    }
    const normalize = (value: any): any => {
      if (!value || typeof value !== "object") return value;
      const keys = Object.keys(value);
      if (keys.length > 0 && keys.every((key, index) => key === String(index))) return keys.map((key) => normalize(value[key]));
      for (const key of keys) value[key] = normalize(value[key]);
      return value;
    };
    const output = normalize(parsed);
    ctx.setInternalVar("lastParseStrResult", output);
    if (result && typeof result === "object") {
      for (const key of Object.keys(result)) delete result[key];
      Object.defineProperties(result, Object.getOwnPropertyDescriptors(output));
    }
  }

  public static urlencode(value: any, raw = false): string {
    let encoded = encodeURIComponent(String(value ?? "")).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    if (!raw) encoded = encoded.replace(/~/g, "%7E").replace(/%20/g, "+");
    return encoded;
  }

  public static urldecode(value: any, raw = false): string {
    let encoded = String(value ?? "").replace(/&/g, "%26");
    if (raw) encoded = encoded.replace(/\+/g, "%2B");
    return new URLSearchParams(`value=${encoded}`).get("value") || "";
  }

  public static gethostname(): string {
    return os.hostname();
  }

  public static async gethostbyname(hostname: string): Promise<string> {
    try {
      const res = await dns.lookup(hostname, { family: 4 });
      return res.address;
    } catch {
      return hostname;
    }
  }

  public static async gethostbyaddr(ip: string): Promise<string | false> {
    try {
      const names = await dns.reverse(ip);
      return names[0] || false;
    } catch {
      return false;
    }
  }

  public static ip2long(ip: string): number | false {
    const parts = (ip || "").split(".");
    if (parts.length !== 4) return false;
    let num = 0;
    for (let i = 0; i < 4; i++) {
      const n = parseInt(parts[i], 10);
      if (isNaN(n) || n < 0 || n > 255) return false;
      num = (num << 8) + n;
    }
    return num >>> 0;
  }

  public static long2ip(num: number): string | false {
    if (typeof num !== "number" || num < 0 || num > 4294967295) return false;
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255,
    ].join(".");
  }

  public static parse_url(urlStr: string, component = -1): any {
    try {
      const parsed = new URL(urlStr, "http://localhost");
      const obj: Record<string, any> = {
        scheme: parsed.protocol.replace(":", ""),
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : undefined,
        user: parsed.username || undefined,
        pass: parsed.password || undefined,
        path: parsed.pathname,
        query: parsed.search ? parsed.search.substring(1) : undefined,
        fragment: parsed.hash ? parsed.hash.substring(1) : undefined,
      };

      if (component === 0) return obj.scheme;
      if (component === 1) return obj.host;
      if (component === 2) return obj.port;
      if (component === 3) return obj.user;
      if (component === 4) return obj.pass;
      if (component === 5) return obj.path;
      if (component === 6) return obj.query;
      if (component === 7) return obj.fragment;

      // Filter undefined
      const cleanObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) cleanObj[k] = v;
      }
      return cleanObj;
    } catch {
      return false;
    }
  }

  public static http_build_query(data: any, numericPrefix = "", argSeparator = "&"): string {
    if (!data || typeof data !== "object") return "";
    const params = new URLSearchParams();

    function build(obj: any, prefix = "") {
      for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix
          ? `${prefix}[${key}]`
          : /^\d+$/.test(key) && numericPrefix
          ? `${numericPrefix}${key}`
          : key;

        if (val !== null && typeof val === "object") {
          build(val, fullKey);
        } else if (val !== undefined) {
          params.append(fullKey, String(val ?? ""));
        }
      }
    }

    build(data);
    return params.toString().replace(/\+/g, "%20").replace(/&/g, argSeparator);
  }

  public static header(ctx: PHPContext, headerStr: string, replace = true, code?: number): void {
    if (!headerStr) return;
    if (!ctx.getInternalVar("hasServerResponseHandler")) {
      throw new PHPWarning("Cannot modify header information - no server response handler");
    }
    if (ctx.response.headersSent) {
      ctx.triggerError(`Cannot modify header information - headers already sent`, 2);
      return;
    }
    const idx = headerStr.indexOf(":");
    if (idx !== -1) {
      const name = headerStr.substring(0, idx).trim();
      const value = headerStr.substring(idx + 1).trim();
      ctx.response.setHeader(name, value, replace);
    } else if (headerStr.toUpperCase().startsWith("HTTP/")) {
      const parts = headerStr.split(" ");
      if (parts.length >= 2) {
        const statusCode = parseInt(parts[1], 10);
        if (!isNaN(statusCode)) {
          ctx.response.statusCode = statusCode;
        }
      }
    }
    if (code) {
      ctx.response.statusCode = code;
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
    if (!ctx.getInternalVar("hasServerResponseHandler")) {
      throw new PHPWarning("Cannot modify cookie information - no server response handler");
    }
    if (ctx.response.headersSent) {
      ctx.triggerError(`Cannot set cookie - headers already sent`, 2);
      return false;
    }
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
    if (!ctx.getInternalVar("hasServerResponseHandler")) {
      throw new PHPWarning("Cannot modify cookie information - no server response handler");
    }
    if (ctx.response.headersSent) {
      ctx.triggerError(`Cannot set raw cookie - headers already sent`, 2);
      return false;
    }
    ctx.response.setCookie(name, value, expires, path, domain, secure, httponly, true);
    return true;
  }

  public static header_remove(ctx: PHPContext, name?: string): void {
    if (!ctx.getInternalVar("hasServerResponseHandler")) {
      throw new PHPWarning("Cannot modify header information - no server response handler");
    }
    ctx.response.removeHeader(name);
  }

  public static headers_list(ctx: PHPContext): string[] {
    if (!ctx.getInternalVar("hasServerResponseHandler")) {
      throw new PHPWarning("Cannot access headers - no server response handler");
    }
    return ctx.response.getHeadersList();
  }

  public static headers_sent(ctx: PHPContext): boolean {
    return ctx.response.headersSent;
  }

  public static http_response_code(ctx: PHPContext, code?: number): number | boolean {
    if (!ctx.getInternalVar("hasServerResponseHandler")) {
      throw new PHPWarning("Cannot modify response code - no server response handler");
    }
    if (code !== undefined) {
      ctx.response.statusCode = code;
      return true;
    }
    return ctx.response.statusCode;
  }
}
