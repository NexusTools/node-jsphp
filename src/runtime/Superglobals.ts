import * as path from "path";
import * as os from "os";
import { PHPEngine } from "../PHPEngine";

export interface SuperglobalsOptions {
  env?: Record<string, string>;
  server?: Record<string, any>;
  get?: Record<string, any>;
  post?: Record<string, any>;
  files?: Record<string, any>;
  cookie?: Record<string, any>;
  session?: Record<string, any>;
  request?: Record<string, any>;
  ENV?: Record<string, string>;
  SERVER?: Record<string, string>;
  GET?: Record<string, any>;
  POST?: Record<string, any>;
  FILES?: Record<string, any>;
  COOKIE?: Record<string, any>;
  SESSION?: Record<string, any>;
  REQUEST?: Record<string, any>;
}

export class Superglobals {
  public SERVER: Record<string, any>;
  public GET: Record<string, any>;
  public POST: Record<string, any>;
  public FILES: Record<string, any>;
  public COOKIE: Record<string, any>;
  public SESSION: Record<string, any>;
  public ENV: Record<string, any>;
  public REQUEST: Record<string, any>;
  public GLOBALS: Record<string, any>;

  constructor(options: SuperglobalsOptions = {}) {
    const opts: any = options || {};
    this.ENV = { ...process.env, ...opts.env, ...opts.ENV };
    this.SERVER = {
      PHP_SELF: "/index.php",
      SCRIPT_NAME: "/index.php",
      SCRIPT_FILENAME: "/var/www/html/index.php",
      REQUEST_METHOD: "GET",
      QUERY_STRING: "",
      REQUEST_URI: "/",
      SERVER_NAME: "localhost",
      SERVER_ADDR: "127.0.0.1",
      SERVER_PORT: "80",
      REMOTE_ADDR: "127.0.0.1",
      DOCUMENT_ROOT: "/var/www/html",
      SERVER_SOFTWARE: `JSPHP/${PHPEngine.VERSION}`,
      SERVER_PROTOCOL: "HTTP/1.1",
      GATEWAY_INTERFACE: "CGI/1.1",
      HTTP_HOST: "localhost",
      HTTP_USER_AGENT: "JSPHP Engine",
      HTTP_ACCEPT: "*/*",
      ...opts.server,
      ...opts.SERVER,
    };
    this.GET = { ...opts.get, ...opts.GET };
    this.POST = { ...opts.post, ...opts.POST };
    this.FILES = { ...opts.files, ...opts.FILES };
    this.COOKIE = { ...opts.cookie, ...opts.COOKIE };
    this.SESSION = { ...opts.session, ...opts.SESSION };
    this.REQUEST = { ...this.GET, ...this.POST, ...this.COOKIE, ...opts.request, ...opts.REQUEST };
    this.GLOBALS = {};
  }
}
