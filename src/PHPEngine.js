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
const PHPObject_1 = require("./runtime/PHPObject");
const PHPVariable_1 = require("./runtime/PHPVariable");
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("source-map-support").install({ environment: "node", hookRequire: true });
}
catch { }
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
const CoreRuntime_1 = require("./runtime/CoreRuntime");
class PHPEngine {
    static REVISION = 135;
    static VERSION = "8.5.0";
    static TRUE = new PHPVariable_1.PHPLiteral(true);
    static FALSE = new PHPVariable_1.PHPLiteral(false);
    static NULL = new PHPVariable_1.PHPLiteral(null);
    extensions = new Map();
    constants = {};
    functions = {};
    classes = {};
    internalVars = {};
    classResolvers = [];
    resolvingClasses = new Map();
    compiledCache = new Map();
    watcher;
    transpiler;
    cacheDir;
    static coreConstants = {
        php_version: PHPEngine.VERSION,
        php_engine: "jsphp",
        php_os: process.platform === "win32" ? "WINNT" : "Linux",
        directory_separator: path.sep,
        path_separator: process.platform === "win32" ? ";" : ":",
        e_error: 1,
        e_warning: 2,
        e_parse: 4,
        e_notice: 8,
        e_core_error: 16,
        e_core_warning: 32,
        e_compile_error: 64,
        e_compile_warning: 128,
        e_user_error: 256,
        e_user_warning: 512,
        e_user_notice: 1024,
        e_strict: 2048,
        e_recoverable_error: 4096,
        e_deprecated: 8192,
        e_user_deprecated: 16384,
        e_all: 32767,
        case_lower: 0,
        case_upper: 1,
    };
    constructor(options = {}) {
        this.transpiler = new JSTranspiler_1.JSTranspiler();
        this.cacheDir = options.cacheDir === null
            ? null
            : (options.cacheDir || process.env.JSPHP_CACHE || path.join(os.tmpdir(), "jsphp_cache"));
        // Set core PHP constants
        Object.assign(this.constants, PHPEngine.coreConstants);
        if (options.constants) {
            Object.assign(this.constants, options.constants);
        }
        if (options.functions) {
            this.registerFunctions(options.functions);
        }
        if (options.classes) {
            for (const [key, value] of Object.entries(options.classes)) {
                this.classes[key.toLowerCase()] = value;
            }
        }
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
    /**
     * Gets an internal variable value. The `name` parameter must be provided in lowercase.
     */
    getInternalVar(name) {
        return this.internalVars[name];
    }
    /**
     * Sets an internal variable value. The `name` parameter must be provided in lowercase.
     */
    setInternalVar(name, value) {
        this.internalVars[name] = value;
    }
    /**
     * Registers a function. The `name` parameter must be provided in lowercase.
     */
    registerFunction(name, fn) {
        this.functions[name] = fn;
    }
    /**
     * Registers multiple functions using Object.assign. All keys must be provided in lowercase.
     */
    registerFunctions(functions) {
        Object.assign(this.functions, functions);
    }
    registerConstant(name, value) {
        this.constants[name] = value;
    }
    registerConstants(constants) {
        Object.assign(this.constants, constants);
    }
    registerClass(name, value) {
        this.classes[name] = value;
    }
    registerClasses(classes) {
        Object.assign(this.classes, classes);
    }
    /**
     * Registers a class resolver callback. Resolver should handle lowercase class names.
     */
    registerClassResolver(resolver) {
        this.classResolvers.push(resolver);
    }
    /**
     * Resolves a class by name using registered class resolvers.
     */
    async resolveClass(name, originalName, ctx) {
        const orig = originalName || name;
        const shortName = String(orig).split("\\").pop() || String(orig);
        const shortLower = String(name).split("\\").pop() || String(name);
        // the context classes uses the engine classes as it's prototype so there's no need to check the engine classes
        let resolved = ctx.classes[name] || ctx.classes[shortLower];
        if (resolved)
            return resolved;
        let resolvingClasses = this.resolvingClasses.get(ctx);
        if (!resolvingClasses) {
            resolvingClasses = new Set();
            this.resolvingClasses.set(ctx, resolvingClasses);
        }
        if (resolvingClasses.has(name))
            return undefined;
        resolvingClasses.add(name);
        try {
            for (const resolver of this.classResolvers) {
                await resolver(ctx, orig);
                resolved = ctx.classes[name] || ctx.classes[shortLower];
                if (resolved)
                    return resolved;
            }
        }
        finally {
            resolvingClasses.delete(name);
        }
        return undefined;
    }
    registerRuntimeImplementations() {
        CoreRuntime_1.CoreRuntime.register(this);
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
        if (extension.constants)
            this.registerConstants(extension.constants);
        if (extension.functions)
            this.registerFunctions(extension.functions);
        if (extension.classes)
            this.registerClasses(extension.classes);
    }
    getConfigurationSHA1() {
        const sortedExts = Array.from(this.extensions.keys())
            .sort()
            .map((k) => `${k}@${this.extensions.get(k)?.version || PHPEngine.VERSION}`)
            .join(",");
        const sortedConsts = Object.entries(this.constants)
            .map(([k, v]) => `${k}=${v}`)
            .sort()
            .join(";");
        const sortedFuncs = Object.keys(this.functions).sort().join(",");
        const sortedClasses = Object.keys(this.classes).sort().join(",");
        return crypto.createHash("sha1").update(`v${PHPEngine.REVISION}|${sortedExts}|${sortedConsts}|${sortedFuncs}|${sortedClasses}`).digest("hex");
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
            cacheDir: filepath === "eval" ? undefined : (this.cacheDir || undefined),
            engine: this,
        });
        const moduleObj = { exports: {} };
        try {
            const factory = new Function("module", "exports", "require", "PHPClass", "PHPObject", "PHPVariable", "PHPLiteral", "PHPFatalError", transpilation.code);
            factory(moduleObj, moduleObj.exports, require, PHPObject_1.PHPClass, PHPObject_1.PHPObject, PHPVariable_1.PHPVariable, PHPVariable_1.PHPLiteral, PHPError_1.PHPFatalError);
            return moduleObj.exports;
        }
        catch (err) {
            if (err.name === "SyntaxError") {
                try {
                    const vm = require("vm");
                    new vm.Script(transpilation.code);
                }
                catch (scriptErr) {
                    console.error(`SYNTAX_ERR in ${filepath}: ${scriptErr.message}\nSTACK:\n${scriptErr.stack}`);
                    const codeLines = transpilation.code.split("\n");
                    const match = (scriptErr.stack || "").match(/evalmachine\.<anonymous>:(\d+)/);
                    if (match) {
                        const lineNum = parseInt(match[1], 10);
                        console.error(`EXACT_ERROR_LINE ${lineNum}: ${codeLines[lineNum - 1]}`);
                    }
                }
            }
            throw err;
        }
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