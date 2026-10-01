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
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const chokidar_1 = __importDefault(require("chokidar"));
const PHPContext_1 = require("./PHPContext");
const JSTranspiler_1 = require("./parser/JSTranspiler");
const Strings_1 = require("./runtime/Strings");
const Arrays_1 = require("./runtime/Arrays");
const FileSystem_1 = require("./runtime/FileSystem");
const Networking_1 = require("./runtime/Networking");
const Math_1 = require("./runtime/Math");
const Variables_1 = require("./runtime/Variables");
const DateTime_1 = require("./runtime/DateTime");
const Streams_1 = require("./runtime/Streams");
const Exec_1 = require("./runtime/Exec");
const Fiber_1 = require("./runtime/Fiber");
const Enum_1 = require("./runtime/Enum");
const PHPError_1 = require("./runtime/PHPError");
const Reflection_1 = require("./runtime/Reflection");
const OutputBuffer_1 = require("./runtime/OutputBuffer");
const mysqli_1 = require("./extensions/mysqli");
const pdo_1 = require("./extensions/pdo");
const gd_1 = require("./extensions/gd");
const pcre_1 = require("./extensions/pcre");
const mbstring_1 = require("./extensions/mbstring");
const json_1 = require("./extensions/json");
const curl_1 = require("./extensions/curl");
const session_1 = require("./extensions/session");
const xml_1 = require("./extensions/xml");
const spl_1 = require("./extensions/spl");
const hash_1 = require("./extensions/hash");
const openssl_1 = require("./extensions/openssl");
class PHPEngine {
    extensions = new Map();
    constants = new Map();
    functions = new Map();
    classes = new Map();
    internalVars = new Map();
    classResolvers = [];
    resolvingClasses = new WeakMap();
    compiledCache = new Map();
    watcher;
    transpiler;
    cacheDir;
    constructor(options = {}) {
        this.transpiler = new JSTranspiler_1.JSTranspiler();
        this.cacheDir = options.cacheDir === null
            ? null
            : (options.cacheDir || process.env.JSPHP_CACHE || path.join(os.tmpdir(), "jsphp_cache"));
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
        this.registerRuntimeImplementations();
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
    registerFunction(name, fn) {
        this.functions.set(name.toLowerCase(), fn);
    }
    registerConstant(name, value) {
        this.constants.set(name, value);
        this.constants.set(name.toUpperCase(), value);
    }
    registerClass(name, value) {
        this.classes.set(name.toLowerCase(), value);
    }
    registerClassResolver(resolver) {
        this.classResolvers.push(resolver);
    }
    async resolveClass(name, ctx) {
        const shortName = String(name).split("\\").pop() || String(name);
        const resolutionKey = String(name).toLowerCase();
        let resolvingClasses = this.resolvingClasses.get(ctx);
        if (!resolvingClasses) {
            resolvingClasses = new Set();
            this.resolvingClasses.set(ctx, resolvingClasses);
        }
        if (resolvingClasses.has(resolutionKey))
            return undefined;
        resolvingClasses.add(resolutionKey);
        try {
            for (const resolver of this.classResolvers) {
                await resolver(ctx, name);
                const resolved = this.classes.get(resolutionKey) || this.classes.get(shortName.toLowerCase());
                if (resolved)
                    return resolved;
            }
            const resolved = this.classes.get(resolutionKey) || this.classes.get(shortName.toLowerCase());
            if (resolved)
                return resolved;
            return undefined;
        }
        finally {
            resolvingClasses.delete(resolutionKey);
        }
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
        this.functions.set("exit", (ctx, status = 0) => {
            throw new PHPError_1.PHPExit(status);
        });
        this.functions.set("die", (ctx, status = 0) => {
            throw new PHPError_1.PHPExit(status);
        });
        this.functions.set("call_user_func", async (ctx, callback, ...args) => {
            if (!callback)
                return undefined;
            if (typeof callback === "function") {
                return await callback.apply(ctx, args);
            }
            if (typeof callback === "string") {
                return await ctx.callFunction(callback, args);
            }
            if (Array.isArray(callback) && callback.length === 2) {
                return await ctx.callMethod(callback[0], callback[1], args);
            }
            return undefined;
        });
        this.functions.set("call_user_func_array", async (ctx, callback, args = []) => {
            const arrArgs = Array.isArray(args) ? args : Object.values(args || {});
            if (!callback)
                return undefined;
            if (typeof callback === "function") {
                return await callback.apply(ctx, arrArgs);
            }
            if (typeof callback === "string") {
                return await ctx.callFunction(callback, arrArgs);
            }
            if (Array.isArray(callback) && callback.length === 2) {
                return await ctx.callMethod(callback[0], callback[1], arrArgs);
            }
            return undefined;
        });
        this.functions.set("define", async (ctx, name, value) => {
            if (ctx.hasConstant(name)) {
                await ctx.triggerError(`Constant ${name} already defined`, 2);
                return false;
            }
            ctx.defineConstant(name, value);
            return true;
        });
        this.functions.set("defined", (ctx, name) => {
            return ctx.hasConstant(name);
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
            return ctx.getConstant(name);
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
    }
    registerRuntimeImplementations() {
        Strings_1.StringRuntime.register(this);
        Arrays_1.ArrayRuntime.register(this);
        DateTime_1.DateTimeRuntime.register(this);
        FileSystem_1.FileSystemRuntime.register(this);
        Networking_1.NetworkingRuntime.register(this);
        Math_1.MathRuntime.register(this);
        Variables_1.VariablesRuntime.register(this);
        Streams_1.StreamRuntime.register(this);
        Exec_1.ExecRuntime.register(this);
        OutputBuffer_1.OutputBufferRuntime.register(this);
        PHPError_1.ErrorRuntime.register(this);
        Reflection_1.ReflectionRuntime.register(this);
        Fiber_1.FiberRuntime.register(this);
        Enum_1.EnumRuntime.register(this);
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
        return crypto.createHash("sha1").update(`v19|${sortedExts}|${sortedConsts}`).digest("hex");
    }
    async compileFile(filepath) {
        const resolvedPath = path.resolve(filepath);
        if (this.compiledCache.has(resolvedPath)) {
            return this.compiledCache.get(resolvedPath);
        }
        let source;
        try {
            source = await fs.readFile(resolvedPath, "utf8");
        }
        catch {
            throw new PHPError_1.PHPFatalError(`Fatal error: require(${resolvedPath}): Failed opening required '${resolvedPath}'`);
        }
        const func = await this.compileCode(source, resolvedPath);
        this.compiledCache.set(resolvedPath, func);
        if (this.watcher) {
            this.watcher.add(resolvedPath);
        }
        return func;
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