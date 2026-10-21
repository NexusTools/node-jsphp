import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { PHPContext } from "./PHPContext.js";
import { JSTranspiler } from "./parser/JSTranspiler.js";
import { PHPVariable, PHPLiteral, PHPReference, PHPPropertyReference, PHPArrayOffsetReference } from "./runtime/PHPVariable.js";
import { PHPInterface } from "./runtime/PHPInterface.js";
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
import { ErrorRuntime, PHPError, PHPFatalError } from "./runtime/PHPError.js";
import { ReflectionRuntime, SYMBOL_PHP_NAME, SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_PROPERTIES, SYMBOL_PHP_METHODS, SYMBOL_PHP_CLASS, SYMBOL_PHP_PARENT, SYMBOL_PHP_NEW, SYMBOL_PHP_INIT, SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS, SYMBOL_PHP_CLASS_INTERFACES, SYMBOL_PHP_METHOD_THEN, SYMBOL_PHP_STATIC_METHOD_PROTOTYPE, SYMBOL_PHP_META, encodePhpIdentifier, normalizePhpRegistryName, encodePhpMethodName, encodePhpPropertyName, decodePhpMethodName, decodePhpPropertyName, isEncodedPhpMethodKey, } from "./runtime/Reflection.js";
import { OutputBufferRuntime } from "./runtime/OutputBuffer.js";
export function PROXY_HANDLER(ctx) {
    return {
        get(target, prop, receiver) {
            if (prop === "then")
                return undefined;
            if (prop === SYMBOL_PHP_METHOD_THEN || prop === SYMBOL_PHP_STATIC_METHOD_PROTOTYPE) {
                const method = Reflect.get(target, prop, receiver);
                if (typeof method === "function")
                    return method;
                if (prop === SYMBOL_PHP_METHOD_THEN && typeof target.__call === "function") {
                    return async (methodCtx, ...args) => target.__call(methodCtx || ctx, new PHPLiteral("then"), new PHPLiteral(args));
                }
                return undefined;
            }
            if (typeof prop === "symbol")
                return Reflect.get(target, prop, receiver);
            if (typeof prop !== "string")
                return undefined;
            if (prop.startsWith("$")) {
                if (prop in target)
                    return Reflect.get(target, prop, receiver);
                if (isEncodedPhpMethodKey(prop) && typeof target.__call === "function") {
                    const methodName = decodePhpMethodName(prop);
                    return async (methodCtx, ...args) => target.__call(methodCtx || ctx, new PHPLiteral(methodName), new PHPLiteral(args));
                }
                return new PHPPropertyReference(ctx, target, prop, decodePhpPropertyName(prop));
            }
            if (prop in target)
                return Reflect.get(target, prop, receiver);
            if (typeof target.__call === "function") {
                const methodName = decodePhpMethodName(prop);
                return async (methodCtx, ...args) => target.__call(methodCtx || ctx, new PHPLiteral(methodName), new PHPLiteral(args));
            }
            return undefined;
        },
        set(target, prop, value) {
            if (typeof prop !== "string")
                return Reflect.set(target, prop, value);
            if (prop.startsWith("$") && prop in target) {
                const reference = target[prop];
                if (reference instanceof PHPReference)
                    void reference.set(value);
                else
                    target[prop] = value;
                return true;
            }
            target[prop] = value;
            return true;
        },
    };
}
export function STATIC_PROXY_HANDLER(ctx) {
    return {
        get(target, prop, receiver) {
            if (prop === "then")
                return undefined;
            if (prop === SYMBOL_PHP_METHOD_THEN || prop === SYMBOL_PHP_STATIC_METHOD_PROTOTYPE) {
                const method = Reflect.get(target, prop, receiver);
                if (typeof method === "function")
                    return method;
                const callStatic = target.__callstatic;
                if (typeof callStatic === "function") {
                    const methodName = decodePhpMethodName(prop);
                    return async (methodCtx, ...args) => callStatic.call(target, methodCtx || ctx, new PHPLiteral(methodName), new PHPLiteral(args));
                }
                return undefined;
            }
            if (typeof prop === "symbol")
                return Reflect.get(target, prop, receiver);
            if (typeof prop !== "string")
                return undefined;
            if (prop.startsWith("$") && !isEncodedPhpMethodKey(prop))
                return Reflect.get(target, prop, receiver);
            if (prop in target)
                return Reflect.get(target, prop, receiver);
            const callStatic = target.__callstatic;
            if (typeof callStatic === "function") {
                const methodName = decodePhpMethodName(prop);
                return async (methodCtx, ...args) => callStatic.call(target, methodCtx || ctx, new PHPLiteral(methodName), new PHPLiteral(args));
            }
            return undefined;
        },
    };
}
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
export function getDefaultExtensions() {
    return [
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
    ];
}
export class PHPEngine {
    static REVISION = 447;
    static VERSION = "8.5.0";
    static TRUE = new PHPLiteral(true);
    static FALSE = new PHPLiteral(false);
    static NULL = new PHPLiteral(null);
    extensions = Object.create(null);
    constants = {};
    functions = {};
    classes = {};
    interfaces = {};
    internalVars = {};
    symbols = {
        PHPVariable,
        PHPLiteral,
        PHPFatalError,
        PHPError,
        SYMBOL_PHP_NAME,
        SYMBOL_PHP_META,
        SYMBOL_PHP_CONSTANTS,
        SYMBOL_PHP_PROPERTIES,
        SYMBOL_PHP_METHODS,
        SYMBOL_PHP_CLASS,
        SYMBOL_PHP_PARENT,
        SYMBOL_PHP_NEW,
        SYMBOL_PHP_INIT,
        SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS,
        SYMBOL_PHP_CLASS_INTERFACES,
        SYMBOL_PHP_METHOD_THEN,
        SYMBOL_PHP_STATIC_METHOD_PROTOTYPE,
        encodePhpIdentifier,
        normalizePhpRegistryName,
        encodePhpMethodName,
        encodePhpPropertyName,
        PHPReference,
        PHPInterface,
        PHPPropertyReference,
        PHPArrayOffsetReference,
        PROXY_HANDLER,
        STATIC_PROXY_HANDLER,
    };
    classResolvers = [];
    resolvingClasses = [];
    compiledCache = Object.create(null);
    watcher;
    transpiler;
    cacheDir;
    static coreConstants = {
        php_version: PHPEngine.VERSION,
        php_engine: "jsphp",
        php_os: process.platform === "win32" ? "WINNT" : "Linux",
        php_int_size: 8,
        php_int_max: Number.MAX_SAFE_INTEGER,
        php_int_min: Number.MIN_SAFE_INTEGER,
        php_url_scheme: 0,
        php_url_host: 1,
        php_url_port: 2,
        php_url_user: 3,
        php_url_pass: 4,
        php_url_path: 5,
        php_url_query: 6,
        php_url_fragment: 7,
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
        if (options.constants)
            this.registerConstants(options.constants);
        if (options.functions) {
            this.registerFunctions(options.functions);
        }
        if (options.classes) {
            Object.assign(this.classes, options.classes);
        }
        this.registerRuntimeImplementations();
        const extensionsToRegister = options.extensions ? options.extensions : getDefaultExtensions();
        extensionsToRegister.forEach((ext) => this.registerExtension(ext));
        if (options.watch === true) {
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
    registerFunction(name, fn) {
        this.functions[name] = fn;
    }
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
        const registryName = normalizePhpRegistryName(name);
        const shortLower = registryName.split("$$").pop() || registryName;
        let resolved = ctx.classes[registryName] || ctx.interfaces[registryName];
        if (!resolved && !registryName.includes("$$")) {
            resolved = ctx.classes[shortLower] || ctx.interfaces[shortLower];
        }
        if (!resolved && !registryName.includes("$$")) {
            const suffix = "$$" + shortLower;
            for (const k of Object.keys(ctx.classes)) {
                if (k.endsWith(suffix)) {
                    resolved = ctx.classes[k];
                    break;
                }
            }
            if (!resolved) {
                for (const k of Object.keys(ctx.interfaces)) {
                    if (k.endsWith(suffix)) {
                        resolved = ctx.interfaces[k];
                        break;
                    }
                }
            }
        }
        if (resolved)
            return resolved;
        let resolvingState = this.resolvingClasses.find((state) => state.context === ctx);
        if (!resolvingState) {
            resolvingState = { context: ctx, names: new Set() };
            this.resolvingClasses.push(resolvingState);
        }
        const resolvingClasses = resolvingState.names;
        if (resolvingClasses.has(registryName))
            return undefined;
        resolvingClasses.add(registryName);
        try {
            for (const resolver of this.classResolvers) {
                await resolver(ctx, orig);
                resolved = ctx.classes[registryName] || ctx.interfaces[registryName];
                if (!resolved && !registryName.includes("$$"))
                    resolved = ctx.classes[shortLower] || ctx.interfaces[shortLower];
                if (!resolved && orig.toLowerCase() === "deferredclass") {
                    await resolver(ctx, "DeferredClass");
                    resolved = ctx.classes[registryName] || ctx.interfaces[registryName];
                    if (!resolved && !registryName.includes("$$"))
                        resolved = ctx.classes[shortLower] || ctx.interfaces[shortLower];
                }
                if (!resolved && orig !== registryName) {
                    await resolver(ctx, registryName);
                    resolved = ctx.classes[registryName] || ctx.interfaces[registryName];
                    if (!resolved && !registryName.includes("$$"))
                        resolved = ctx.classes[shortLower] || ctx.interfaces[shortLower];
                }
                if (!resolved && !registryName.includes("$$")) {
                    const suffix = "$$" + shortLower;
                    for (const k of Object.keys(ctx.classes)) {
                        if (k.endsWith(suffix)) {
                            resolved = ctx.classes[k];
                            break;
                        }
                    }
                }
                if (resolved)
                    return resolved;
            }
        }
        finally {
            resolvingClasses.delete(registryName);
            if (resolvingClasses.size === 0) {
                const index = this.resolvingClasses.indexOf(resolvingState);
                if (index !== -1)
                    this.resolvingClasses.splice(index, 1);
            }
        }
        return undefined;
    }
    registerCoreInterfaces() {
        const traversable = new PHPInterface("Traversable");
        const iterator = new PHPInterface("Iterator", [traversable]);
        const iteratorAggregate = new PHPInterface("IteratorAggregate", [traversable]);
        const arrayAccess = new PHPInterface("ArrayAccess");
        const countable = new PHPInterface("Countable");
        const serializable = new PHPInterface("Serializable");
        const jsonSerializable = new PHPInterface("JsonSerializable");
        const throwable = new PHPInterface("Throwable");
        const stringable = new PHPInterface("Stringable");
        const unitEnum = new PHPInterface("UnitEnum");
        const backedEnum = new PHPInterface("BackedEnum", [unitEnum]);
        this.interfaces["traversable"] = traversable;
        this.interfaces["iterator"] = iterator;
        this.interfaces["iteratoraggregate"] = iteratorAggregate;
        this.interfaces["arrayaccess"] = arrayAccess;
        this.interfaces["countable"] = countable;
        this.interfaces["serializable"] = serializable;
        this.interfaces["jsonserializable"] = jsonSerializable;
        this.interfaces["throwable"] = throwable;
        this.interfaces["stringable"] = stringable;
        this.interfaces["unitenum"] = unitEnum;
        this.interfaces["backedenum"] = backedEnum;
    }
    registerRuntimeImplementations() {
        this.registerCoreInterfaces();
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
        class __cls_stdClass {
            static async [SYMBOL_PHP_NEW](ctx, ...args) {
                const instance = Object.create(this.prototype);
                Object.defineProperty(instance, "__ctx", { value: ctx, writable: true, configurable: true, enumerable: false });
                return instance;
            }
        }
        __cls_stdClass[SYMBOL_PHP_NAME] = "stdClass";
        __cls_stdClass.prototype[SYMBOL_PHP_NAME] = "stdClass";
        this.classes["stdclass"] = __cls_stdClass;
    }
    registerExtension(extension) {
        this.extensions[extension.name.toLowerCase()] = extension;
        extension.onInit(this);
        if (extension.constants)
            this.registerConstants(extension.constants);
        if (extension.functions)
            this.registerFunctions(extension.functions);
        if (extension.classes)
            this.registerClasses(extension.classes);
    }
    getConfigurationSHA1() {
        const sortedExts = Object.keys(this.extensions)
            .sort()
            .map((k) => `${k}@${this.extensions[k]?.version || PHPEngine.VERSION}`)
            .join(",");
        return crypto.createHash("sha1").update(`v${PHPEngine.REVISION}|${sortedExts}`).digest("hex");
    }
    clearCompiledCache() {
        this.compiledCache = Object.create(null);
    }
    async compileFile(filepath) {
        const resolvedPath = path.resolve(filepath);
        if (Object.hasOwn(this.compiledCache, resolvedPath)) {
            return this.compiledCache[resolvedPath];
        }
        let source;
        try {
            source = await fs.readFile(resolvedPath, "utf8");
        }
        catch {
            throw new PHPFatalError(`Fatal error: require(${resolvedPath}): Failed opening required '${resolvedPath}'`);
        }
        const func = await this.compileCode(source, resolvedPath);
        this.compiledCache[resolvedPath] = func;
        if (this.watcher) {
            this.watcher.add(resolvedPath);
        }
        return func;
    }
    async compileCode(code, filepath = "eval") {
        const transpiler = new JSTranspiler();
        const transpilation = await transpiler.transpile(code, filepath, {
            engineSHA1: this.getConfigurationSHA1(),
            cacheDir: filepath === "eval" ? undefined : (this.cacheDir || undefined),
            engine: this,
        });
        const jsCode = transpilation.code;
        const moduleObj = { exports: {} };
        try {
            const factory = vm.compileFunction(jsCode, ["module", "exports", "PHPVariable", "PHPLiteral", "PHPFatalError", "PHPError", "SYMBOL_PHP_NAME", "SYMBOL_PHP_HAS_MAGIC_METHODS", "SYMBOL_PHP_CLASS_INTERFACES", "PHPReference", "PHPInterface", "PHPPropertyReference", "PHPArrayOffsetReference", "PROXY_HANDLER", "path"], { filename: filepath });
            factory(moduleObj, moduleObj.exports, PHPVariable, PHPLiteral, PHPFatalError, PHPError, SYMBOL_PHP_NAME, SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS, SYMBOL_PHP_CLASS_INTERFACES, PHPReference, PHPInterface, PHPPropertyReference, PHPArrayOffsetReference, PROXY_HANDLER, path);
            return moduleObj.exports;
        }
        catch (err) {
            if (err.name === "SyntaxError") {
                try {
                    new vm.Script(jsCode);
                }
                catch (scriptErr) {
                    console.error(`SYNTAX_ERR in ${filepath}: ${scriptErr.message}\nSTACK:\n${scriptErr.stack}`);
                }
            }
            throw err;
        }
    }
    contexts = new Set();
    createContext(options = {}) {
        const ctx = new PHPContext(this, options);
        this.contexts.add(ctx);
        return ctx;
    }
    initWatcher() {
        this.watcher = chokidar.watch([], { ignoreInitial: true });
        this.watcher.on("change", (changedPath) => {
            const resolved = path.resolve(changedPath);
            delete this.compiledCache[resolved];
        });
    }
    clearCache() {
        this.compiledCache = Object.create(null);
        if (typeof globalThis.gc === "function") {
            try {
                globalThis.gc();
            }
            catch (e) { }
        }
    }
    async close() {
        for (const ctx of Array.from(this.contexts)) {
            await ctx.destroy();
        }
        this.contexts.clear();
        this.compiledCache = Object.create(null);
        for (const ext of Object.values(this.extensions)) {
            if (typeof ext.onClose === "function") {
                try {
                    await ext.onClose(this);
                }
                catch { }
            }
        }
        if (typeof globalThis.gc === "function") {
            try {
                globalThis.gc();
            }
            catch (e) { }
        }
        if (this.watcher) {
            const w = this.watcher;
            this.watcher = undefined;
            await w.close();
        }
    }
}
//# sourceMappingURL=PHPEngine.js.map