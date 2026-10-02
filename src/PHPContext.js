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
    /** Sets an HTTP response header. */
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
    /** Removes an HTTP response header. */
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
    /** Gets an HTTP response header value by name. */
    getHeader(name) {
        const found = this.headers.filter((h) => h.name.toLowerCase() === name.toLowerCase());
        return found.length > 0 ? found[found.length - 1].value : undefined;
    }
    /** Gets all formatted HTTP response headers. */
    getHeadersList() {
        return this.headers.map((h) => `${h.name}: ${h.value}`);
    }
    /** Sets a Set-Cookie HTTP header. */
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
    tickCount = 0;
    stdout;
    stderr;
    outputText = "";
    checkLoop(filepath, line) {
        if (this.tickCount === 50001) {
            console.error(`POSSIBLE_INFINITE_LOOP in ${filepath}:${line}`);
        }
        if (this.tickCount > 500000) {
            throw new Error(`Infinite loop detected in ${filepath}:${line}`);
        }
    }
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
    currentClassStack = [];
    get currentClass() {
        return this.currentClassStack.length > 0 ? this.currentClassStack[this.currentClassStack.length - 1] : undefined;
    }
    /**
     * Checks if an object is an instance of a class or interface.
     * @param className Class or interface name in lowercase.
     */
    isInstanceOf(obj, className) {
        if (!obj || typeof obj !== "object")
            return false;
        if (obj.phpClass instanceof PHPObject_1.PHPClass) {
            return obj.phpClass.isSubclassOf(className);
        }
        const cls = this.classes[className];
        if (cls && typeof cls === "function") {
            return obj instanceof cls;
        }
        return false;
    }
    /** Gets virtualized PHP stack trace frames for error handling and backtraces. */
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
    /** Sets a user-defined error handler function. */
    setErrorHandler(handler, levels = 32767) {
        const prev = this.errorHandlerStack.length > 0 ? this.errorHandlerStack[this.errorHandlerStack.length - 1] : null;
        this.errorHandlerStack.push({ handler, levels });
        return prev ? prev.handler : null;
    }
    /** Restores the previous error handler from the stack. */
    restoreErrorHandler() {
        if (this.errorHandlerStack.length > 0) {
            this.errorHandlerStack.pop();
        }
        return true;
    }
    /** Triggers a userland error or warning. */
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
    /** Gets an internal variable value. */
    getInternalVar(name) {
        return this.internalVars[name];
    }
    /** Sets an internal variable value. */
    setInternalVar(name, value) {
        this.internalVars[name] = value;
    }
    /** Gets response headers as a key-value dictionary. */
    get responseHeaders() {
        const res = {};
        for (const h of this.response.headers) {
            res[h.name.toLowerCase()] = h.value;
        }
        return res;
    }
    /** Gets the current HTTP status code. */
    get statusCode() {
        return this.response.statusCode;
    }
    /** Flushes response headers to the client. */
    flushHeaders() {
        if (this.response.headersSent)
            return;
        this.response.headersSent = true;
        const onFlush = this.getInternalVar("onFlushHeaders");
        if (typeof onFlush === "function") {
            onFlush(this.response.statusCode, this.response.headers);
        }
    }
    /** Writes output text to stdout or active output buffer. */
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
    /**
     * Gets a constant value by lowercase or exact name.
     * @param name Constant name in lowercase or exact key.
     */
    getConstant(name) {
        return this.constants[name.toLowerCase()] ?? this.constants[name];
    }
    /**
     * Checks if a constant is defined.
     * @param name Constant name in lowercase or exact key.
     */
    hasConstant(name) {
        if (!name || typeof name !== "string")
            return false;
        return name.toLowerCase() in this.constants || name in this.constants;
    }
    /**
     * Defines a constant.
     * @param name Constant name in lowercase or exact key.
     */
    defineConstant(name, val) {
        this.constants[name] = val;
    }
    /** Gets a variable value from the current or global scope. */
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
    /** Sets a variable value in the current scope. */
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
    /** Binds a variable name to global scope. */
    bindGlobal(name) {
        if (this.globalBindings.length > 0)
            this.globalBindings[this.globalBindings.length - 1].add(name);
    }
    /** Pushes a new variable scope. */
    pushScope() {
        this.scopes.push({});
        this.globalBindings.push(new Set());
        this.staticBindings.push(new Set());
    }
    /** Pops the current variable scope. */
    popScope() {
        this.scopes.pop();
        this.globalBindings.pop();
        this.staticBindings.pop();
    }
    /** Sets a single array offset on a variable. */
    setVarOffset(name, key, value) {
        return this.setVarOffsets(name, [key], value);
    }
    /** Sets nested array offsets on a variable. */
    setVarOffsets(name, keys, value) {
        let target = this.getVar(name);
        if (target === undefined || target === null) {
            target = [];
            this.setVar(name, target);
        }
        return this.assignOffsets(target, keys, value);
    }
    /** Unsets nested array offsets on a variable. */
    unsetVarOffsets(name, keys) {
        let target = this.getVar(name);
        if (!target || typeof target !== "object")
            return;
        for (let i = 0; i < keys.length - 1; i++) {
            target = target[keys[i]];
            if (!target || typeof target !== "object")
                return;
        }
        delete target[keys[keys.length - 1]];
    }
    /** Gets nested array offsets on a variable. */
    getVarOffsets(name, keys) {
        let target = this.getVar(name);
        for (const key of keys) {
            if (target === undefined || target === null)
                return undefined;
            target = target[key];
        }
        return target;
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
    /** Initializes a static variable in function scope. */
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
    /** Evaluates whether a value is truthy in PHP. */
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
    /**
     * Gets a property on an object or array.
     * @param prop Property name in lowercase.
     */
    async getProperty(obj, prop) {
        if (obj instanceof PHPObject_1.PHPObject) {
            return await obj.getProperty(this, prop);
        }
        if (obj && typeof obj === "object") {
            return obj[prop];
        }
        return undefined;
    }
    /**
     * Sets a property on an object or array.
     * @param prop Property name in lowercase.
     */
    async setProperty(obj, prop, value) {
        if (obj instanceof PHPObject_1.PHPObject) {
            await obj.setProperty(this, prop, value);
        }
        else if (obj && typeof obj === "object") {
            obj[prop] = value;
        }
        return value;
    }
    /** Sets a single property offset on an object. */
    async setPropertyOffset(obj, prop, key, value) {
        return await this.setPropertyOffsets(obj, prop, [key], value);
    }
    /** Sets nested property offsets on an object. */
    async setPropertyOffsets(obj, prop, keys, value) {
        let target = await this.getProperty(obj, prop);
        if (target === undefined || target === null) {
            target = [];
            await this.setProperty(obj, prop, target);
        }
        return this.assignOffsets(target, keys, value);
    }
    /**
     * Calls a method on an object.
     * Expects method name in lowercase.
     * @param method Method name in lowercase.
     */
    async callMethod(obj, method, args = []) {
        logDebug(`CALL_METHOD: ${obj?.constructor?.name}::${method}`);
        if (!obj || (typeof obj !== "object" && typeof obj !== "function"))
            return undefined;
        if (typeof obj.callMethod === "function") {
            const res = await obj.callMethod(this, method, args);
            logDebug(`DONE_METHOD: ${obj?.constructor?.name}::${method}`);
            return res;
        }
        const metadata = obj?.phpClass?.methods?.get ? obj.phpClass.methods.get(method) : obj?.phpClass?.methods?.[method];
        if (metadata?.fn)
            return await metadata.fn.apply(obj, [this, ...args]);
        if (typeof obj[method] === "function") {
            return await obj[method].apply(obj, args);
        }
        let target = obj;
        while (target && target !== Object.prototype) {
            for (const propName of Object.getOwnPropertyNames(target)) {
                if (propName.toLowerCase() === method && typeof obj[propName] === "function") {
                    return await obj[propName].apply(obj, args);
                }
            }
            target = Object.getPrototypeOf(target);
        }
        logDebug(`ERR_METHOD: ${obj?.constructor?.name}::${method}`);
        return undefined;
    }
    /** Gets a PHPReference wrapper for a variable name. */
    getVarRef(name) {
        const isGlobal = this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name);
        const scope = isGlobal || this.scopes.length === 0 ? this.vars : this.scopes[this.scopes.length - 1];
        if (scope[name] instanceof PHPReference)
            return scope[name];
        return new PHPReference(() => scope[name], (value) => { scope[name] = value; });
    }
    /**
     * Calls a global function.
     * Expects function name in lowercase.
     * @param name Function name in lowercase.
     */
    async callFunction(name, args = [], references = []) {
        logDebug(`CALL_FUNC: ${name}`);
        const lowerName = name.toLowerCase();
        const fn = this.functions[name] || this.functions[lowerName] || (this.engine.functions[name] || this.engine.functions[lowerName]);
        if (fn) {
            const parameters = fn.phpMeta?.parameters || [];
            const callArguments = args.map((value, index) => parameters[index]?.byref && references[index]
                ? this.getVarRef(references[index]) : value);
            const res = await fn.apply(this, [this, ...callArguments]);
            logDebug(`DONE_FUNC: ${name}`);
            return res;
        }
        logDebug(`ERR_FUNC: ${name}`);
        throw new PHPError_1.PHPFatalError(`Call to undefined function ${name}()`);
    }
    /**
     * Resolves a class by lowercase name.
     * @param className Class name in lowercase.
     * @param originalName Class name in original casing.
     */
    async resolveClass(className, originalName) {
        const orig = originalName || className;
        const lowerName = String(className).replace(/^\\/, "").toLowerCase();
        const resolvedClass = this.classes[lowerName] || await this.engine.resolveClass(lowerName, orig, this);
        if (!resolvedClass)
            throw new PHPError_1.PHPFatalError(`Class "${orig}" not found`);
        return resolvedClass;
    }
    /**
     * Gets a static class constant.
     * @param className Class name in lowercase.
     * @param name Constant name in lowercase.
     * @param originalClassName Class name in original casing.
     */
    async getClassConstant(className, name, originalClassName) {
        const origClass = originalClassName || className;
        const lowerClass = className.toLowerCase();
        const resolvedClass = await this.resolveClass(lowerClass, origClass);
        if (resolvedClass.constants) {
            if (resolvedClass.constants.get) {
                if (resolvedClass.constants.has(name))
                    return resolvedClass.constants.get(name);
                for (const [k, v] of resolvedClass.constants.entries()) {
                    if (k.toLowerCase() === name.toLowerCase())
                        return v;
                }
            }
            else {
                if (name in resolvedClass.constants)
                    return resolvedClass.constants[name];
                for (const k of Object.keys(resolvedClass.constants)) {
                    if (k.toLowerCase() === name.toLowerCase())
                        return resolvedClass.constants[k];
                }
            }
        }
        throw new PHPError_1.PHPFatalError(`Undefined constant ${origClass}::${name}`);
    }
    /**
     * Gets a static class property.
     * @param className Class name in lowercase.
     * @param name Property name in lowercase.
     */
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
    /**
     * Sets a static class property.
     * @param className Class name in lowercase.
     * @param name Property name in lowercase.
     */
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
    /** Sets static property array offsets. */
    async setStaticPropertyOffsets(className, name, keys, value) {
        let target = await this.getStaticProperty(className, name);
        if (target === undefined || target === null) {
            target = [];
            await this.setStaticProperty(className, name, target);
        }
        return this.assignOffsets(target, keys, value);
    }
    /**
     * Calls a static method on a class.
     * @param className Class name in lowercase.
     * @param method Method name in lowercase.
     * @param originalClassName Class name in original casing.
     */
    async callStaticMethod(className, method, args = [], targetObj, originalClassName) {
        const origClass = originalClassName || className;
        const lowerClass = className.toLowerCase();
        const lowerMethod = method.toLowerCase();
        let cls = this.classes[lowerClass];
        if (!cls)
            cls = await this.engine.resolveClass(lowerClass, origClass, this);
        if (!cls) {
            const shortClassName = lowerClass.split("\\").pop() || lowerClass;
            cls = this.classes[shortClassName];
        }
        if (!cls)
            throw new PHPError_1.PHPFatalError(`Class "${origClass}" not found`);
        const calledClass = cls;
        let targetClass = cls;
        this.currentClassStack.push(calledClass);
        try {
            while (targetClass) {
                if (targetClass.methods && typeof targetClass.methods.get === "function") {
                    const metadata = targetClass.methods.get(lowerMethod);
                    if (metadata?.fn)
                        return await metadata.fn.apply(targetObj || calledClass, [this, ...args]);
                }
                targetClass = targetClass.parentClass;
            }
            targetClass = cls;
            while (targetClass) {
                if (targetClass.methods && typeof targetClass.methods.get === "function") {
                    const callStaticMeta = targetClass.methods.get("__callstatic");
                    if (callStaticMeta?.fn)
                        return await callStaticMeta.fn.apply(calledClass, [this, method, args]);
                }
                targetClass = targetClass.parentClass;
            }
            if (cls && typeof cls[method] === "function")
                return await cls[method](...args);
            if (cls && typeof cls[lowerMethod] === "function")
                return await cls[lowerMethod](...args);
            if (lowerMethod === "__construct" && typeof cls === "function") {
                const instance = new cls(...args);
                if (targetObj && typeof targetObj === "object") {
                    Object.assign(targetObj, instance);
                }
                return instance;
            }
            throw new PHPError_1.PHPFatalError(`Call to undefined static method ${origClass}::${method}()`);
        }
        finally {
            this.currentClassStack.pop();
        }
    }
    /**
     * Creates an instance of a class.
     * @param className Class name in lowercase.
     * @param originalClassName Class name in original casing.
     */
    async createObject(className, args = [], originalClassName) {
        const origClass = originalClassName || className;
        logDebug(`NEW: ${className}`);
        const lowerClass = className.toLowerCase();
        let rawClass = this.classes[lowerClass];
        if (!rawClass) {
            rawClass = await this.engine.resolveClass(lowerClass, origClass, this);
        }
        if (!rawClass) {
            const shortClassName = lowerClass.split("\\").pop() || lowerClass;
            rawClass = this.classes[shortClassName];
        }
        if (rawClass && typeof rawClass === "function" && !(rawClass.prototype instanceof PHPObject_1.PHPObject)) {
            const obj = new rawClass(...args);
            if (obj instanceof PHPError_1.PHPError)
                Object.defineProperty(obj, "phpClass", { value: new PHPObject_1.PHPClass(origClass, rawClass) });
            logDebug(`DONE_NEW: ${className}`);
            return obj;
        }
        const phpClass = rawClass instanceof PHPObject_1.PHPClass ? rawClass : new PHPObject_1.PHPClass(origClass);
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
    /** Evaluates PHP code in the context. */
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
    /** Includes a PHP file. */
    async include(filepath) {
        const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
        const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
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
    /** Includes a PHP file if not already included. */
    async includeOnce(filepath) {
        const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
        const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
        if (this.includedFiles.has(normPath)) {
            return true;
        }
        return await this.include(filepath);
    }
    /** Requires a PHP file. */
    async require(filepath) {
        const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
        const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
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
    /** Requires a PHP file if not already required. */
    async requireOnce(filepath) {
        const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
        const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
        if (this.includedFiles.has(normPath)) {
            return true;
        }
        return await this.require(filepath);
    }
    /** Helper to create an engine, context, and execute a file. */
    static async runFile(filepath, options = {}) {
        const engine = new PHPEngine_1.PHPEngine();
        const ctx = engine.createContext(options);
        await ctx.require(filepath);
        return ctx;
    }
    /** Helper to create an engine, context, and execute inline PHP code. */
    static async runCode(code, options = {}) {
        const engine = new PHPEngine_1.PHPEngine();
        const ctx = engine.createContext(options);
        await ctx.eval(code);
        return ctx;
    }
}
exports.PHPContext = PHPContext;
//# sourceMappingURL=PHPContext.js.map