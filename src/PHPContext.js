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
const PHPEngine_1 = require("./PHPEngine");
const Superglobals_1 = require("./runtime/superglobals/Superglobals");
const OutputBuffer_1 = require("./runtime/output/OutputBuffer");
const PHPError_1 = require("./runtime/errors/PHPError");
const PHPObject_1 = require("./runtime/objects/PHPObject");
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
    internalVars = new Map();
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
        if (this.internalVars.has(name)) {
            return this.internalVars.get(name);
        }
        return this.engine.getInternalVar(name);
    }
    setInternalVar(name, value) {
        this.internalVars.set(name, value);
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
        return this.engine.getConstant(name);
    }
    defineConstant(name, val) {
        this.engine.constants.set(name, val);
        this.engine.constants.set(name.toUpperCase(), val);
    }
    getVar(name) {
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
                case "GLOBALS": return this.vars;
            }
        }
        return this.vars[name];
    }
    setVar(name, value) {
        this.vars[name] = value;
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
    }
    async callMethod(obj, method, args = []) {
        if (obj instanceof PHPObject_1.PHPObject) {
            return await obj.callMethod(this, method, args);
        }
        if (obj && typeof obj[method] === "function") {
            return await obj[method].apply(obj, args);
        }
        return undefined;
    }
    async callFunction(name, args = []) {
        const fn = this.engine.functions.get(name.toLowerCase());
        if (fn) {
            return await fn.apply(this, [this, ...args]);
        }
        throw new PHPError_1.PHPFatalError(`Call to undefined function ${name}()`);
    }
    async createObject(className, args = []) {
        const rawClass = this.engine.classes.get(className.toLowerCase());
        if (rawClass && typeof rawClass === "function" && !(rawClass.prototype instanceof PHPObject_1.PHPObject)) {
            return new rawClass(...args);
        }
        const phpClass = rawClass instanceof PHPObject_1.PHPClass ? rawClass : new PHPObject_1.PHPClass(className);
        const obj = new PHPObject_1.PHPObject(phpClass);
        const __construct = phpClass.methods ? phpClass.methods.get("__construct") : undefined;
        if (__construct?.fn) {
            await __construct.fn.apply(obj, [this, ...args]);
        }
        return obj;
    }
    async eval(code, filepath = "eval") {
        try {
            const compiledFunc = await this.engine.compileCode(code, filepath);
            return await compiledFunc(this);
        }
        catch (err) {
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
    async include(filepath) {
        const resolvedPath = path.isAbsolute(filepath)
            ? filepath
            : path.resolve(this.cwd, filepath);
        if (!(await this.fileExists(resolvedPath))) {
            await this.triggerError(`include(${filepath}): Failed to open stream: No such file or directory`, 2);
            return false;
        }
        const compiledFunc = await this.engine.compileFile(resolvedPath);
        return await compiledFunc(this);
    }
    async includeOnce(filepath) {
        const resolvedPath = path.isAbsolute(filepath)
            ? filepath
            : path.resolve(this.cwd, filepath);
        if (this.includedFiles.has(resolvedPath)) {
            return true;
        }
        if (!(await this.fileExists(resolvedPath))) {
            await this.triggerError(`include_once(${filepath}): Failed to open stream: No such file or directory`, 2);
            return false;
        }
        this.includedFiles.add(resolvedPath);
        return await this.include(resolvedPath);
    }
    async require(filepath) {
        const resolvedPath = path.isAbsolute(filepath)
            ? filepath
            : path.resolve(this.cwd, filepath);
        if (!(await this.fileExists(resolvedPath))) {
            throw new PHPError_1.PHPFatalError(`Fatal error: require(${filepath}): Failed opening required '${filepath}'`);
        }
        const compiledFunc = await this.engine.compileFile(resolvedPath);
        return await compiledFunc(this);
    }
    async requireOnce(filepath) {
        const resolvedPath = path.isAbsolute(filepath)
            ? filepath
            : path.resolve(this.cwd, filepath);
        if (this.includedFiles.has(resolvedPath)) {
            return true;
        }
        if (!(await this.fileExists(resolvedPath))) {
            throw new PHPError_1.PHPFatalError(`Fatal error: require_once(${filepath}): Failed opening required '${filepath}'`);
        }
        this.includedFiles.add(resolvedPath);
        return await this.require(resolvedPath);
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