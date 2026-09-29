"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPEngine = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const chokidar_1 = __importDefault(require("chokidar"));
const PHPContext_1 = require("./PHPContext");
const JSTranspiler_1 = require("./parser/JSTranspiler");
const Strings_1 = require("./runtime/strings/Strings");
const Arrays_1 = require("./runtime/arrays/Arrays");
const FileSystem_1 = require("./runtime/fs/FileSystem");
const Networking_1 = require("./runtime/net/Networking");
const Math_1 = require("./runtime/math/Math");
const Variables_1 = require("./runtime/variables/Variables");
const DateTime_1 = require("./runtime/datetime/DateTime");
const Streams_1 = require("./runtime/streams/Streams");
const Exec_1 = require("./runtime/exec/Exec");
const Fiber_1 = require("./runtime/fibers/Fiber");
const Enum_1 = require("./runtime/enums/Enum");
const PHPError_1 = require("./runtime/errors/PHPError");
const Reflection_1 = require("./runtime/reflection/Reflection");
const mysqli_1 = require("./extensions/mysqli/mysqli");
const pdo_1 = require("./extensions/pdo/pdo");
const gd_1 = require("./extensions/gd/gd");
const pcre_1 = require("./extensions/pcre/pcre");
const mbstring_1 = require("./extensions/mbstring/mbstring");
const json_1 = require("./extensions/json/json");
const curl_1 = require("./extensions/curl/curl");
const session_1 = require("./extensions/session/session");
const xml_1 = require("./extensions/xml/xml");
const spl_1 = require("./extensions/spl/spl");
const hash_1 = require("./extensions/hash/hash");
const openssl_1 = require("./extensions/openssl/openssl");
class PHPEngine {
    extensions = new Map();
    constants = new Map();
    functions = new Map();
    classes = new Map();
    internalVars = new Map();
    compiledCache = new Map();
    watcher;
    transpiler;
    cacheDir;
    constructor(options = {}) {
        this.transpiler = new JSTranspiler_1.JSTranspiler();
        this.cacheDir = options.cacheDir || process.env.JSPHP_CACHE;
        // Set core PHP constants
        this.constants.set("PHP_VERSION", "8.5.0");
        this.constants.set("PHP_ENGINE", "jsphp");
        this.constants.set("PHP_OS", process.platform === "win32" ? "WINNT" : "Linux");
        this.constants.set("DIRECTORY_SEPARATOR", path.sep);
        this.constants.set("PATH_SEPARATOR", process.platform === "win32" ? ";" : ":");
        // PHP Error Level Constants
        this.constants.set("E_ERROR", 1);
        this.constants.set("E_WARNING", 2);
        this.constants.set("E_PARSE", 4);
        this.constants.set("E_NOTICE", 8);
        this.constants.set("E_CORE_ERROR", 16);
        this.constants.set("E_CORE_WARNING", 32);
        this.constants.set("E_COMPILE_ERROR", 64);
        this.constants.set("E_COMPILE_WARNING", 128);
        this.constants.set("E_USER_ERROR", 256);
        this.constants.set("E_USER_WARNING", 512);
        this.constants.set("E_USER_NOTICE", 1024);
        this.constants.set("E_STRICT", 2048);
        this.constants.set("E_RECOVERABLE_ERROR", 4096);
        this.constants.set("E_DEPRECATED", 8192);
        this.constants.set("E_USER_DEPRECATED", 16384);
        this.constants.set("E_ALL", 32767);
        if (options.constants) {
            for (const [key, val] of Object.entries(options.constants)) {
                this.constants.set(key, val);
            }
        }
        this.registerCoreFunctions();
        // Default extensions list if not explicitly provided
        const defaultExtensions = options.extensions || [
            new mysqli_1.MySQLiExtension(),
            new pdo_1.PDOExtension(),
            new gd_1.GDExtension(),
            new pcre_1.PCREExtension(),
            new mbstring_1.MbstringExtension(),
            new json_1.JSONExtension(),
            new curl_1.CurlExtension(),
            new session_1.SessionExtension(),
            new xml_1.XMLExtension(),
            new spl_1.SPLExtension(),
            new hash_1.HashExtension(),
            new openssl_1.OpenSSLExtension(),
        ];
        defaultExtensions.forEach((ext) => this.registerExtension(ext));
        if (options.watch !== false) {
            this.initWatcher();
        }
    }
    getInternalVar(name) {
        return this.internalVars.get(name);
    }
    setInternalVar(name, value) {
        this.internalVars.set(name, value);
    }
    getConstant(name) {
        if (!name || typeof name !== "string")
            return undefined;
        if (this.constants.has(name))
            return this.constants.get(name);
        if (this.constants.has(name.toUpperCase()))
            return this.constants.get(name.toUpperCase());
        if (this.constants.has(name.toLowerCase()))
            return this.constants.get(name.toLowerCase());
        return undefined;
    }
    registerCoreFunctions() {
        // Core definition & state
        this.functions.set("define", async (ctx, name, value) => {
            if (this.constants.has(name) || this.constants.has(name.toUpperCase())) {
                await ctx.triggerError(`Constant ${name} already defined`, 2);
                return false;
            }
            this.constants.set(name, value);
            return true;
        });
        this.functions.set("defined", (ctx, name) => {
            if (!name || typeof name !== "string")
                return false;
            return this.constants.has(name) || this.constants.has(name.toUpperCase());
        });
        this.functions.set("extension_loaded", (ctx, name) => {
            if (!name || typeof name !== "string")
                return false;
            return this.extensions.has(name.toLowerCase());
        });
        this.functions.set("function_exists", (ctx, name) => {
            if (!name || typeof name !== "string")
                return false;
            return this.functions.has(name.toLowerCase());
        });
        this.functions.set("class_exists", (ctx, name) => {
            if (!name || typeof name !== "string")
                return false;
            return this.classes.has(name.toLowerCase());
        });
        this.functions.set("constant", (ctx, name) => {
            return this.getConstant(name);
        });
        this.functions.set("assert", (ctx, assertion, description) => {
            if (!assertion) {
                if (description) {
                    throw new PHPError_1.PHPFatalError(`Assertion failed: ${description}`);
                }
                return false;
            }
            return true;
        });
        this.functions.set("is_callable", (ctx, v) => {
            if (typeof v === "function")
                return true;
            if (typeof v === "string")
                return this.functions.has(v.toLowerCase());
            if (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string") {
                const cls = this.classes.get(v[0].toLowerCase());
                return Boolean(cls && cls.methods && cls.methods.has(v[1].toLowerCase()));
            }
            return false;
        });
        this.functions.set("is_iterable", (ctx, v) => {
            return Array.isArray(v) || (v && typeof v === "object");
        });
        this.functions.set("is_countable", (ctx, v) => {
            return Array.isArray(v) || typeof v === "string";
        });
        this.functions.set("is_resource", (ctx, v) => {
            return v && typeof v === "object" && Boolean(v.isResource);
        });
        this.functions.set("version_compare", (ctx, v1, v2, op) => {
            return Strings_1.StringRuntime.version_compare(v1, v2, op);
        });
        this.functions.set("ini_get", (ctx, option) => {
            const opt = (option || "").toLowerCase();
            if (opt === "display_errors")
                return "1";
            if (opt === "memory_limit")
                return "512M";
            if (opt === "max_execution_time")
                return "30";
            if (opt === "post_max_size")
                return "64M";
            if (opt === "upload_max_filesize")
                return "64M";
            if (opt === "date.timezone")
                return "UTC";
            return "";
        });
        this.functions.set("ini_set", (ctx, option, value) => {
            return "";
        });
        this.functions.set("register_shutdown_function", (ctx, callback, ...args) => {
            ctx.setInternalVar("shutdownFunctions", [...(ctx.getInternalVar("shutdownFunctions") || []), { callback, args }]);
            return true;
        });
        this.functions.set("register_tick_function", (ctx, callback, ...args) => {
            return true;
        });
        this.functions.set("unregister_tick_function", (ctx, callback) => {
            return true;
        });
        // Error handling
        this.functions.set("set_error_handler", (ctx, handler, levels = 32767) => {
            return ctx.setErrorHandler(handler, levels);
        });
        this.functions.set("restore_error_handler", (ctx) => {
            return ctx.restoreErrorHandler();
        });
        this.functions.set("trigger_error", async (ctx, message, level = 1024) => {
            return await ctx.triggerError(message, level);
        });
        this.functions.set("user_error", async (ctx, message, level = 1024) => {
            return await ctx.triggerError(message, level);
        });
        this.functions.set("error_reporting", (ctx, level) => {
            const prev = ctx.errorReportingLevel;
            if (level !== undefined) {
                ctx.errorReportingLevel = level;
            }
            return prev;
        });
        // Output buffering & flush
        this.functions.set("flush", (ctx) => {
            ctx.flushHeaders();
            return true;
        });
        this.functions.set("ob_start", (ctx) => ctx.outputBuffer.start());
        this.functions.set("ob_get_clean", (ctx) => ctx.outputBuffer.getClean());
        this.functions.set("ob_get_contents", (ctx) => ctx.outputBuffer.getContents());
        this.functions.set("ob_flush", (ctx) => ctx.outputBuffer.flush());
        this.functions.set("ob_end_clean", (ctx) => ctx.outputBuffer.endClean());
        this.functions.set("ob_get_level", (ctx) => ctx.outputBuffer.getLevel());
        // Strings
        this.functions.set("strlen", (ctx, str) => Strings_1.StringRuntime.strlen(str));
        this.functions.set("substr", (ctx, str, start, length) => Strings_1.StringRuntime.substr(str, start, length));
        this.functions.set("strpos", (ctx, haystack, needle, offset = 0) => Strings_1.StringRuntime.strpos(haystack, needle, offset));
        this.functions.set("stripos", (ctx, haystack, needle, offset = 0) => Strings_1.StringRuntime.stripos(haystack, needle, offset));
        this.functions.set("strrpos", (ctx, haystack, needle, offset = 0) => Strings_1.StringRuntime.strrpos(haystack, needle, offset));
        this.functions.set("strripos", (ctx, haystack, needle, offset = 0) => Strings_1.StringRuntime.strripos(haystack, needle, offset));
        this.functions.set("strstr", (ctx, haystack, needle, before = false) => Strings_1.StringRuntime.strstr(haystack, needle, before));
        this.functions.set("str_replace", (ctx, search, replace, subject) => Strings_1.StringRuntime.str_replace(search, replace, subject));
        this.functions.set("str_ireplace", (ctx, search, replace, subject) => Strings_1.StringRuntime.str_ireplace(search, replace, subject));
        this.functions.set("sprintf", (ctx, fmt, ...args) => Strings_1.StringRuntime.sprintf(fmt, ...args));
        this.functions.set("printf", async (ctx, fmt, ...args) => {
            const res = Strings_1.StringRuntime.sprintf(fmt, ...args);
            await ctx.echo(res);
            return res.length;
        });
        this.functions.set("vsprintf", (ctx, fmt, args = []) => Strings_1.StringRuntime.sprintf(fmt, ...(Array.isArray(args) ? args : [])));
        this.functions.set("vprintf", async (ctx, fmt, args = []) => {
            const res = Strings_1.StringRuntime.sprintf(fmt, ...(Array.isArray(args) ? args : []));
            await ctx.echo(res);
            return res.length;
        });
        this.functions.set("explode", (ctx, delim, str, limit) => Strings_1.StringRuntime.explode(delim, str, limit));
        this.functions.set("implode", (ctx, glue, pieces) => Strings_1.StringRuntime.implode(glue, pieces));
        this.functions.set("trim", (ctx, str, chars) => Strings_1.StringRuntime.trim(str, chars));
        this.functions.set("ltrim", (ctx, str, chars) => Strings_1.StringRuntime.ltrim(str, chars));
        this.functions.set("rtrim", (ctx, str, chars) => Strings_1.StringRuntime.rtrim(str, chars));
        this.functions.set("strtolower", (ctx, str) => Strings_1.StringRuntime.strtolower(str));
        this.functions.set("strtoupper", (ctx, str) => Strings_1.StringRuntime.strtoupper(str));
        this.functions.set("ucfirst", (ctx, str) => Strings_1.StringRuntime.ucfirst(str));
        this.functions.set("lcfirst", (ctx, str) => Strings_1.StringRuntime.lcfirst(str));
        this.functions.set("ucwords", (ctx, str) => Strings_1.StringRuntime.ucwords(str));
        this.functions.set("strcmp", (ctx, s1, s2) => Strings_1.StringRuntime.strcmp(s1, s2));
        this.functions.set("addslashes", (ctx, str) => Strings_1.StringRuntime.addslashes(str));
        this.functions.set("stripslashes", (ctx, str) => Strings_1.StringRuntime.stripslashes(str));
        this.functions.set("htmlspecialchars", (ctx, str) => Strings_1.StringRuntime.htmlspecialchars(str));
        this.functions.set("htmlspecialchars_decode", (ctx, str) => Strings_1.StringRuntime.htmlspecialchars_decode(str));
        this.functions.set("nl2br", (ctx, str, xhtml = true) => Strings_1.StringRuntime.nl2br(str, xhtml));
        this.functions.set("str_repeat", (ctx, str, mult) => Strings_1.StringRuntime.str_repeat(str, mult));
        this.functions.set("str_pad", (ctx, str, len, pad = " ", type = 1) => Strings_1.StringRuntime.str_pad(str, len, pad, type));
        this.functions.set("str_split", (ctx, str, len = 1) => Strings_1.StringRuntime.str_split(str, len));
        this.functions.set("strrev", (ctx, str) => Strings_1.StringRuntime.strrev(str));
        this.functions.set("chr", (ctx, ascii) => Strings_1.StringRuntime.chr(ascii));
        this.functions.set("ord", (ctx, char) => Strings_1.StringRuntime.ord(char));
        this.functions.set("bin2hex", (ctx, str) => Strings_1.StringRuntime.bin2hex(str));
        this.functions.set("hex2bin", (ctx, str) => Strings_1.StringRuntime.hex2bin(str));
        // Arrays
        this.functions.set("count", (ctx, arr) => Arrays_1.ArrayRuntime.count(arr));
        this.functions.set("sizeof", (ctx, arr) => Arrays_1.ArrayRuntime.count(arr));
        this.functions.set("array_keys", (ctx, arr) => Arrays_1.ArrayRuntime.array_keys(arr));
        this.functions.set("array_values", (ctx, arr) => Arrays_1.ArrayRuntime.array_values(arr));
        this.functions.set("array_flip", (ctx, arr) => Arrays_1.ArrayRuntime.array_flip(arr));
        this.functions.set("array_reverse", (ctx, arr) => Arrays_1.ArrayRuntime.array_reverse(arr));
        this.functions.set("in_array", (ctx, needle, haystack, strict = false) => Arrays_1.ArrayRuntime.in_array(needle, haystack, strict));
        this.functions.set("array_search", (ctx, needle, haystack, strict = false) => Arrays_1.ArrayRuntime.array_search(needle, haystack, strict));
        this.functions.set("array_key_exists", (ctx, key, arr) => Arrays_1.ArrayRuntime.array_key_exists(key, arr));
        this.functions.set("key_exists", (ctx, key, arr) => Arrays_1.ArrayRuntime.array_key_exists(key, arr));
        this.functions.set("array_merge", (ctx, ...arrays) => Arrays_1.ArrayRuntime.array_merge(...arrays));
        this.functions.set("array_combine", (ctx, keys, values) => Arrays_1.ArrayRuntime.array_combine(keys, values));
        this.functions.set("array_slice", (ctx, arr, off, len) => Arrays_1.ArrayRuntime.array_slice(arr, off, len));
        this.functions.set("array_push", (ctx, arr, ...v) => Arrays_1.ArrayRuntime.array_push(arr, ...v));
        this.functions.set("array_pop", (ctx, arr) => Arrays_1.ArrayRuntime.array_pop(arr));
        this.functions.set("array_shift", (ctx, arr) => Arrays_1.ArrayRuntime.array_shift(arr));
        this.functions.set("array_unshift", (ctx, arr, ...v) => Arrays_1.ArrayRuntime.array_unshift(arr, ...v));
        this.functions.set("array_unique", (ctx, arr) => Arrays_1.ArrayRuntime.array_unique(arr));
        this.functions.set("array_column", (ctx, arr, col) => Arrays_1.ArrayRuntime.array_column(arr, col));
        this.functions.set("sort", (ctx, arr) => Arrays_1.ArrayRuntime.sort(arr));
        this.functions.set("rsort", (ctx, arr) => Arrays_1.ArrayRuntime.rsort(arr));
        // File system (all async)
        this.functions.set("file_get_contents", async (ctx, path) => await FileSystem_1.FileSystemRuntime.file_get_contents(path));
        this.functions.set("file_put_contents", async (ctx, path, data, flags = 0) => await FileSystem_1.FileSystemRuntime.file_put_contents(path, data, flags));
        this.functions.set("file_exists", async (ctx, path) => await FileSystem_1.FileSystemRuntime.file_exists(path));
        this.functions.set("is_dir", async (ctx, path) => await FileSystem_1.FileSystemRuntime.is_dir(path));
        this.functions.set("is_file", async (ctx, path) => await FileSystem_1.FileSystemRuntime.is_file(path));
        this.functions.set("is_readable", async (ctx, path) => await FileSystem_1.FileSystemRuntime.is_readable(path));
        this.functions.set("is_writable", async (ctx, path) => await FileSystem_1.FileSystemRuntime.is_writable(path));
        this.functions.set("filesize", async (ctx, path) => await FileSystem_1.FileSystemRuntime.filesize(path));
        this.functions.set("filemtime", async (ctx, path) => await FileSystem_1.FileSystemRuntime.filemtime(path));
        this.functions.set("realpath", async (ctx, path) => await FileSystem_1.FileSystemRuntime.realpath(path));
        this.functions.set("basename", (ctx, path, suf) => FileSystem_1.FileSystemRuntime.basename(path, suf));
        this.functions.set("dirname", (ctx, path) => FileSystem_1.FileSystemRuntime.dirname(path));
        this.functions.set("pathinfo", (ctx, path, flags = 15) => FileSystem_1.FileSystemRuntime.pathinfo(path, flags));
        this.functions.set("mkdir", async (ctx, path, mode = 0o777, rec = false) => await FileSystem_1.FileSystemRuntime.mkdir(path, mode, rec));
        this.functions.set("rmdir", async (ctx, path) => await FileSystem_1.FileSystemRuntime.rmdir(path));
        this.functions.set("unlink", async (ctx, path) => await FileSystem_1.FileSystemRuntime.unlink(path));
        this.functions.set("rename", async (ctx, oldn, newn) => await FileSystem_1.FileSystemRuntime.rename(oldn, newn));
        this.functions.set("copy", async (ctx, src, dest) => await FileSystem_1.FileSystemRuntime.copy(src, dest));
        this.functions.set("tempnam", async (ctx, dir, pfx) => await FileSystem_1.FileSystemRuntime.tempnam(dir, pfx));
        this.functions.set("sys_get_temp_dir", () => FileSystem_1.FileSystemRuntime.sys_get_temp_dir());
        this.functions.set("scandir", async (ctx, path) => await FileSystem_1.FileSystemRuntime.scandir(path));
        // Networking & Headers
        this.functions.set("gethostname", () => Networking_1.NetworkingRuntime.gethostname());
        this.functions.set("gethostbyname", async (ctx, name) => await Networking_1.NetworkingRuntime.gethostbyname(name));
        this.functions.set("gethostbyaddr", async (ctx, ip) => await Networking_1.NetworkingRuntime.gethostbyaddr(ip));
        this.functions.set("ip2long", (ctx, ip) => Networking_1.NetworkingRuntime.ip2long(ip));
        this.functions.set("long2ip", (ctx, num) => Networking_1.NetworkingRuntime.long2ip(num));
        this.functions.set("parse_url", (ctx, url, comp = -1) => Networking_1.NetworkingRuntime.parse_url(url, comp));
        this.functions.set("http_build_query", (ctx, data, prefix = "", sep = "&") => Networking_1.NetworkingRuntime.http_build_query(data, prefix, sep));
        this.functions.set("header", (ctx, headerStr, replace = true, code) => Networking_1.NetworkingRuntime.header(ctx, headerStr, replace, code));
        this.functions.set("setcookie", (ctx, name, val = "", exp = 0, p = "", d = "", sec = false, httpOnly = false) => Networking_1.NetworkingRuntime.setcookie(ctx, name, val, exp, p, d, sec, httpOnly));
        this.functions.set("setrawcookie", (ctx, name, val = "", exp = 0, p = "", d = "", sec = false, httpOnly = false) => Networking_1.NetworkingRuntime.setrawcookie(ctx, name, val, exp, p, d, sec, httpOnly));
        this.functions.set("header_remove", (ctx, name) => Networking_1.NetworkingRuntime.header_remove(ctx, name));
        this.functions.set("headers_list", (ctx) => Networking_1.NetworkingRuntime.headers_list(ctx));
        this.functions.set("headers_sent", (ctx) => Networking_1.NetworkingRuntime.headers_sent(ctx));
        this.functions.set("http_response_code", (ctx, code) => Networking_1.NetworkingRuntime.http_response_code(ctx, code));
        // Math
        this.functions.set("abs", (ctx, n) => Math_1.MathRuntime.abs(n));
        this.functions.set("ceil", (ctx, n) => Math_1.MathRuntime.ceil(n));
        this.functions.set("floor", (ctx, n) => Math_1.MathRuntime.floor(n));
        this.functions.set("round", (ctx, n, p = 0) => Math_1.MathRuntime.round(n, p));
        this.functions.set("max", (ctx, ...args) => Math_1.MathRuntime.max(...args));
        this.functions.set("min", (ctx, ...args) => Math_1.MathRuntime.min(...args));
        this.functions.set("pow", (ctx, b, e) => Math_1.MathRuntime.pow(b, e));
        this.functions.set("sqrt", (ctx, n) => Math_1.MathRuntime.sqrt(n));
        this.functions.set("rand", (ctx, min = 0, max = 2147483647) => Math_1.MathRuntime.rand(min, max));
        this.functions.set("mt_rand", (ctx, min = 0, max = 2147483647) => Math_1.MathRuntime.mt_rand(min, max));
        // Variables & Types
        this.functions.set("var_dump", (ctx, ...args) => Variables_1.VariablesRuntime.var_dump(ctx, ...args));
        this.functions.set("print_r", (ctx, val, ret = false) => Variables_1.VariablesRuntime.print_r(ctx, val, ret));
        this.functions.set("is_array", (ctx, v) => Variables_1.VariablesRuntime.is_array(v));
        this.functions.set("is_bool", (ctx, v) => Variables_1.VariablesRuntime.is_bool(v));
        this.functions.set("is_float", (ctx, v) => Variables_1.VariablesRuntime.is_float(v));
        this.functions.set("is_int", (ctx, v) => Variables_1.VariablesRuntime.is_int(v));
        this.functions.set("is_null", (ctx, v) => Variables_1.VariablesRuntime.is_null(v));
        this.functions.set("is_numeric", (ctx, v) => Variables_1.VariablesRuntime.is_numeric(v));
        this.functions.set("is_object", (ctx, v) => Variables_1.VariablesRuntime.is_object(v));
        this.functions.set("is_scalar", (ctx, v) => Variables_1.VariablesRuntime.is_scalar(v));
        this.functions.set("is_string", (ctx, v) => Variables_1.VariablesRuntime.is_string(v));
        this.functions.set("gettype", (ctx, v) => Variables_1.VariablesRuntime.gettype(v));
        this.functions.set("intval", (ctx, v, b = 10) => Variables_1.VariablesRuntime.intval(v, b));
        this.functions.set("floatval", (ctx, v) => Variables_1.VariablesRuntime.floatval(v));
        this.functions.set("strval", (ctx, v) => Variables_1.VariablesRuntime.strval(v));
        this.functions.set("boolval", (ctx, v) => Variables_1.VariablesRuntime.boolval(v));
        // Streams & Exec
        this.functions.set("stream_context_create", (ctx, opts = {}) => Streams_1.StreamRuntime.stream_context_create(opts));
        this.functions.set("stream_get_contents", async (ctx, stream, max = -1, off = -1) => await Streams_1.StreamRuntime.stream_get_contents(stream, max, off));
        this.functions.set("stream_get_wrappers", () => Streams_1.StreamRuntime.stream_get_wrappers());
        this.functions.set("stream_is_local", (ctx, stream) => Streams_1.StreamRuntime.stream_is_local(stream));
        this.functions.set("exec", async (ctx, cmd, out, ret) => await Exec_1.ExecRuntime.exec(ctx, cmd, out, ret));
        this.functions.set("shell_exec", async (ctx, cmd) => await Exec_1.ExecRuntime.shell_exec(ctx, cmd));
        this.functions.set("escapeshellarg", (ctx, arg) => Exec_1.ExecRuntime.escapeshellarg(arg));
        this.functions.set("escapeshellcmd", (ctx, cmd) => Exec_1.ExecRuntime.escapeshellcmd(cmd));
        // DateTime
        this.functions.set("time", () => DateTime_1.DateTimeRuntime.time());
        this.functions.set("microtime", (ctx, asFloat = false) => DateTime_1.DateTimeRuntime.microtime(asFloat));
        this.functions.set("date", (ctx, fmt, ts) => DateTime_1.DateTimeRuntime.date(fmt, ts));
        this.functions.set("strtotime", (ctx, timeStr, now) => DateTime_1.DateTimeRuntime.strtotime(timeStr, now));
        this.functions.set("date_default_timezone_get", () => DateTime_1.DateTimeRuntime.date_default_timezone_get());
        this.functions.set("date_default_timezone_set", (ctx, tz) => DateTime_1.DateTimeRuntime.date_default_timezone_set(tz));
        // Classes
        this.classes.set("datetime", DateTime_1.PHPDateTime);
        this.classes.set("reflectionclass", Reflection_1.ReflectionClass);
        this.classes.set("reflectionmethod", Reflection_1.ReflectionMethod);
        this.classes.set("reflectionproperty", Reflection_1.ReflectionProperty);
        this.classes.set("reflectionfunction", Reflection_1.ReflectionFunction);
        this.classes.set("reflectionparameter", Reflection_1.ReflectionParameter);
        this.classes.set("reflectiontype", Reflection_1.ReflectionType);
        this.classes.set("fiber", Fiber_1.PHPFiber);
        this.classes.set("enum", Enum_1.PHPEnum);
        this.classes.set("errorexception", PHPError_1.ErrorException);
    }
    registerExtension(extension) {
        this.extensions.set(extension.name.toLowerCase(), extension);
        extension.onInit(this);
        for (const [key, val] of Object.entries(extension.constants)) {
            this.constants.set(key, val);
            this.constants.set(key.toUpperCase(), val);
        }
        for (const [key, func] of Object.entries(extension.functions)) {
            this.functions.set(key.toLowerCase(), func);
        }
        for (const [key, cls] of Object.entries(extension.classes)) {
            this.classes.set(key.toLowerCase(), cls);
        }
    }
    getConfigurationSHA1() {
        const sortedExts = Array.from(this.extensions.keys()).sort().join(",");
        const sortedConsts = Array.from(this.constants.entries())
            .map(([k, v]) => `${k}=${v}`)
            .sort()
            .join(";");
        return crypto.createHash("sha1").update(`${sortedExts}|${sortedConsts}`).digest("hex");
    }
    async compileFile(filepath) {
        const resolvedPath = path.resolve(filepath);
        if (this.compiledCache.has(resolvedPath)) {
            return this.compiledCache.get(resolvedPath);
        }
        try {
            const source = await fs.readFile(resolvedPath, "utf8");
            const func = await this.compileCode(source, resolvedPath);
            this.compiledCache.set(resolvedPath, func);
            if (this.watcher) {
                this.watcher.add(resolvedPath);
            }
            return func;
        }
        catch {
            throw new PHPError_1.PHPFatalError(`Fatal error: require(${resolvedPath}): Failed opening required '${resolvedPath}'`);
        }
    }
    async compileCode(code, filepath = "eval") {
        const transpilation = this.transpiler.transpile(code, filepath, {
            engineSHA1: this.getConfigurationSHA1(),
            cacheDir: filepath === "eval" ? undefined : this.cacheDir,
            engine: this,
        });
        // Load compiled JS into Function wrapper
        const moduleObj = { exports: {} };
        const factory = new Function("module", "exports", "require", transpilation.code);
        factory(moduleObj, moduleObj.exports, require);
        return moduleObj.exports;
    }
    createContext(options = {}) {
        return new PHPContext_1.PHPContext(this, options);
    }
    initWatcher() {
        this.watcher = chokidar_1.default.watch([], { ignoreInitial: true });
        this.watcher.on("change", (changedPath) => {
            const resolved = path.resolve(changedPath);
            this.compiledCache.delete(resolved);
        });
    }
    close() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}
exports.PHPEngine = PHPEngine;
//# sourceMappingURL=PHPEngine.js.map