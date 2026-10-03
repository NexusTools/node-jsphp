"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Superglobals = void 0;
const PHPEngine_1 = require("../PHPEngine");
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
        const opts = options || {};
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
            SERVER_SOFTWARE: `JSPHP/${PHPEngine_1.PHPEngine.VERSION}`,
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
exports.Superglobals = Superglobals;
//# sourceMappingURL=Superglobals.js.map