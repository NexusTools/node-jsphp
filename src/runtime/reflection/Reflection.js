"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectionClass = exports.ReflectionFunction = exports.ReflectionMethod = exports.ReflectionProperty = exports.ReflectionParameter = exports.ReflectionType = exports.Reflection = void 0;
exports.defineFunction = defineFunction;
exports.parseJSFunctionMetadata = parseJSFunctionMetadata;
const PHPObject_1 = require("../objects/PHPObject");
function defineFunction(fn, meta) {
    const params = (meta.parameters || []).map((p, idx) => {
        const hasDefault = p.hasDefault ?? p.isOptional ?? false;
        return {
            name: p.name,
            position: idx,
            isOptional: hasDefault,
            hasDefault: hasDefault,
            defaultValue: p.defaultValue,
            type: p.type || "mixed",
        };
    });
    const requiredCount = params.filter((p) => !p.hasDefault).length;
    fn.phpMeta = {
        name: meta.name.toLowerCase(),
        visibility: meta.visibility || "public",
        numberOfParameters: params.length,
        numberOfRequiredParameters: requiredCount,
        parameters: params,
    };
    return fn;
}
function parseJSFunctionMetadata(fn, name = "") {
    if (!fn || typeof fn !== "function") {
        return {
            name: name.toLowerCase(),
            visibility: "public",
            numberOfParameters: 0,
            numberOfRequiredParameters: 0,
            parameters: [],
        };
    }
    if (fn.phpMeta) {
        return fn.phpMeta;
    }
    const str = fn.toString().trim();
    const openParen = str.indexOf("(");
    const closeParen = str.indexOf(")", openParen);
    let paramTokens = [];
    if (openParen !== -1 && closeParen > openParen) {
        const paramsStr = str.slice(openParen + 1, closeParen).trim();
        if (paramsStr.length > 0) {
            paramTokens = splitParamString(paramsStr);
        }
    }
    // Skip internal 'ctx' or 'context' argument if present
    if (paramTokens.length > 0) {
        const firstToken = paramTokens[0].trim();
        const firstName = firstToken.split("=")[0].trim().replace(/^\.\.\./, "");
        if (firstName === "ctx" || firstName === "_ctx" || firstName === "context") {
            paramTokens.shift();
        }
    }
    const parameters = [];
    let requiredCount = 0;
    paramTokens.forEach((token, idx) => {
        const trimmed = token.trim();
        if (!trimmed)
            return;
        const eqIdx = trimmed.indexOf("=");
        let pName = "";
        let defaultValue = undefined;
        let hasDefault = false;
        if (eqIdx !== -1) {
            pName = trimmed.slice(0, eqIdx).trim().replace(/^\.\.\./, "");
            const defaultStr = trimmed.slice(eqIdx + 1).trim();
            hasDefault = true;
            defaultValue = parseSimpleLiteral(defaultStr);
        }
        else {
            pName = trimmed.replace(/^\.\.\./, "").trim();
            hasDefault = false;
            requiredCount++;
        }
        parameters.push({
            name: pName,
            position: idx,
            isOptional: hasDefault,
            hasDefault: hasDefault,
            defaultValue: defaultValue,
            type: "mixed",
        });
    });
    return {
        name: name.toLowerCase(),
        visibility: "public",
        numberOfParameters: parameters.length,
        numberOfRequiredParameters: requiredCount,
        parameters,
    };
}
function splitParamString(paramsStr) {
    const tokens = [];
    let depth = 0;
    let current = "";
    for (let i = 0; i < paramsStr.length; i++) {
        const char = paramsStr[i];
        if (char === "(" || char === "{" || char === "[")
            depth++;
        else if (char === ")" || char === "}" || char === "]")
            depth--;
        if (char === "," && depth === 0) {
            tokens.push(current);
            current = "";
        }
        else {
            current += char;
        }
    }
    if (current.trim())
        tokens.push(current);
    return tokens;
}
function parseSimpleLiteral(valStr) {
    if (valStr === "null")
        return null;
    if (valStr === "true")
        return true;
    if (valStr === "false")
        return false;
    if (valStr === "undefined")
        return undefined;
    if (!isNaN(Number(valStr)))
        return Number(valStr);
    if ((valStr.startsWith('"') && valStr.endsWith('"')) || (valStr.startsWith("'") && valStr.endsWith("'"))) {
        return valStr.slice(1, -1);
    }
    return valStr;
}
class Reflection {
    static getModifierNames(modifiers) {
        const res = [];
        if (modifiers & 1)
            res.push("public");
        if (modifiers & 2)
            res.push("protected");
        if (modifiers & 4)
            res.push("private");
        if (modifiers & 8)
            res.push("static");
        if (modifiers & 16)
            res.push("abstract");
        if (modifiers & 32)
            res.push("final");
        if (modifiers & 64)
            res.push("readonly");
        return res;
    }
}
exports.Reflection = Reflection;
class ReflectionType {
    typeName;
    allowsNullFlag;
    constructor(typeName = "mixed", allowsNullFlag = true) {
        this.typeName = typeName;
        this.allowsNullFlag = allowsNullFlag;
    }
    allowsNull() { return this.allowsNullFlag; }
    getName() { return this.typeName; }
    __toString() { return this.typeName; }
}
exports.ReflectionType = ReflectionType;
class ReflectionParameter {
    paramName;
    paramPosition;
    defaultValue;
    hasDefault;
    constructor(name, position, defaultValue, hasDefault = false) {
        this.paramName = name;
        this.paramPosition = position;
        this.defaultValue = defaultValue;
        this.hasDefault = hasDefault;
    }
    getName() { return this.paramName; }
    getPosition() { return this.paramPosition; }
    isOptional() { return this.hasDefault; }
    isDefaultValueAvailable() { return this.hasDefault; }
    getDefaultValue() { return this.defaultValue; }
    isPassedByReference() { return false; }
    getType() { return new ReflectionType(); }
}
exports.ReflectionParameter = ReflectionParameter;
class ReflectionProperty {
    name;
    declaringClassName;
    meta;
    isAccessible = true;
    constructor(declaringClassName, name, meta) {
        this.declaringClassName = declaringClassName;
        this.name = name;
        this.meta = meta;
    }
    getName() { return this.name; }
    getDeclaringClass() { return new ReflectionClass(this.declaringClassName); }
    isPublic() { return !this.meta || this.meta.visibility === "public"; }
    isProtected() { return this.meta?.visibility === "protected"; }
    isPrivate() { return this.meta?.visibility === "private"; }
    isStatic() { return this.meta?.isStatic || false; }
    isReadOnly() { return this.meta?.isReadOnly || false; }
    setAccessible(accessible) { this.isAccessible = accessible; }
    async getValue(ctx, obj) {
        return await obj.getProperty(ctx, this.name);
    }
    async setValue(ctx, obj, val) {
        await obj.setProperty(ctx, this.name, val);
    }
}
exports.ReflectionProperty = ReflectionProperty;
class ReflectionMethod {
    className;
    methodName;
    meta;
    constructor(className, methodName, meta, fn) {
        this.className = className;
        this.methodName = methodName;
        this.meta = meta || parseJSFunctionMetadata(fn || meta?.fn, methodName);
    }
    getName() { return this.methodName; }
    getDeclaringClass() { return new ReflectionClass(this.className); }
    isPublic() { return !this.meta || this.meta.visibility === "public"; }
    isProtected() { return this.meta?.visibility === "protected"; }
    isPrivate() { return this.meta?.visibility === "private"; }
    isStatic() { return this.meta?.isStatic || false; }
    isAbstract() { return this.meta?.isAbstract || false; }
    isFinal() { return this.meta?.isFinal || false; }
    isConstructor() { return this.methodName.toLowerCase() === "__construct"; }
    isDestructor() { return this.methodName.toLowerCase() === "__destruct"; }
    getNumberOfParameters() { return this.meta?.numberOfParameters ?? 0; }
    getNumberOfRequiredParameters() { return this.meta?.numberOfRequiredParameters ?? 0; }
    getParameters() {
        if (!this.meta?.parameters)
            return [];
        return this.meta.parameters.map((p, idx) => new ReflectionParameter(p.name, idx, p.defaultValue, p.hasDefault));
    }
    setAccessible(accessible) { }
    async invoke(ctx, object, ...args) {
        if (object) {
            return await object.callMethod(ctx, this.methodName, args);
        }
        return undefined;
    }
}
exports.ReflectionMethod = ReflectionMethod;
class ReflectionFunction {
    name;
    meta;
    constructor(name, fnOrCtx) {
        this.name = name;
        let targetFn;
        if (typeof fnOrCtx === "function") {
            targetFn = fnOrCtx;
        }
        else if (fnOrCtx?.engine) {
            targetFn = fnOrCtx.engine.functions.get(name.toLowerCase());
        }
        this.meta = targetFn?.phpMeta || parseJSFunctionMetadata(targetFn, name);
    }
    getName() { return this.name; }
    getNamespaceName() { return ""; }
    inNamespace() { return false; }
    getNumberOfParameters() { return this.meta?.numberOfParameters ?? 0; }
    getNumberOfRequiredParameters() { return this.meta?.numberOfRequiredParameters ?? 0; }
    getParameters() {
        if (!this.meta?.parameters)
            return [];
        return this.meta.parameters.map((p, idx) => new ReflectionParameter(p.name, idx, p.defaultValue, p.hasDefault));
    }
    async invoke(ctx, ...args) {
        return await ctx.callFunction(this.name, args);
    }
    async invokeArgs(ctx, args) {
        return await ctx.callFunction(this.name, args);
    }
}
exports.ReflectionFunction = ReflectionFunction;
class ReflectionClass {
    name;
    phpClass;
    constructor(nameOrInstance) {
        if (typeof nameOrInstance === "string") {
            this.name = nameOrInstance;
        }
        else if (nameOrInstance?.phpClass) {
            this.phpClass = nameOrInstance.phpClass;
            this.name = this.phpClass?.name || "Object";
        }
        else {
            this.name = nameOrInstance?.name || "Object";
        }
    }
    getName() { return this.name; }
    getShortName() {
        const parts = this.name.split("\\");
        return parts[parts.length - 1];
    }
    getNamespaceName() {
        const parts = this.name.split("\\");
        return parts.length > 1 ? parts.slice(0, -1).join("\\") : "";
    }
    inNamespace() { return this.getNamespaceName().length > 0; }
    getParentClass() {
        return this.phpClass?.parentClass ? new ReflectionClass(this.phpClass.parentClass.name) : false;
    }
    isInterface() { return false; }
    isAbstract() { return this.phpClass?.isAbstract || false; }
    isFinal() { return this.phpClass?.isFinal || false; }
    isInstantiable() { return !this.isAbstract() && !this.isInterface(); }
    isSubclassOf(className) {
        return this.phpClass ? this.phpClass.isSubclassOf(className) : false;
    }
    hasMethod(name) {
        return this.phpClass ? this.phpClass.methods.has(name.toLowerCase()) : true;
    }
    getMethod(name) {
        const meta = this.phpClass?.methods.get(name.toLowerCase());
        return new ReflectionMethod(this.name, name, meta, meta?.fn);
    }
    getMethods() {
        if (!this.phpClass)
            return [];
        return Array.from(this.phpClass.methods.entries()).map(([m, meta]) => new ReflectionMethod(this.name, m, meta, meta?.fn));
    }
    hasProperty(name) {
        return this.phpClass ? this.phpClass.properties.has(name) : true;
    }
    getProperty(name) {
        const meta = this.phpClass?.properties.get(name);
        return new ReflectionProperty(this.name, name, meta);
    }
    getProperties() {
        if (!this.phpClass)
            return [];
        return Array.from(this.phpClass.properties.entries()).map(([p, meta]) => new ReflectionProperty(this.name, p, meta));
    }
    hasConstant(name) {
        return this.phpClass ? this.phpClass.constants.has(name) : false;
    }
    getConstant(name) {
        return this.phpClass ? this.phpClass.constants.get(name) : undefined;
    }
    getConstants() {
        if (!this.phpClass)
            return {};
        return Object.fromEntries(this.phpClass.constants);
    }
    async newInstance(ctx, ...args) {
        return await ctx.createObject(this.name, args);
    }
    async newInstanceArgs(ctx, args = []) {
        return await ctx.createObject(this.name, args);
    }
    async newInstanceWithoutConstructor(ctx) {
        const cls = this.phpClass || new PHPObject_1.PHPClass(this.name);
        return new PHPObject_1.PHPObject(cls);
    }
}
exports.ReflectionClass = ReflectionClass;
//# sourceMappingURL=Reflection.js.map