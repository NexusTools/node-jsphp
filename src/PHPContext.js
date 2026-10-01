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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPContext = exports.PHPResponse = exports.PHPReference = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const PHPEngine_1 = require("./PHPEngine");
const Superglobals_1 = require("./runtime/Superglobals");
const OutputBuffer_1 = require("./runtime/OutputBuffer");
const PHPError_1 = require("./runtime/PHPError");
const PHPObject_1 = require("./runtime/PHPObject");
const SourceMapRegistry_1 = require("./runtime/SourceMapRegistry");
function logDebug(msg) {
    if (process.env.JSPHP_DEBUG !== "1")
        return;
    try {
        fsSync.appendFileSync(path.resolve(__dirname, "../debug.log"), msg + "\n");
    }
    catch (e) { }
}
class PHPReference {
    get;
    set;
    constructor(get, set) {
        this.get = get;
        this.set = set;
    }
}
exports.PHPReference = PHPReference;
class PHPResponse {
    statusCode = 200;
    headers = [];
    headersSent = false;
    setHeader(name, value, replace = true) {
        if (this.headersSent) {
            return;
        }
        if (replace) {
            this.headers = this.headers.filter((h) => h.name.toLowerCase() !== name.toLowerCase());
        }
        this.headers.push({ name, value });
        if (name.toLowerCase() === "location" && this.statusCode === 200) {
            this.statusCode = 302;
        }
    }
    removeHeader(name) {
        if (this.headersSent) {
            return;
        }
        if (!name) {
            this.headers = [];
            return;
        }
        this.headers = this.headers.filter((h) => h.name.toLowerCase() !== name.toLowerCase());
    }
    getHeader(name) {
        const found = this.headers.filter((h) => h.name.toLowerCase() === name.toLowerCase());
        return found.length > 0 ? found[found.length - 1].value : undefined;
    }
    getHeadersList() {
        return this.headers.map((h) => `${h.name}: ${h.value}`);
    }
    setCookie(name, value = "", expires = 0, path = "", domain = "", secure = false, httponly = false, raw = false) {
        if (this.headersSent) {
            return;
        }
        const encodedName = raw ? name : encodeURIComponent(name);
        const encodedValue = raw ? value : encodeURIComponent(value);
        let cookieStr = `${encodedName}=${encodedValue}`;
        if (expires > 0) {
            cookieStr += `; expires=${new Date(expires * 1000).toUTCString()}`;
        }
        if (path)
            cookieStr += `; path=${path}`;
        if (domain)
            cookieStr += `; domain=${domain}`;
        if (secure)
            cookieStr += `; secure`;
        if (httponly)
            cookieStr += `; HttpOnly`;
        this.setHeader("Set-Cookie", cookieStr, false);
    }
}
exports.PHPResponse = PHPResponse;
class PHPContext {
    engine;
    cwd;
    env;
    vars = {};
    constants;
    functions;
    classes;
    internalVars;
    scopes = [];
    globalBindings = [];
    staticBindings = [];
    staticVars = new Map();
    superglobals;
    outputBuffer;
    response;
    errorHandlerStack = [];
    errorReportingLevel = 32767; // E_ALL
    includedFiles = new Set();
    stdout;
    stderr;
    outputText = "";
    constructor(engine, options = {}) {
        this.engine = engine;
        this.constants = Object.create(engine.constants);
        this.functions = Object.create(engine.functions);
        this.classes = Object.create(engine.classes);
        this.internalVars = Object.create(engine.internalVars);
        this.cwd = options.cwd || process.cwd();
        this.env = options.env || process.env;
        this.stdout = options.stdout || ((data) => { this.outputText += data; });
        this.stderr = options.stderr || ((data) => { console.error(data); });
        this.superglobals = new Superglobals_1.Superglobals({ ...options.superglobals, env: this.env });
        this.outputBuffer = new OutputBuffer_1.OutputBufferStack();
        this.response = new PHPResponse();
        if (options.errorReporting !== undefined) {
            this.errorReportingLevel = options.errorReporting;
        }
    }
    isInstanceOf(obj, className) {
        if (!obj || typeof obj !== "object")
            return false;
        if (obj.phpClass instanceof PHPObject_1.PHPClass) {
            return obj.phpClass.isSubclassOf(String(className));
        }
        const cls = this.classes[String(className).toLowerCase()];
        if (cls && typeof cls === "function") {
            return obj instanceof cls;
        }
        return false;
    }
    getPHPBacktrace() {
        const err = new Error();
        const rawLines = (err.stack || "").split("\n");
        const frames = [];
        for (let i = 1; i < rawLines.length; i++) {
            const line = rawLines[i].trim();
            if (!line)
                continue;
            const matchAnon = line.match(/<anonymous>:(\d+):(\d+)/) || line.match(/<eval>:(\d+):(\d+)/);
            if (matchAnon) {
                const jsLine = parseInt(matchAnon[1], 10);
                const fnMatch = line.match(/(?:__fn_|method_|class_)([a-zA-Z0-9_]+)/);
                let funcHint = fnMatch ? fnMatch[1] : null;
                if (!funcHint) {
                    const genericMatch = line.match(/at\s+(?:async\s+)?([a-zA-Z0-9_]+)/);
                    if (genericMatch && genericMatch[1] !== "PHPContext" && genericMatch[1] !== "PHPEngine" && genericMatch[1] !== "callFunction" && genericMatch[1] !== "getPHPBacktrace") {
                        funcHint = genericMatch[1];
                    }
                }
                const loc = SourceMapRegistry_1.SourceMapRegistry.lookup(funcHint, jsLine);
                if (loc) {
                    let funcName = loc.function || funcHint || "{main}";
                    if (!funcName || funcName === "exports" || funcName === "module" || funcName === "async" || funcName === "at") {
                        funcName = "{main}";
                    }
                    frames.push({
                        file: loc.file,
                        line: loc.line,
                        function: funcName,
                    });
                    continue;
                }
            }
            const matchPhp = line.match(/\((.*?\.php):(\d+):(\d+)\)/) || line.match(/at\s+(.*?\.php):(\d+):(\d+)/);
            if (matchPhp) {
                frames.push({
                    file: matchPhp[1],
                    line: parseInt(matchPhp[2], 10),
                    function: "{main}",
                });
            }
        }
        return frames;
    }
    setErrorHandler(handler, levels = 32767) {
        const prev = this.errorHandlerStack.length > 0 ? this.errorHandlerStack[this.errorHandlerStack.length - 1] : null;
        this.errorHandlerStack.push({ handler, levels });
        return prev ? prev.handler : null;
    }
    restoreErrorHandler() {
        if (this.errorHandlerStack.length > 0) {
            this.errorHandlerStack.pop();
        }
        return true;
    }
    async triggerError(message, level = 1024, file = "[INTERNAL]", line = 0) {
        if ((this.errorReportingLevel & level) === 0) {
            return false; // Suppressed
        }
        if (this.errorHandlerStack.length > 0) {
            const top = this.errorHandlerStack[this.errorHandlerStack.length - 1];
            if ((top.levels & level) !== 0) {
                const handler = top.handler;
                let res;
                if (typeof handler === "function") {
                    res = await handler(this, level, message, file, line);
                }
                else if (typeof handler === "string") {
                    res = await this.callFunction(handler, [level, message, file, line]);
                }
                if (res !== false) {
                    return true; // Handled
                }
            }
        }
        // Default error handling
        if (level === 1 || level === 256 || level === 4 || level === 64) {
            throw new PHPError_1.PHPFatalError(`Fatal error: ${message} in ${file} on line ${line}`);
        }
        else {
            const typeStr = (level === 2 || level === 512) ? "Warning" : "Notice";
            await this.echo(`PHP ${typeStr}: ${message} in ${file} on line ${line}\n`);
            return true;
        }
    }
    getInternalVar(name) {
        return this.internalVars[name];
    }
    setInternalVar(name, value) {
        this.internalVars[name] = value;
    }
    get responseHeaders() {
        const res = {};
        for (const h of this.response.headers) {
            res[h.name.toLowerCase()] = h.value;
        }
        return res;
    }
    get statusCode() {
        return this.response.statusCode;
    }
    flushHeaders() {
        if (this.response.headersSent)
            return;
        this.response.headersSent = true;
        const onFlush = this.getInternalVar("onFlushHeaders");
        if (typeof onFlush === "function") {
            onFlush(this.response.statusCode, this.response.headers);
        }
    }
    async echo(data) {
        const str = String(data ?? "");
        if (this.outputBuffer.isActive()) {
            this.outputBuffer.write(str);
        }
        else {
            if (str.length > 0) {
                this.flushHeaders();
            }
            this.writeStdout(str);
        }
    }
    writeStdout(str) {
        if (typeof this.stdout === "function") {
            this.stdout(str);
        }
        else if (this.stdout && typeof this.stdout.write === "function") {
            this.stdout.write(str);
        }
    }
    getConstant(name) {
        return this.constants[name];
    }
    hasConstant(name) {
        if (!name || typeof name !== "string")
            return false;
        return name in this.constants;
    }
    defineConstant(name, val) {
        this.constants[name] = val;
    }
    getVar(name) {
        if (name === "GLOBALS")
            return this.vars;
        if (name.startsWith("_")) {
            switch (name) {
                case "_GET": return this.superglobals.GET;
                case "_POST": return this.superglobals.POST;
                case "_SERVER": return this.superglobals.SERVER;
                case "_COOKIE": return this.superglobals.COOKIE;
                case "_FILES": return this.superglobals.FILES;
                case "_ENV": return this.superglobals.ENV;
                case "_REQUEST": return this.superglobals.REQUEST;
                case "_SESSION": return this.superglobals.SESSION;
            }
        }
        if (this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name)) {
            const value = this.vars[name];
            return value instanceof PHPReference ? value.get() : value;
        }
        for (let index = this.scopes.length - 1; index >= 0; index--) {
            if (Object.prototype.hasOwnProperty.call(this.scopes[index], name)) {
                const value = this.scopes[index][name];
                return value instanceof PHPReference ? value.get() : value;
            }
        }
        const value = this.vars[name];
        return value instanceof PHPReference ? value.get() : value;
    }
    setVar(name, value) {
        const isGlobal = this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name);
        const scope = isGlobal || this.scopes.length === 0 ? this.vars : this.scopes[this.scopes.length - 1];
        if (scope[name] instanceof PHPReference && !(value instanceof PHPReference))
            scope[name].set(value);
        else
            scope[name] = value;
        if (this.staticBindings.length > 0) {
            for (const key of this.staticBindings[this.staticBindings.length - 1]) {
                if (key.endsWith(`:${name}`))
                    this.staticVars.set(key, value);
            }
        }
        return value;
    }
    bindGlobal(name) {
        if (this.globalBindings.length > 0)
            this.globalBindings[this.globalBindings.length - 1].add(name);
    }
    pushScope() {
        this.scopes.push({});
        this.globalBindings.push(new Set());
        this.staticBindings.push(new Set());
    }
    popScope() {
        this.scopes.pop();
        this.globalBindings.pop();
        this.staticBindings.pop();
    }
    setVarOffset(name, key, value) {
        return this.setVarOffsets(name, [key], value);
    }
    setVarOffsets(name, keys, value) {
        let target = this.getVar(name);
        if (target === undefined || target === null) {
            target = [];
            this.setVar(name, target);
        }
        return this.assignOffsets(target, keys, value);
    }
    assignOffsets(target, keys, value) {
        for (const key of keys.slice(0, -1)) {
            if (key === null) {
                const child = [];
                this.assignOffset(target, null, child);
                target = child;
            }
            else {
                if (target[key] === undefined || target[key] === null)
                    target[key] = [];
                target = target[key];
            }
        }
        return this.assignOffset(target, keys[keys.length - 1], value);
    }
    assignOffset(target, key, value) {
        if (key === null) {
            key = Array.isArray(target) ? target.length : Math.max(-1, ...Object.keys(target).filter((entry) => /^(0|[1-9]\d*)$/.test(entry)).map(Number)) + 1;
        }
        target[key] = value;
        return value;
    }
    initStaticVar(scope, name, value) {
        const key = `${scope}:${name}`;
        if (this.staticBindings.length > 0)
            this.staticBindings[this.staticBindings.length - 1].add(key);
        if (!this.staticVars.has(key)) {
            this.staticVars.set(key, value);
            this.setVar(name, value);
        }
        else {
            this.setVar(name, this.staticVars.get(key));
        }
    }
    isTruthy(val) {
        if (val === null || val === undefined || val === false)
            return false;
        if (typeof val === "number")
            return val !== 0 && !Number.isNaN(val);
        if (typeof val === "string")
            return val !== "" && val !== "0";
        if (Array.isArray(val))
            return val.length > 0;
        return true;
    }
    async getProperty(obj, prop) {
        if (obj instanceof PHPObject_1.PHPObject) {
            return await obj.getProperty(this, prop);
        }
        if (obj && typeof obj === "object") {
            return obj[prop];
        }
        return undefined;
    }
    async setProperty(obj, prop, value) {
        if (obj instanceof PHPObject_1.PHPObject) {
            await obj.setProperty(this, prop, value);
        }
        else if (obj && typeof obj === "object") {
            obj[prop] = value;
        }
        return value;
    }
    async setPropertyOffset(obj, prop, key, value) {
        return await this.setPropertyOffsets(obj, prop, [key], value);
    }
    async setPropertyOffsets(obj, prop, keys, value) {
        let target = await this.getProperty(obj, prop);
        if (target === undefined || target === null) {
            target = [];
            await this.setProperty(obj, prop, target);
        }
        return this.assignOffsets(target, keys, value);
    }
    async callMethod(obj, method, args = []) {
        logDebug(`CALL_METHOD: ${obj?.constructor?.name}::${method}`);
        if (!obj || (typeof obj !== "object" && typeof obj !== "function"))
            return undefined;
        if (obj instanceof PHPObject_1.PHPObject) {
            const res = await obj.callMethod(this, method, args);
            logDebug(`DONE_METHOD: ${obj?.constructor?.name}::${method}`);
            return res;
        }
        const lowerMethod = method.toLowerCase();
        const metadata = obj?.phpClass?.methods?.get(lowerMethod);
        if (metadata?.fn)
            return await metadata.fn.apply(obj, [this, ...args]);
        if (typeof obj[method] === "function") {
            return await obj[method].apply(obj, args);
        }
        let target = obj;
        while (target && target !== Object.prototype) {
            for (const propName of Object.getOwnPropertyNames(target)) {
                if (propName.toLowerCase() === lowerMethod && typeof obj[propName] === "function") {
                    return await obj[propName].apply(obj, args);
                }
            }
            target = Object.getPrototypeOf(target);
        }
        logDebug(`ERR_METHOD: ${obj?.constructor?.name}::${method}`);
        return undefined;
    }
    getVarRef(name) {
        return this.referenceVariable(name);
    }
    referenceVariable(name) {
        const isGlobal = this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name);
        const scope = isGlobal || this.scopes.length === 0 ? this.vars : this.scopes[this.scopes.length - 1];
        if (scope[name] instanceof PHPReference)
            return scope[name];
        return new PHPReference(() => scope[name], (value) => { scope[name] = value; });
    }
    async callFunction(name, args = [], references = []) {
        logDebug(`CALL_FUNC: ${name}`);
        const fn = this.functions[name.toLowerCase()] || this.functions[name];
        if (fn) {
            const parameters = fn.phpMeta?.parameters || [];
            const callArguments = args.map((value, index) => parameters[index]?.byref && references[index]
                ? this.referenceVariable(references[index]) : value);
            const res = await fn.apply(this, [this, ...callArguments]);
            logDebug(`DONE_FUNC: ${name}`);
            return res;
        }
        logDebug(`ERR_FUNC: ${name}`);
        throw new PHPError_1.PHPFatalError(`Call to undefined function ${name}()`);
    }
    async resolveClass(className) {
        const normalizedName = String(className).replace(/^\\/, "").toLowerCase();
        const resolvedClass = this.classes[normalizedName] || await this.engine.resolveClass(className, this);
        if (!resolvedClass)
            throw new PHPError_1.PHPFatalError(`Class "${className}" not found`);
        return resolvedClass;
    }
    async getClassConstant(className, name) {
        const resolvedClass = await this.resolveClass(className);
        if (resolvedClass.constants?.has ? resolvedClass.constants.has(name) : (name in resolvedClass.constants)) {
            return resolvedClass.constants.get ? resolvedClass.constants.get(name) : resolvedClass.constants[name];
        }
        throw new PHPError_1.PHPFatalError(`Undefined constant ${className}::${name}`);
    }
    async getStaticProperty(className, name) {
        let resolvedClass = await this.resolveClass(className);
        const cleanName = name.startsWith("$") ? name.slice(1) : name;
        while (resolvedClass) {
            if (resolvedClass.properties) {
                const prop = resolvedClass.properties.get ? resolvedClass.properties.get(cleanName) : resolvedClass.properties[cleanName];
                if (prop && prop.isStatic)
                    return prop.defaultValue;
            }
            if (resolvedClass.staticProperties) {
                if (resolvedClass.staticProperties.has ? resolvedClass.staticProperties.has(cleanName) : (cleanName in resolvedClass.staticProperties)) {
                    return resolvedClass.staticProperties.get ? resolvedClass.staticProperties.get(cleanName) : resolvedClass.staticProperties[cleanName];
                }
            }
            resolvedClass = resolvedClass.parentClass;
        }
        throw new PHPError_1.PHPFatalError(`Access to undeclared static property ${className}::$${name}`);
    }
    async setStaticProperty(className, name, value) {
        let resolvedClass = await this.resolveClass(className);
        const cleanName = name.startsWith("$") ? name.slice(1) : name;
        while (resolvedClass) {
            if (resolvedClass.properties) {
                const prop = resolvedClass.properties.get ? resolvedClass.properties.get(cleanName) : resolvedClass.properties[cleanName];
                if (prop && prop.isStatic) {
                    prop.defaultValue = value;
                    return value;
                }
            }
            if (resolvedClass.staticProperties) {
                if (resolvedClass.staticProperties.has ? resolvedClass.staticProperties.has(cleanName) : (cleanName in resolvedClass.staticProperties)) {
                    if (resolvedClass.staticProperties.set)
                        resolvedClass.staticProperties.set(cleanName, value);
                    else
                        resolvedClass.staticProperties[cleanName] = value;
                    return value;
                }
            }
            resolvedClass = resolvedClass.parentClass;
        }
        throw new PHPError_1.PHPFatalError(`Access to undeclared static property ${className}::$${name}`);
    }
    async setStaticPropertyOffsets(className, name, keys, value) {
        let target = await this.getStaticProperty(className, name);
        if (target === undefined || target === null) {
            target = [];
            await this.setStaticProperty(className, name, target);
        }
        return this.assignOffsets(target, keys, value);
    }
    async callStaticMethod(className, method, args = []) {
        const normalizedClassName = String(className).toLowerCase();
        const shortClassName = normalizedClassName.split("\\").pop() || normalizedClassName;
        let cls = this.classes[normalizedClassName] || this.classes[shortClassName];
        if (!cls)
            cls = await this.engine.resolveClass(className, this);
        if (cls?.methods && typeof cls.methods.get === "function") {
            const metadata = cls.methods.get(String(method).toLowerCase());
            if (metadata?.fn)
                return await metadata.fn.apply(cls, [this, ...args]);
        }
        if (cls && typeof cls[method] === "function")
            return await cls[method](...args);
        throw new PHPError_1.PHPFatalError(`Call to undefined static method ${className}::${method}()`);
    }
    async createObject(className, args = []) {
        logDebug(`NEW: ${className}`);
        const rawClass = this.classes[className.toLowerCase()];
        if (rawClass && typeof rawClass === "function" && !(rawClass.prototype instanceof PHPObject_1.PHPObject)) {
            const obj = new rawClass(...args);
            if (obj instanceof PHPError_1.PHPError)
                Object.defineProperty(obj, "phpClass", { value: new PHPObject_1.PHPClass(className, rawClass) });
            logDebug(`DONE_NEW: ${className}`);
            return obj;
        }
        const phpClass = rawClass instanceof PHPObject_1.PHPClass ? rawClass : new PHPObject_1.PHPClass(className);
        const obj = phpClass.nativeConstructor ? Reflect.construct(phpClass.nativeConstructor, args) : new PHPObject_1.PHPObject(phpClass);
        if (phpClass.nativeConstructor) {
            Object.defineProperty(obj, "phpClass", { value: phpClass });
            for (const [name, metadata] of phpClass.properties) {
                if (!metadata.isStatic)
                    obj[name] = metadata.defaultValue;
            }
        }
        const __construct = phpClass.methods ? phpClass.methods.get("__construct") : undefined;
        if (__construct?.fn) {
            await __construct.fn.apply(obj, [this, ...args]);
        }
        logDebug(`DONE_NEW: ${className}`);
        return obj instanceof PHPObject_1.PHPObject ? obj.asProxy(this) : obj;
    }
    async eval(code, filepath = "eval") {
        logDebug(`EVAL: ${filepath}`);
        try {
            const compiledFunc = await this.engine.compileCode(code, filepath);
            const res = await compiledFunc(this);
            logDebug(`DONE_EVAL: ${filepath}`);
            return res;
        }
        catch (err) {
            logDebug(`ERR_EVAL: ${err}`);
            if (err instanceof PHPError_1.PHPExit || err?.name === "PHPExit") {
                return err.status;
            }
            throw err;
        }
    }
    async fileExists(filepath) {
        try {
            await fs.access(filepath);
            return true;
        }
        catch {
            return false;
        }
    }
    normalizeFilePath(filepath) {
        const resolved = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
        return resolved.replace(/\\/g, "/").toLowerCase();
    }
    async include(filepath) {
        const normPath = this.normalizeFilePath(filepath);
        const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
        this.includedFiles.add(normPath);
        logDebug(`INC: ${path.basename(resolvedPath)}`);
        if (!(await this.fileExists(resolvedPath))) {
            await this.triggerError(`include(${filepath}): Failed to open stream: No such file or directory`, 2);
            return false;
        }
        const compiledFunc = await this.engine.compileFile(resolvedPath);
        const res = await compiledFunc(this);
        logDebug(`DONE_INC: ${path.basename(resolvedPath)}`);
        return res;
    }
    async includeOnce(filepath) {
        const normPath = this.normalizeFilePath(filepath);
        if (this.includedFiles.has(normPath)) {
            return true;
        }
        this.includedFiles.add(normPath);
        return await this.include(filepath);
    }
    async require(filepath) {
        const normPath = this.normalizeFilePath(filepath);
        const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
        this.includedFiles.add(normPath);
        logDebug(`REQ: ${path.basename(resolvedPath)}`);
        if (!(await this.fileExists(resolvedPath))) {
            throw new PHPError_1.PHPFatalError(`Fatal error: require(${filepath}): Failed opening required '${filepath}'`);
        }
        const compiledFunc = await this.engine.compileFile(resolvedPath);
        const res = await compiledFunc(this);
        logDebug(`DONE_REQ: ${path.basename(resolvedPath)}`);
        return res;
    }
    async requireOnce(filepath) {
        const normPath = this.normalizeFilePath(filepath);
        if (this.includedFiles.has(normPath)) {
            return true;
        }
        this.includedFiles.add(normPath);
        return await this.require(filepath);
    }
    static async runFile(filepath, options = {}) {
        const engine = new PHPEngine_1.PHPEngine();
        const ctx = engine.createContext(options);
        await ctx.require(filepath);
        return ctx;
    }
    static async runCode(code, options = {}) {
        const engine = new PHPEngine_1.PHPEngine();
        const ctx = engine.createContext(options);
        await ctx.eval(code);
        return ctx;
    }
}
exports.PHPContext = PHPContext;
//# sourceMappingURL=PHPContext.js.map