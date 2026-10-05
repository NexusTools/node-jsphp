import { PHPLiteral } from "./PHPVariable.js";
export const SYMBOL_PHP_META = Symbol.for("php.meta");
export const SYMBOL_PHP_NAME = Symbol.for("php.name");
export const SYMBOL_PHP_CONSTANTS = Symbol.for("php.constants");
export const SYMBOL_PHP_PROPERTIES = Symbol.for("php.properties");
export const SYMBOL_PHP_METHODS = Symbol.for("php.methods");
export const SYMBOL_PHP_CLASS = Symbol.for("php.class");
export const SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS = Symbol.for("php.hasMagicMethods");
export const SYMBOL_PHP_CLASS_INTERFACES = Symbol.for("php.interfaces");
export function defineFunction(fn, meta) {
    const params = (meta.parameters || []).map((p, idx) => {
        const hasDefault = p.hasDefault ?? p.isOptional ?? false;
        return {
            name: p.name,
            position: idx,
            isOptional: hasDefault,
            hasDefault: hasDefault,
            defaultValue: p.defaultValue,
            type: p.type || "mixed",
            byref: Boolean(p.byref),
        };
    });
    const requiredCount = params.filter((p) => !p.hasDefault).length;
    Object.defineProperty(fn, SYMBOL_PHP_META, {
        value: {
            name: meta.name.toLowerCase(),
            visibility: meta.visibility || "public",
            numberOfParameters: params.length,
            numberOfRequiredParameters: requiredCount,
            parameters: params,
        },
        enumerable: false,
        configurable: false,
        writable: false
    });
    return fn;
}
export function parseJSFunctionMetadata(fn, name = "") {
    if (!fn || typeof fn !== "function") {
        return {
            name: name.toLowerCase(),
            visibility: "public",
            numberOfParameters: 0,
            numberOfRequiredParameters: 0,
            parameters: [],
        };
    }
    if (fn[SYMBOL_PHP_META]) {
        return fn[SYMBOL_PHP_META];
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
export class Reflection {
    static getModifierNames(ctx, modifiersArg) {
        const modifiers = Number(modifiersArg?.get()) || 0;
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
export class ReflectionType {
    typeName;
    allowsNullFlag;
    static async __$$__new(ctx, typeNameArg, allowsNullFlagArg) {
        const obj = Object.create(ReflectionType.prototype);
        await ReflectionType.__construct.call(obj, ctx, typeNameArg, allowsNullFlagArg);
        return obj;
    }
    static async __construct(ctx, typeNameArg, allowsNullFlagArg) {
        this.typeName = typeNameArg ? String(typeNameArg.get() ?? "") : "mixed";
        this.allowsNullFlag = allowsNullFlagArg ? Boolean(allowsNullFlagArg.get()) : true;
    }
    allowsNull(ctx) { return this.allowsNullFlag; }
    getName(ctx) { return this.typeName; }
    __toString(ctx) { return this.typeName; }
}
export class ReflectionParameter {
    paramName;
    paramPosition;
    defaultValue;
    hasDefault;
    static async __$$__new(ctx, nameArg, positionArg, defaultValueArg, hasDefaultArg) {
        const obj = Object.create(ReflectionParameter.prototype);
        await ReflectionParameter.__construct.call(obj, ctx, nameArg, positionArg, defaultValueArg, hasDefaultArg);
        return obj;
    }
    static async __construct(ctx, nameArg, positionArg, defaultValueArg, hasDefaultArg) {
        this.paramName = nameArg ? String(nameArg.get() ?? "") : "";
        this.paramPosition = positionArg ? Number(positionArg.get()) || 0 : 0;
        this.defaultValue = defaultValueArg ? defaultValueArg.get() : undefined;
        this.hasDefault = hasDefaultArg ? Boolean(hasDefaultArg.get()) : false;
    }
    getName(ctx) { return this.paramName; }
    getPosition(ctx) { return this.paramPosition; }
    isOptional(ctx) { return this.hasDefault; }
    isDefaultValueAvailable(ctx) { return this.hasDefault; }
    getDefaultValue(ctx) { return this.defaultValue; }
    isPassedByReference(ctx) { return false; }
    async getType(ctx) {
        return await ReflectionType.__$$__new(ctx);
    }
}
export class ReflectionProperty {
    name;
    declaringClassName;
    meta;
    isAccessible = true;
    static async __$$__new(ctx, classArg, nameArg, metaArg) {
        const obj = Object.create(ReflectionProperty.prototype);
        await ReflectionProperty.__construct.call(obj, ctx, classArg, nameArg, metaArg);
        return obj;
    }
    static async __construct(ctx, classArg, nameArg, metaArg) {
        this.declaringClassName = classArg ? String(classArg.get() ?? "") : "";
        this.name = nameArg ? String(nameArg.get() ?? "") : "";
        this.meta = metaArg ? metaArg.get() : undefined;
    }
    getName(ctx) { return this.name; }
    async getDeclaringClass(ctx) {
        return await ReflectionClass.__$$__new(ctx, new PHPLiteral(this.declaringClassName));
    }
    isPublic(ctx) { return !this.meta || this.meta.visibility === "public"; }
    isProtected(ctx) { return this.meta?.visibility === "protected"; }
    isPrivate(ctx) { return this.meta?.visibility === "private"; }
    isStatic(ctx) { return this.meta?.isStatic || false; }
    isReadOnly(ctx) { return this.meta?.isReadOnly || false; }
    setAccessible(ctx, accessibleArg) {
        this.isAccessible = accessibleArg ? Boolean(accessibleArg.get()) : true;
    }
    async getValue(ctx, objArg) {
        const obj = objArg?.get();
        if (obj && typeof obj === "object") {
            return await ctx.getProperty(obj, this.name);
        }
        return undefined;
    }
    async setValue(ctx, objArg, valArg) {
        const obj = objArg?.get();
        if (obj && typeof obj === "object") {
            await ctx.setProperty(obj, this.name, valArg?.get());
        }
    }
}
export class ReflectionMethod {
    className;
    methodName;
    meta;
    static async __$$__new(ctx, classArg, methodArg, metaArg, fnArg) {
        const obj = Object.create(ReflectionMethod.prototype);
        await ReflectionMethod.__construct.call(obj, ctx, classArg, methodArg, metaArg, fnArg);
        return obj;
    }
    static async __construct(ctx, classArg, methodArg, metaArg, fnArg) {
        const cls = classArg ? String(classArg.get() ?? "") : "";
        const methodName = methodArg ? String(methodArg.get() ?? "") : "";
        if (!methodName && cls.includes("::")) {
            const parts = cls.split("::");
            this.className = parts[0];
            this.methodName = parts[1];
        }
        else {
            this.className = cls;
            this.methodName = methodName;
        }
        const meta = metaArg ? metaArg.get() : undefined;
        const fn = fnArg ? fnArg.get() : undefined;
        this.meta = meta || parseJSFunctionMetadata(fn || meta?.fn, this.methodName);
    }
    getName(ctx) { return this.methodName; }
    async getDeclaringClass(ctx) {
        return await ReflectionClass.__$$__new(ctx, new PHPLiteral(this.className));
    }
    isPublic(ctx) { return !this.meta || this.meta.visibility === "public"; }
    isProtected(ctx) { return this.meta?.visibility === "protected"; }
    isPrivate(ctx) { return this.meta?.visibility === "private"; }
    isStatic(ctx) { return this.meta?.isStatic || false; }
    isAbstract(ctx) { return this.meta?.isAbstract || false; }
    isFinal(ctx) { return this.meta?.isFinal || false; }
    isConstructor(ctx) { return this.methodName.toLowerCase() === "__construct"; }
    isDestructor(ctx) { return this.methodName.toLowerCase() === "__destruct"; }
    getNumberOfParameters(ctx) { return this.meta?.numberOfParameters ?? 0; }
    getNumberOfRequiredParameters(ctx) { return this.meta?.numberOfRequiredParameters ?? 0; }
    async getParameters(ctx) {
        if (!this.meta?.parameters)
            return [];
        const params = [];
        for (let idx = 0; idx < this.meta.parameters.length; idx++) {
            const p = this.meta.parameters[idx];
            params.push(await ReflectionParameter.__$$__new(ctx, new PHPLiteral(p.name), new PHPLiteral(idx), new PHPLiteral(p.defaultValue), new PHPLiteral(p.hasDefault)));
        }
        return params;
    }
    setAccessible(ctx, accessibleArg) { }
    async invoke(ctx, objectArg, ...args) {
        const object = objectArg?.get();
        const lower = this.methodName.toLowerCase();
        if (object && typeof object === "object") {
            if (typeof object[lower] === "function")
                return await object[lower](ctx, ...args);
            if (typeof object.__call === "function")
                return await object.__call(ctx, new PHPLiteral(lower), new PHPLiteral(args));
            return ctx.methodMissing(object, lower);
        }
        return undefined;
    }
    async invokeArgs(ctx, objectArg, argsArg) {
        const object = objectArg?.get();
        const args = argsArg ? argsArg.get() : [];
        const lower = this.methodName.toLowerCase();
        if (object && typeof object === "object") {
            const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
            if (typeof object[lower] === "function")
                return await object[lower](ctx, ...callArgs);
            if (typeof object.__call === "function")
                return await object.__call(ctx, new PHPLiteral(lower), new PHPLiteral(callArgs));
            return ctx.methodMissing(object, lower);
        }
        return undefined;
    }
}
export class ReflectionFunction {
    name;
    meta;
    static async __$$__new(ctx, nameArg, fnOrCtxArg) {
        const obj = Object.create(ReflectionFunction.prototype);
        await ReflectionFunction.__construct.call(obj, ctx, nameArg, fnOrCtxArg);
        return obj;
    }
    static async __construct(ctx, nameArg, fnOrCtxArg) {
        this.name = nameArg ? String(nameArg.get() ?? "") : "";
        let targetFn;
        const fnOrCtx = fnOrCtxArg ? fnOrCtxArg.get() : undefined;
        if (typeof fnOrCtx === "function") {
            targetFn = fnOrCtx;
        }
        else if (ctx.engine) {
            targetFn = ctx.engine.functions[this.name.toLowerCase()];
        }
        this.meta = targetFn?.phpMeta || parseJSFunctionMetadata(targetFn, this.name);
    }
    getName(ctx) { return this.name; }
    getNamespaceName(ctx) { return ""; }
    inNamespace(ctx) { return false; }
    getNumberOfParameters(ctx) { return this.meta?.numberOfParameters ?? 0; }
    getNumberOfRequiredParameters(ctx) { return this.meta?.numberOfRequiredParameters ?? 0; }
    async getParameters(ctx) {
        if (!this.meta?.parameters)
            return [];
        const params = [];
        for (let idx = 0; idx < this.meta.parameters.length; idx++) {
            const p = this.meta.parameters[idx];
            params.push(await ReflectionParameter.__$$__new(ctx, new PHPLiteral(p.name), new PHPLiteral(idx), new PHPLiteral(p.defaultValue), new PHPLiteral(p.hasDefault)));
        }
        return params;
    }
    async invoke(ctx, ...args) {
        const fn = ctx.functions[this.name.toLowerCase()] || ctx.functionMissing(this.name);
        return await fn(ctx, ...args);
    }
    async invokeArgs(ctx, argsArg) {
        const args = argsArg ? argsArg.get() : [];
        const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
        const fn = ctx.functions[this.name.toLowerCase()] || ctx.functionMissing(this.name);
        return await fn(ctx, ...callArgs);
    }
}
export class ReflectionClass {
    name;
    phpClass;
    static async __$$__new(ctx, nameOrInstanceArg) {
        const obj = Object.create(ReflectionClass.prototype);
        await ReflectionClass.__construct.call(obj, ctx, nameOrInstanceArg);
        return obj;
    }
    static async __construct(ctx, nameOrInstanceArg) {
        const nameOrInstance = nameOrInstanceArg?.get();
        if (typeof nameOrInstance === "string") {
            this.name = nameOrInstance;
            const lower = this.name.toLowerCase();
            this.phpClass = ctx.classes[this.name] || ctx.classes[lower] || ctx.engine.classes[this.name] || ctx.engine.classes[lower];
        }
        else if (nameOrInstance?.phpClass) {
            this.phpClass = nameOrInstance.phpClass;
            this.name = this.phpClass?.name || "Object";
        }
        else {
            this.name = nameOrInstance?.name || "Object";
        }
    }
    getName(ctx) { return this.name; }
    getShortName(ctx) {
        const parts = this.name.split("\\");
        return parts[parts.length - 1];
    }
    getNamespaceName(ctx) {
        const parts = this.name.split("\\");
        return parts.length > 1 ? parts.slice(0, -1).join("\\") : "";
    }
    inNamespace(ctx) { return this.getNamespaceName(ctx).length > 0; }
    async getParentClass(ctx) {
        return this.phpClass?.parentClass ? await ReflectionClass.__$$__new(ctx, new PHPLiteral(this.phpClass.parentClass.name)) : false;
    }
    isInterface(ctx) { return false; }
    isAbstract(ctx) { return this.phpClass?.isAbstract || false; }
    isFinal(ctx) { return this.phpClass?.isFinal || false; }
    isInstantiable(ctx) { return !this.isAbstract(ctx) && !this.isInterface(ctx); }
    isSubclassOf(ctx, classNameArg) {
        const className = String(classNameArg?.get() ?? "");
        return this.phpClass ? this.phpClass.isSubclassOf(className) : false;
    }
    hasMethod(ctx, nameArg) {
        const name = String(nameArg?.get() ?? "");
        return this.phpClass ? this.phpClass.methods.has(name.toLowerCase()) : true;
    }
    async getMethod(ctx, nameArg) {
        const name = String(nameArg?.get() ?? "");
        const meta = this.phpClass?.methods.get(name.toLowerCase());
        return await ReflectionMethod.__$$__new(ctx, new PHPLiteral(this.name), new PHPLiteral(name), new PHPLiteral(meta), new PHPLiteral(meta?.fn));
    }
    async getMethods(ctx) {
        if (!this.phpClass)
            return [];
        const methods = [];
        for (const [m, meta] of this.phpClass.methods.entries()) {
            methods.push(await ReflectionMethod.__$$__new(ctx, new PHPLiteral(this.name), new PHPLiteral(m), new PHPLiteral(meta), new PHPLiteral(meta?.fn)));
        }
        return methods;
    }
    hasProperty(ctx, nameArg) {
        const name = String(nameArg?.get() ?? "");
        return this.phpClass ? this.phpClass.properties.has(name) : true;
    }
    async getProperty(ctx, nameArg) {
        const name = String(nameArg?.get() ?? "");
        const meta = this.phpClass?.properties.get(name);
        return await ReflectionProperty.__$$__new(ctx, new PHPLiteral(this.name), new PHPLiteral(name), new PHPLiteral(meta));
    }
    async getProperties(ctx) {
        if (!this.phpClass)
            return [];
        const props = [];
        for (const [p, meta] of this.phpClass.properties.entries()) {
            props.push(await ReflectionProperty.__$$__new(ctx, new PHPLiteral(this.name), new PHPLiteral(p), new PHPLiteral(meta)));
        }
        return props;
    }
    hasConstant(ctx, nameArg) {
        const name = String(nameArg?.get() ?? "");
        return this.phpClass ? this.phpClass.constants.has(name) : false;
    }
    getConstant(ctx, nameArg) {
        const name = String(nameArg?.get() ?? "");
        return this.phpClass ? this.phpClass.constants.get(name) : undefined;
    }
    getConstants(ctx) {
        if (!this.phpClass)
            return {};
        return Object.fromEntries(this.phpClass.constants);
    }
    async newInstance(ctx, ...args) {
        return await ctx.createObject(this.name, args);
    }
    async newInstanceArgs(ctx, argsArg) {
        const args = argsArg ? argsArg.get() : [];
        const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
        return await ctx.createObject(this.name, callArgs);
    }
    async newInstanceWithoutConstructor(ctx) {
        const cls = this.phpClass || ctx.classes[this.name] || ctx.classes[this.name.toLowerCase()] || ctx.engine.classes[this.name] || ctx.engine.classes[this.name.toLowerCase()];
        if (cls && typeof cls.__$$__init === "function") {
            const obj = Object.create(cls.prototype);
            await cls.__$$__init(ctx, obj);
            return obj;
        }
        return {};
    }
}
export class ReflectionRuntime {
    static classes = {
        "reflectionclass": ReflectionClass,
        "reflectionmethod": ReflectionMethod,
        "reflectionproperty": ReflectionProperty,
        "reflectionfunction": ReflectionFunction,
        "reflectionparameter": ReflectionParameter,
        "reflectiontype": ReflectionType,
    };
    static register(engine) {
        engine.registerClasses(ReflectionRuntime.classes);
    }
}
//# sourceMappingURL=Reflection.js.map