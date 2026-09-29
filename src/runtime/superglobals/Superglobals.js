"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Superglobals = void 0;
class Superglobals {
    SERVER;
    GET;
    POST;
    FILES;
    COOKIE;
    SESSION;
    ENV;
    REQUEST;
    GLOBALS;
    constructor(options = {}) {
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
exports.Superglobals = Superglobals;
//# sourceMappingURL=Superglobals.js.map