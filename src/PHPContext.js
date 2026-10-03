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
exports.PHPContext = exports.PHPResponse = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const PHPEngine_1 = require("./PHPEngine");
const Superglobals_1 = require("./runtime/Superglobals");
const OutputBuffer_1 = require("./runtime/OutputBuffer");
const PHPError_1 = require("./runtime/PHPError");
const PHPObject_1 = require("./runtime/PHPObject");
const PHPVariable_1 = require("./runtime/PHPVariable");
function logDebug(msg) {
    if (process.env.JSPHP_DEBUG !== "1")
        return;
    try {
        fsSync.appendFileSync(path.resolve(__dirname, "../debug.log"), msg + "\n");
    }
    catch (e) { }
}
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
    executionDepth = 0;
    tickCount = 0;
    stdout;
    stderr;
    outputText = "";
    checkLoop(filepath, line) {
        if (this.tickCount > 50000000) {
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
        this.stdout = options.stdout || ((data) => { });
        this.stderr = options.stderr || ((data) => { console.error(data); });
        this.superglobals = new Superglobals_1.Superglobals({ ...options.superglobals, env: this.env });
        this.outputBuffer = new OutputBuffer_1.OutputBufferStack();
        this.response = new PHPResponse();
        if (this.superglobals.SERVER['argv']) {
            const argvArr = Array.isArray(this.superglobals.SERVER['argv']) ? this.superglobals.SERVER['argv'] : [];
            this.vars['argv'] = new PHPVariable_1.PHPVariable(argvArr);
            this.vars['argc'] = new PHPVariable_1.PHPVariable(argvArr.length);
        }
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
            if (line.includes("PHPContext.") || line.includes("PHPContext.ts") || line.includes("PHPContext.js") || line.includes("PHPEngine.") || line.includes("php-http-server") || line.includes("node:internal"))
                continue;
            const matchPhp = line.match(/\((.*?\.php):(\d+):(\d+)\)/) || line.match(/at\s+(.*?\.php):(\d+):(\d+)/) || line.match(/at\s+([^\s]+)\s+\((.*?):(\d+):(\d+)\)/);
            if (matchPhp) {
                const file = matchPhp[2] || matchPhp[1];
                const lineNum = parseInt(matchPhp[3] || matchPhp[2], 10);
                const jsFunc = matchPhp[1] && matchPhp[2] ? matchPhp[1] : "{main}";
                frames.push({
                    file: file,
                    line: lineNum,
                    function: jsFunc,
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
        if (this.outputBuffer.getLevel() > 0) {
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
        this.outputText += str;
        if (typeof this.stdout === "function") {
            this.stdout(str);
        }
        else if (this.stdout && typeof this.stdout.write === "function") {
            this.stdout.write(str);
        }
    }
    /** Gets a constant value. */
    getConstant(name) {
        const lower = String(name ?? "").toLowerCase();
        return this.constants[name] ?? this.constants[lower] ?? this.engine.constants[name] ?? this.engine.constants[lower];
    }
    /** Checks if a constant is defined. */
    hasConstant(name) {
        if (!name || typeof name !== "string")
            return false;
        const lower = name.toLowerCase();
        return Object.hasOwn(this.constants, name) || Object.hasOwn(this.constants, lower) || Object.hasOwn(this.engine.constants, name) || Object.hasOwn(this.engine.constants, lower);
    }
    /** Defines a constant. */
    defineConstant(name, val) {
        const lower = String(name ?? "").toLowerCase();
        this.constants[name] = val;
        this.constants[lower] = val;
    }
    globalsProxy;
    getGlobalPHPVar(name) {
        let phpVar = this.vars[name];
        if (!(phpVar instanceof PHPVariable_1.PHPVariable)) {
            phpVar = new PHPVariable_1.PHPVariable(phpVar && typeof phpVar === "object" && typeof phpVar.get === "function" ? phpVar.get() : phpVar);
            this.vars[name] = phpVar;
        }
        return phpVar;
    }
    getGlobalsProxy() {
        if (!this.globalsProxy) {
            this.globalsProxy = new Proxy(this.vars, {
                get: (target, prop) => {
                    if (typeof prop === "string") {
                        if (prop === "GLOBALS")
                            return this.globalsProxy;
                        return this.getGlobalPHPVar(prop).get();
                    }
                    return target[prop];
                },
                set: (target, prop, value) => {
                    if (typeof prop === "string") {
                        const phpVar = this.getGlobalPHPVar(prop);
                        if (value instanceof PHPVariable_1.PHPVariable) {
                            phpVar.bindRef(value);
                        }
                        else {
                            phpVar.set(value);
                        }
                        return true;
                    }
                    target[prop] = value;
                    return true;
                },
                has: (target, prop) => {
                    return typeof prop === "string" ? (prop in target) : Reflect.has(target, prop);
                },
                deleteProperty: (target, prop) => {
                    if (typeof prop === "string") {
                        delete target[prop];
                        return true;
                    }
                    return Reflect.deleteProperty(target, prop);
                },
                ownKeys: (target) => {
                    return Object.keys(target);
                },
                getOwnPropertyDescriptor: (target, prop) => {
                    if (typeof prop === "string" && prop in target) {
                        return { enumerable: true, configurable: true, writable: true, value: this.getGlobalPHPVar(prop).get() };
                    }
                    return Reflect.getOwnPropertyDescriptor(target, prop);
                }
            });
        }
        return this.globalsProxy;
    }
    getPHPVar(name) {
        const isGlobal = this.globalBindings.length > 0 && this.globalBindings[this.globalBindings.length - 1].has(name);
        const scope = isGlobal || this.scopes.length === 0 ? this.vars : this.scopes[this.scopes.length - 1];
        let phpVar = scope[name];
        if (!(phpVar instanceof PHPVariable_1.PHPVariable)) {
            phpVar = new PHPVariable_1.PHPVariable(phpVar && typeof phpVar === "object" && typeof phpVar.get === "function" ? phpVar.get() : phpVar);
            scope[name] = phpVar;
        }
        return phpVar;
    }
    /** Gets a variable value from the current or global scope. */
    getVar(name) {
        if (name === "GLOBALS")
            return this.getGlobalsProxy();
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
        return this.getPHPVar(name).get();
    }
    /** Sets a variable value in the current scope. */
    setVar(name, value) {
        const phpVar = this.getPHPVar(name);
        if (value instanceof PHPVariable_1.PHPVariable) {
            phpVar.bindRef(value);
        }
        else {
            phpVar.set(value);
        }
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
        if (this.globalBindings.length > 0) {
            this.globalBindings[this.globalBindings.length - 1].add(name);
            if (this.scopes.length > 0) {
                const currentScope = this.scopes[this.scopes.length - 1];
                let globalVar = this.vars[name];
                if (!(globalVar instanceof PHPVariable_1.PHPVariable)) {
                    globalVar = new PHPVariable_1.PHPVariable(globalVar && typeof globalVar === "object" && typeof globalVar.get === "function" ? globalVar.get() : globalVar);
                    this.vars[name] = globalVar;
                }
                let localVar = currentScope[name];
                if (!(localVar instanceof PHPVariable_1.PHPVariable)) {
                    localVar = new PHPVariable_1.PHPVariable(localVar && typeof localVar === "object" && typeof localVar.get === "function" ? localVar.get() : localVar);
                    currentScope[name] = localVar;
                }
                localVar.bindRef(globalVar);
            }
        }
    }
    scopeArgs = [];
    /** Pushes a new variable scope. */
    pushScope(args = []) {
        this.scopes.push({});
        this.globalBindings.push(new Set());
        this.staticBindings.push(new Set());
        this.scopeArgs.push(args);
    }
    /** Pops the current variable scope. */
    popScope() {
        this.scopes.pop();
        this.globalBindings.pop();
        this.staticBindings.pop();
        this.scopeArgs.pop();
    }
    getCurrentFunctionArgs() {
        return this.scopeArgs.length > 0 ? this.scopeArgs[this.scopeArgs.length - 1] : [];
    }
    /** Sets a single array offset on a variable. */
    setVarOffset(name, key, value) {
        return this.setVarOffsets(name, [key], value);
    }
    /** Sets nested array offsets on a variable. */
    setVarOffsets(name, keys, value) {
        const cleanKeys = keys.map((k) => (k instanceof PHPVariable_1.PHPVariable ? k.get() : k));
        let target = this.getVar(name);
        if (target !== undefined && target !== null && typeof target !== "object") {
            throw new PHPError_1.PHPTypeError("Cannot use a scalar value as an array");
        }
        if (target === undefined || target === null) {
            const firstKey = cleanKeys[0];
            target = (firstKey === null || typeof firstKey === "number" || /^(0|[1-9]\d*)$/.test(String(firstKey))) ? [] : {};
            this.setVar(name, target);
        }
        return this.assignOffsets(target, cleanKeys, value);
    }
    /** Unsets nested array offsets on a variable. */
    unsetVarOffsets(name, keys) {
        const cleanKeys = keys.map((k) => (k instanceof PHPVariable_1.PHPVariable ? k.get() : k));
        let target = this.getVar(name);
        if (!target || typeof target !== "object")
            return;
        for (let i = 0; i < cleanKeys.length - 1; i++) {
            target = target[cleanKeys[i]];
            if (!target || typeof target !== "object")
                return;
        }
        delete target[cleanKeys[cleanKeys.length - 1]];
    }
    /** Gets nested array offsets on a variable. */
    getVarOffsets(name, keys) {
        const cleanKeys = keys.map((k) => (k instanceof PHPVariable_1.PHPVariable ? k.get() : k));
        let target = this.getVar(name);
        for (const key of cleanKeys) {
            if (target === undefined || target === null)
                return undefined;
            target = target[key];
        }
        return target;
    }
    assignOffsets(target, keys, value) {
        const cleanKeys = keys.map((k) => (k instanceof PHPVariable_1.PHPVariable ? k.get() : k));
        for (let i = 0; i < cleanKeys.length - 1; i++) {
            const key = cleanKeys[i];
            const nextKey = cleanKeys[i + 1];
            if (key === null) {
                const child = (nextKey === null || typeof nextKey === "number" || /^(0|[1-9]\d*)$/.test(String(nextKey))) ? [] : {};
                this.assignOffset(target, null, child);
                target = child;
            }
            else {
                if (target[key] === undefined || target[key] === null) {
                    target[key] = (nextKey === null || typeof nextKey === "number" || /^(0|[1-9]\d*)$/.test(String(nextKey))) ? [] : {};
                }
                target = target[key];
            }
        }
        return this.assignOffset(target, cleanKeys[cleanKeys.length - 1], value);
    }
    assignOffset(target, key, value) {
        if (key instanceof PHPVariable_1.PHPVariable)
            key = key.get();
        if (!target || (typeof target !== "object" && typeof target !== "function")) {
            target = [];
        }
        if (key === null) {
            key = Array.isArray(target) ? target.length : Math.max(-1, ...Object.keys(target).filter((entry) => /^(0|[1-9]\d*)$/.test(entry)).map(Number)) + 1;
        }
        if (value instanceof PHPVariable_1.PHPVariable) {
            target[key] = value.get();
        }
        else {
            target[key] = value;
        }
        return value;
    }
    /** Initializes a static variable in function scope. */
    initStaticVar(scope, name, value) {
        const key = `${scope}:${name}`;
        if (!this.staticVars.has(key)) {
            this.staticVars.set(key, new PHPVariable_1.PHPVariable(value));
        }
        const phpVar = this.getPHPVar(name);
        phpVar.bindRef(this.staticVars.get(key));
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
    /** Gets nested property offsets on an object. */
    async getPropertyOffsets(obj, prop, keys) {
        let target = await this.getProperty(obj, prop);
        const cleanKeys = keys.map((k) => (k instanceof PHPVariable_1.PHPVariable ? k.get() : k));
        for (const key of cleanKeys) {
            if (target === undefined || target === null)
                return undefined;
            target = target[key];
        }
        return target;
    }
    /** Unsets nested property offsets on an object. */
    async unsetPropertyOffsets(obj, prop, keys) {
        let target = await this.getProperty(obj, prop);
        if (!target || typeof target !== "object")
            return;
        const cleanKeys = keys.map((k) => (k instanceof PHPVariable_1.PHPVariable ? k.get() : k));
        for (let i = 0; i < cleanKeys.length - 1; i++) {
            target = target[cleanKeys[i]];
            if (!target || typeof target !== "object")
                return;
        }
        delete target[cleanKeys[cleanKeys.length - 1]];
    }
    /**
     * Calls a method on an object.
     * Expects method name in lowercase.
     * @param method Method name in lowercase.
     */
    async callMethod(obj, method, args = []) {
        if (obj && typeof obj === "object" && typeof obj.get === "function") {
            obj = obj.get();
        }
        logDebug(`CALL_METHOD: ${obj?.constructor?.name}::${method}`);
        if (!obj || (typeof obj !== "object" && typeof obj !== "function"))
            return undefined;
        const lowerMethod = method.toLowerCase();
        const callArgs = args.map((arg) => (arg instanceof PHPVariable_1.PHPVariable ? arg : new PHPVariable_1.PHPVariable(arg)));
        if (typeof obj.callMethod === "function") {
            let res = await obj.callMethod(this, method, callArgs);
            if (res instanceof PHPVariable_1.PHPVariable)
                res = res.get();
            logDebug(`DONE_METHOD: ${obj?.constructor?.name}::${method}`);
            return res;
        }
        const metadata = obj?.phpClass?.methods?.get ? (obj.phpClass.methods.get(method) || obj.phpClass.methods.get(lowerMethod)) : (obj?.phpClass?.methods?.[method] || obj?.phpClass?.methods?.[lowerMethod]);
        if (metadata?.fn) {
            return await metadata.fn.apply(obj, [this, ...callArgs]);
        }
        if (typeof obj[method] === "function") {
            return await obj[method].apply(obj, [this, ...callArgs]);
        }
        if (typeof obj[lowerMethod] === "function") {
            return await obj[lowerMethod].apply(obj, [this, ...callArgs]);
        }
        let target = obj;
        while (target && target !== Object.prototype) {
            for (const propName of Object.getOwnPropertyNames(target)) {
                if (propName.toLowerCase() === lowerMethod && typeof obj[propName] === "function") {
                    return await obj[propName].apply(obj, [this, ...callArgs]);
                }
            }
            target = Object.getPrototypeOf(target);
        }
        logDebug(`ERR_METHOD: ${obj?.constructor?.name}::${method}`);
        return undefined;
    }
    /** Gets a PHPReference wrapper for a variable name. */
    getVarRef(name) {
        return this.getPHPVar(name);
    }
    /**
     * Calls a global function.
     * Expects function name in lowercase.
     * @param name Function name in lowercase.
     */
    async callFunction(name, args = []) {
        if (!name && name !== 0)
            throw new PHPError_1.PHPFatalError("Call to undefined function");
        const callArguments = args.map((arg) => (arg instanceof PHPVariable_1.PHPVariable ? arg : new PHPVariable_1.PHPVariable(arg)));
        if (typeof name === "function") {
            let res = await name.apply(this, [this, ...callArguments]);
            if (res instanceof PHPVariable_1.PHPVariable)
                res = res.get();
            return res;
        }
        const strName = String(name?.get ? name.get() : name);
        logDebug(`CALL_FUNC: ${strName}`);
        const lowerName = strName.toLowerCase();
        const fn = this.functions[strName] || this.functions[lowerName] || (this.engine.functions[strName] || this.engine.functions[lowerName]);
        if (fn) {
            let res = await fn.apply(this, [this, ...callArguments]);
            if (res instanceof PHPVariable_1.PHPVariable)
                res = res.get();
            if (lowerName === "translate" || lowerName === "_e") {
                console.log(`LOG ${strName}(${args.map(a => JSON.stringify(a?.get ? a.get() : a)).join(', ')}):`, JSON.stringify(res));
            }
            logDebug(`DONE_FUNC: ${strName}`);
            return res;
        }
        logDebug(`ERR_FUNC: ${strName}`);
        throw new PHPError_1.PHPFatalError(`Call to undefined function ${strName}()`);
    }
    /**
     * Resolves a class by lowercase name.
     * @param className Class name in lowercase.
     * @param originalName Class name in original casing.
     */
    async resolveClass(className, originalName) {
        const orig = originalName || className;
        const lower = className.toLowerCase();
        let cls = this.classes[className] || this.classes[lower] || this.engine.classes[className] || this.engine.classes[lower];
        if (!cls) {
            cls = await this.engine.resolveClass(lower, orig, this);
        }
        if (!cls && (lower.endsWith("exception") || lower.endsWith("error"))) {
            cls = this.engine.classes["exception"] || this.engine.classes["error"];
        }
        return cls;
    }
    /**
     * Gets a static class constant.
     * @param className Class name in lowercase.
     * @param name Constant name in lowercase.
     * @param originalClassName Class name in original casing.
     */
    async getClassConstant(className, name, originalClassName) {
        const origClass = originalClassName || className;
        const resolvedClass = await this.resolveClass(className, origClass);
        if (!resolvedClass)
            throw new PHPError_1.PHPFatalError(`Class "${origClass}" not found`);
        if (resolvedClass.constants?.has ? resolvedClass.constants.has(name) : (name in resolvedClass.constants)) {
            return resolvedClass.constants.get ? resolvedClass.constants.get(name) : resolvedClass.constants[name];
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
        if (!resolvedClass)
            throw new PHPError_1.PHPFatalError(`Class "${className}" not found`);
        const cleanName = (name.startsWith("$") ? name.slice(1) : name).toLowerCase();
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
        const cleanName = (name.startsWith("$") ? name.slice(1) : name).toLowerCase();
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
        let cls = await this.resolveClass(lowerClass, origClass);
        if (!cls) {
            const shortClassName = lowerClass.split("\\").pop() || lowerClass;
            cls = this.classes[shortClassName] || this.engine.classes[shortClassName];
        }
        if (!cls)
            throw new PHPError_1.PHPFatalError(`Class "${origClass}" not found`);
        const callArgs = args.map((arg) => (arg instanceof PHPVariable_1.PHPVariable ? arg : new PHPVariable_1.PHPVariable(arg)));
        const calledClass = cls;
        let targetClass = cls;
        this.currentClassStack.push(calledClass);
        try {
            while (targetClass) {
                if (targetClass.methods && typeof targetClass.methods.get === "function") {
                    const metadata = targetClass.methods.get(method) || targetClass.methods.get(method.toLowerCase());
                    if (metadata?.fn) {
                        let res = await metadata.fn.apply(targetObj || calledClass, [this, ...callArgs]);
                        if (res instanceof PHPVariable_1.PHPVariable)
                            res = res.get();
                        return res;
                    }
                }
                targetClass = targetClass.parentClass;
            }
            targetClass = cls;
            while (targetClass) {
                if (targetClass.methods && typeof targetClass.methods.get === "function") {
                    const callStaticMeta = targetClass.methods.get("__callstatic");
                    if (callStaticMeta?.fn) {
                        let res = await callStaticMeta.fn.apply(calledClass, [this, method, callArgs]);
                        if (res instanceof PHPVariable_1.PHPVariable)
                            res = res.get();
                        return res;
                    }
                }
                targetClass = targetClass.parentClass;
            }
            if (cls && typeof cls[method] === "function")
                return await cls[method](...callArgs);
            if (cls && typeof cls[method.toLowerCase()] === "function")
                return await cls[method.toLowerCase()](...callArgs);
            if (method.toLowerCase() === "__construct" && typeof cls === "function") {
                const instance = new cls(...callArgs);
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
        let rawClass = await this.resolveClass(lowerClass, origClass);
        if (!rawClass) {
            const shortClassName = lowerClass.split("\\").pop() || lowerClass;
            rawClass = this.classes[shortClassName] || this.engine.classes[shortClassName];
        }
        const callArgs = args.map((arg) => (arg instanceof PHPVariable_1.PHPVariable ? arg : new PHPVariable_1.PHPVariable(arg)));
        if (rawClass && typeof rawClass === "function" && !(rawClass.prototype instanceof PHPObject_1.PHPObject)) {
            const obj = new rawClass(...callArgs);
            if (obj instanceof PHPError_1.PHPError)
                Object.defineProperty(obj, "phpClass", { value: new PHPObject_1.PHPClass(origClass, rawClass) });
            logDebug(`DONE_NEW: ${className}`);
            return obj;
        }
        const phpClass = rawClass instanceof PHPObject_1.PHPClass ? rawClass : new PHPObject_1.PHPClass(origClass);
        const obj = phpClass.nativeConstructor ? Reflect.construct(phpClass.nativeConstructor, callArgs) : new PHPObject_1.PHPObject(phpClass);
        if (phpClass.nativeConstructor) {
            Object.defineProperty(obj, "phpClass", { value: phpClass });
            for (const [name, metadata] of phpClass.properties) {
                if (!metadata.isStatic)
                    obj[name] = metadata.defaultValue;
            }
        }
        let constructMeta = undefined;
        let currentCls = phpClass;
        while (currentCls) {
            if (currentCls.methods && typeof currentCls.methods.get === "function") {
                constructMeta = currentCls.methods.get("__construct");
                if (constructMeta)
                    break;
            }
            if (currentCls.nativeConstructor) {
                constructMeta = {
                    fn: async (ctx, msgArg, codeArg) => {
                        const msg = msgArg instanceof PHPVariable_1.PHPVariable ? msgArg.get() : msgArg;
                        const code = codeArg instanceof PHPVariable_1.PHPVariable ? codeArg.get() : codeArg;
                        if (msg !== undefined && obj instanceof PHPObject_1.PHPObject)
                            obj.properties.set("message", msg);
                        if (code !== undefined && obj instanceof PHPObject_1.PHPObject)
                            obj.properties.set("code", code);
                    }
                };
                break;
            }
            currentCls = currentCls.parentClass;
        }
        if (constructMeta?.fn) {
            await constructMeta.fn.apply(obj, [this, ...callArgs]);
        }
        logDebug(`DONE_NEW: ${className}`);
        return obj;
    }
    /** Evaluates PHP code in the context. */
    async eval(code, filepath = "eval") {
        logDebug(`EVAL: ${filepath}`);
        this.executionDepth++;
        const isTopLevel = this.executionDepth === 1;
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
        finally {
            if (isTopLevel) {
                await this.runShutdownFunctions();
                this.outputBuffer.flushAll(this);
            }
            this.executionDepth--;
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
    async runShutdownFunctions() {
        const shutdownFunctions = this.getInternalVar("shutdownFunctions");
        if (Array.isArray(shutdownFunctions)) {
            this.setInternalVar("shutdownFunctions", []);
            for (const fnObj of shutdownFunctions) {
                try {
                    const { callback, args } = fnObj;
                    const callArgs = (args || []).map((a) => (a instanceof PHPVariable_1.PHPVariable ? a : new PHPVariable_1.PHPVariable(a)));
                    if (typeof callback === "function") {
                        await callback.apply(this, [this, ...callArgs]);
                    }
                    else if (typeof callback === "string") {
                        await this.callFunction(callback, callArgs);
                    }
                    else if (Array.isArray(callback) && callback.length === 2) {
                        await this.callMethod(callback[0], callback[1], callArgs);
                    }
                }
                catch (e) {
                    if (e instanceof PHPError_1.PHPExit || e?.name === "PHPExit")
                        break;
                }
            }
        }
    }
    /** Requires a PHP file. */
    async require(filepath) {
        const resolvedPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.cwd, filepath);
        const normPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
        this.executionDepth++;
        const isTopLevel = this.executionDepth === 1;
        this.includedFiles.add(normPath);
        logDebug(`REQ: ${path.basename(resolvedPath)}`);
        if (!(await this.fileExists(resolvedPath))) {
            this.executionDepth--;
            throw new PHPError_1.PHPFatalError(`Fatal error: require(${filepath}): Failed opening required '${filepath}'`);
        }
        const compiledFunc = await this.engine.compileFile(resolvedPath);
        try {
            const res = await compiledFunc(this);
            return res;
        }
        finally {
            if (isTopLevel) {
                await this.runShutdownFunctions();
                this.outputBuffer.flushAll(this);
            }
            this.executionDepth--;
            logDebug(`DONE_REQ: ${path.basename(resolvedPath)}`);
        }
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