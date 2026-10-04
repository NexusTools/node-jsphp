import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { PHPContext } from "./PHPContext.js";
import { JSTranspiler } from "./parser/JSTranspiler.js";
import { PHPClass, PHPObject } from "./runtime/PHPObject.js";
import { PHPVariable, PHPLiteral } from "./runtime/PHPVariable.js";
import vm from "vm";
import { StringRuntime } from "./runtime/Strings.js";
import { ArrayRuntime } from "./runtime/Arrays.js";
import { FileSystemRuntime } from "./runtime/FileSystem.js";
import { NetworkingRuntime } from "./runtime/Networking.js";
import { MathRuntime } from "./runtime/Math.js";
import { VariablesRuntime } from "./runtime/Variables.js";
import { DateTimeRuntime } from "./runtime/DateTime.js";
import { StreamRuntime } from "./runtime/Streams.js";
import { ExecRuntime } from "./runtime/Exec.js";
import { FiberRuntime } from "./runtime/Fiber.js";
import { EnumRuntime } from "./runtime/Enum.js";
import { ErrorRuntime, PHPFatalError } from "./runtime/PHPError.js";
import { ReflectionRuntime } from "./runtime/Reflection.js";
import { OutputBufferRuntime } from "./runtime/OutputBuffer.js";
import { MySQLiExtension } from "./extensions/mysqli.js";
import { PDOExtension } from "./extensions/pdo.js";
import { GDExtension } from "./extensions/gd.js";
import { PCREExtension } from "./extensions/pcre.js";
import { MbstringExtension } from "./extensions/mbstring.js";
import { JSONExtension } from "./extensions/json.js";
import { CurlExtension } from "./extensions/curl.js";
import { SessionExtension } from "./extensions/session.js";
import { XMLExtension } from "./extensions/xml.js";
import { SPLExtension } from "./extensions/spl.js";
import { HashExtension } from "./extensions/hash.js";
import { OpenSSLExtension } from "./extensions/openssl.js";
import { CoreRuntime } from "./runtime/CoreRuntime.js";
export class PHPEngine {
    static REVISION = 240;
    static VERSION = "8.5.0";
    static TRUE = new PHPLiteral(true);
    static FALSE = new PHPLiteral(false);
    static NULL = new PHPLiteral(null);
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
        this.transpiler = new JSTranspiler();
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
        const defaultExtensions = [
            new MySQLiExtension(),
            new PDOExtension(),
            new GDExtension(),
            new PCREExtension(),
            new MbstringExtension(),
            new JSONExtension(),
            new CurlExtension(),
            new SessionExtension(),
            new XMLExtension(),
            new SPLExtension(),
            new HashExtension(),
            new OpenSSLExtension(),
            ...(options.extensions || []),
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
        CoreRuntime.register(this);
        StringRuntime.register(this);
        ArrayRuntime.register(this);
        DateTimeRuntime.register(this);
        FileSystemRuntime.register(this);
        NetworkingRuntime.register(this);
        MathRuntime.register(this);
        VariablesRuntime.register(this);
        StreamRuntime.register(this);
        ExecRuntime.register(this);
        OutputBufferRuntime.register(this);
        ErrorRuntime.register(this);
        ReflectionRuntime.register(this);
        FiberRuntime.register(this);
        EnumRuntime.register(this);
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
            throw new PHPFatalError(`Fatal error: require(${resolvedPath}): Failed opening required '${resolvedPath}'`);
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
            const factory = new Function("module", "exports", "PHPClass", "PHPObject", "PHPVariable", "PHPLiteral", "PHPFatalError", transpilation.code);
            factory(moduleObj, moduleObj.exports, PHPClass, PHPObject, PHPVariable, PHPLiteral, PHPFatalError);
            return moduleObj.exports;
        }
        catch (err) {
            if (err.name === "SyntaxError") {
                try {
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
        return new PHPContext(this, options);
    }
    initWatcher() {
        this.watcher = chokidar.watch([], { ignoreInitial: true });
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
//# sourceMappingURL=PHPEngine.js.map