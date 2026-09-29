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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const chokidar_1 = __importDefault(require("chokidar"));
const PHPContext_1 = require("./PHPContext");
const JSTranspiler_1 = require("./parser/JSTranspiler");
const Strings_1 = require("./runtime/strings/Strings");
const Arrays_1 = require("./runtime/arrays/Arrays");
const FileSystem_1 = require("./runtime/fs/FileSystem");
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
    registerCoreFunctions() {
        this.functions.set("define", (ctx, name, value) => {
            this.constants.set(name, value);
            return true;
        });
        this.functions.set("defined", (ctx, name) => {
            return this.constants.has(name);
        });
        this.functions.set("extension_loaded", (ctx, name) => {
            return this.extensions.has(name.toLowerCase());
        });
        this.functions.set("function_exists", (ctx, name) => {
            return this.functions.has(name.toLowerCase());
        });
        this.functions.set("class_exists", (ctx, name) => {
            return this.classes.has(name.toLowerCase());
        });
        this.functions.set("constant", (ctx, name) => {
            return this.constants.get(name);
        });
        // Output buffering
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
        this.functions.set("explode", (ctx, delim, str, limit) => Strings_1.StringRuntime.explode(delim, str, limit));
        this.functions.set("implode", (ctx, glue, pieces) => Strings_1.StringRuntime.implode(glue, pieces));
        // Arrays
        this.functions.set("count", (ctx, arr) => Arrays_1.ArrayRuntime.count(arr));
        this.functions.set("in_array", (ctx, needle, haystack, strict = false) => Arrays_1.ArrayRuntime.in_array(needle, haystack, strict));
        this.functions.set("array_merge", (ctx, ...arrays) => Arrays_1.ArrayRuntime.array_merge(...arrays));
        // File system
        this.functions.set("file_get_contents", (ctx, path) => FileSystem_1.FileSystemRuntime.file_get_contents(path));
        this.functions.set("file_put_contents", (ctx, path, data, flags = 0) => FileSystem_1.FileSystemRuntime.file_put_contents(path, data, flags));
        this.functions.set("file_exists", (ctx, path) => FileSystem_1.FileSystemRuntime.file_exists(path));
        this.functions.set("is_dir", (ctx, path) => FileSystem_1.FileSystemRuntime.is_dir(path));
        this.functions.set("is_file", (ctx, path) => FileSystem_1.FileSystemRuntime.is_file(path));
        this.functions.set("unlink", (ctx, path) => FileSystem_1.FileSystemRuntime.unlink(path));
    }
    registerExtension(extension) {
        this.extensions.set(extension.name.toLowerCase(), extension);
        extension.onInit(this);
        for (const [key, val] of Object.entries(extension.constants)) {
            this.constants.set(key, val);
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
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`PHP file not found: ${resolvedPath}`);
        }
        const source = fs.readFileSync(resolvedPath, "utf8");
        const func = await this.compileCode(source, resolvedPath);
        this.compiledCache.set(resolvedPath, func);
        if (this.watcher) {
            this.watcher.add(resolvedPath);
        }
        return func;
    }
    async compileCode(code, filepath = "eval") {
        const optimizerCtx = {
            enabledExtensions: new Set(this.extensions.keys()),
            constants: this.constants,
        };
        const transpilation = this.transpiler.transpile(code, filepath, {
            engineSHA1: this.getConfigurationSHA1(),
            cacheDir: this.cacheDir,
            optimizerCtx,
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