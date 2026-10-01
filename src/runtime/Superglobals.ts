export interface SuperglobalsOptions {
  env?: Record<string, string>;
  server?: Record<string, string>;
  get?: Record<string, any>;
  post?: Record<string, any>;
  files?: Record<string, any>;
  cookie?: Record<string, any>;
  session?: Record<string, any>;
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
    this.ENV = { ...process.env, ...options.env };
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
      SERVER_SOFTWARE: "JSPHP/8.5.0",
      SERVER_PROTOCOL: "HTTP/1.1",
      GATEWAY_INTERFACE: "CGI/1.1",
      HTTP_HOST: "localhost",
      HTTP_USER_AGENT: "JSPHP Engine",
      HTTP_ACCEPT: "*/*",
      ...options.server,
    };
    this.GET = { ...options.get };
    this.POST = { ...options.post };
    this.FILES = { ...options.files };
    this.COOKIE = { ...options.cookie };
    this.SESSION = { ...options.session };
    this.REQUEST = { ...this.GET, ...this.POST, ...this.COOKIE };
    this.GLOBALS = {};
  }
}
