import { PHPLiteral } from "./PHPVariable.js";
export const SYMBOL_PHP_META = Symbol.for("php.meta");
export const SYMBOL_PHP_NAME = Symbol.for("php.name");
export const SYMBOL_PHP_CONSTANTS = Symbol.for("php.constants");
export const SYMBOL_PHP_PROPERTIES = Symbol.for("php.properties");
export const SYMBOL_PHP_METHODS = Symbol.for("php.methods");
export const SYMBOL_PHP_CLASS = Symbol.for("php.class");
export const SYMBOL_PHP_PARENT = Symbol.for("php.parent");
export const SYMBOL_PHP_NEW = Symbol.for("php.new");
export const SYMBOL_PHP_INIT = Symbol.for("php.init");
export const SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS = Symbol.for("php.hasMagicMethods");
export const SYMBOL_PHP_CLASS_INTERFACES = Symbol.for("php.interfaces");
export const SYMBOL_PHP_METHOD_THEN = Symbol.for("php.method.then");
export const SYMBOL_PHP_STATIC_METHOD_PROTOTYPE = Symbol.for("php.staticMethod.prototype");
const HEX = "0123456789ABCDEF";
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();
export function normalizePhpRegistryName(name) {
    return String(name ?? "").replace(/^\\+/, "").split("\\").join("$$").toLowerCase();
}
export function encodePhpIdentifier(name) {
    let encoded = "";
    for (const char of name) {
        const code = char.charCodeAt(0);
        if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95) {
            encoded += char;
            continue;
        }
        for (const byte of UTF8_ENCODER.encode(char)) {
            encoded += `$${HEX[byte >>> 4]}${HEX[byte & 0x0f]}`;
        }
    }
    return encoded;
}
export function encodePhpMethodName(name, isStatic = false) {
    const lower = name.toLowerCase();
    if (lower === "then")
        return SYMBOL_PHP_METHOD_THEN;
    if (isStatic && lower === "prototype")
        return SYMBOL_PHP_STATIC_METHOD_PROTOTYPE;
    return encodePhpIdentifier(lower);
}
export function encodePhpPropertyName(name) {
    return `$${encodePhpIdentifier(name.startsWith("$") ? name.slice(1) : name)}`;
}
export function decodePhpIdentifier(name) {
    const bytes = [];
    for (let i = 0; i < name.length;) {
        if (name[i] === "$" && /^[0-9A-Fa-f]{2}$/.test(name.slice(i + 1, i + 3))) {
            bytes.push(Number.parseInt(name.slice(i + 1, i + 3), 16));
            i += 3;
            continue;
        }
        for (const byte of UTF8_ENCODER.encode(name[i]))
            bytes.push(byte);
        i++;
    }
    return UTF8_DECODER.decode(new Uint8Array(bytes));
}
export function decodePhpPropertyName(name) {
    return decodePhpIdentifier(name.startsWith("$") ? name.slice(1) : name);
}
export function decodePhpMethodName(name) {
    if (name === SYMBOL_PHP_METHOD_THEN)
        return "then";
    if (name === SYMBOL_PHP_STATIC_METHOD_PROTOTYPE)
        return "prototype";
    return decodePhpIdentifier(String(name));
}
export function isEncodedPhpMethodKey(name) {
    return name.startsWith("$") && encodePhpIdentifier(decodePhpIdentifier(name).toLowerCase()) === name;
}
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
    static async getModifierNames(ctx, modifiersArg) {
        const modifiers = Number(await modifiersArg?.get()) || 0;
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
    static async [SYMBOL_PHP_NEW](ctx, typeNameArg, allowsNullFlagArg) {
        const obj = Object.create(ReflectionType.prototype);
        await ReflectionType.__construct.call(obj, ctx, typeNameArg, allowsNullFlagArg);
        return obj;
    }
    static async __construct(ctx, typeNameArg, allowsNullFlagArg) {
        this.typeName = typeNameArg ? String(await typeNameArg.get() ?? "") : "mixed";
        this.allowsNullFlag = allowsNullFlagArg ? Boolean(await allowsNullFlagArg.get()) : true;
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
    static async [SYMBOL_PHP_NEW](ctx, nameArg, positionArg, defaultValueArg, hasDefaultArg) {
        const obj = Object.create(ReflectionParameter.prototype);
        await ReflectionParameter.__construct.call(obj, ctx, nameArg, positionArg, defaultValueArg, hasDefaultArg);
        return obj;
    }
    static async __construct(ctx, nameArg, positionArg, defaultValueArg, hasDefaultArg) {
        this.paramName = nameArg ? String(await nameArg.get() ?? "") : "";
        this.paramPosition = positionArg ? Number(await positionArg.get()) || 0 : 0;
        this.defaultValue = defaultValueArg ? await defaultValueArg.get() : undefined;
        this.hasDefault = hasDefaultArg ? Boolean(await hasDefaultArg.get()) : false;
    }
    getName(ctx) { return this.paramName; }
    getPosition(ctx) { return this.paramPosition; }
    isOptional(ctx) { return this.hasDefault; }
    isDefaultValueAvailable(ctx) { return this.hasDefault; }
    getDefaultValue(ctx) { return this.defaultValue; }
    isPassedByReference(ctx) { return false; }
    async getType(ctx) {
        return await ReflectionType[SYMBOL_PHP_NEW](ctx);
    }
}
export class ReflectionProperty {
    name;
    declaringClassName;
    meta;
    isAccessible = true;
    static async [SYMBOL_PHP_NEW](ctx, classArg, nameArg, metaArg) {
        const obj = Object.create(ReflectionProperty.prototype);
        await ReflectionProperty.__construct.call(obj, ctx, classArg, nameArg, metaArg);
        return obj;
    }
    static async __construct(ctx, classArg, nameArg, metaArg) {
        this.declaringClassName = classArg ? String(await classArg.get() ?? "") : "";
        this.name = nameArg ? String(await nameArg.get() ?? "") : "";
        this.meta = metaArg ? await metaArg.get() : undefined;
    }
    getName(ctx) { return this.name; }
    async getDeclaringClass(ctx) {
        return await ReflectionClass[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.declaringClassName));
    }
    isPublic(ctx) { return !this.meta || this.meta.visibility === "public"; }
    isProtected(ctx) { return this.meta?.visibility === "protected"; }
    isPrivate(ctx) { return this.meta?.visibility === "private"; }
    isStatic(ctx) { return this.meta?.isStatic || false; }
    isReadOnly(ctx) { return this.meta?.isReadOnly || false; }
    async setAccessible(ctx, accessibleArg) {
        this.isAccessible = accessibleArg ? Boolean(await accessibleArg.get()) : true;
    }
    async getValue(ctx, objArg) {
        const obj = await objArg?.get();
        if (obj && typeof obj === "object") {
            return await ctx.getProperty(obj, this.name);
        }
        return undefined;
    }
    async setValue(ctx, objArg, valArg) {
        const obj = await objArg?.get();
        if (obj && typeof obj === "object") {
            await ctx.setProperty(obj, this.name, await valArg?.get());
        }
    }
}
export class ReflectionMethod {
    className;
    methodName;
    meta;
    static async [SYMBOL_PHP_NEW](ctx, classArg, methodArg, metaArg, fnArg) {
        const obj = Object.create(ReflectionMethod.prototype);
        await ReflectionMethod.__construct.call(obj, ctx, classArg, methodArg, metaArg, fnArg);
        return obj;
    }
    static async __construct(ctx, classArg, methodArg, metaArg, fnArg) {
        const cls = classArg ? String(await classArg.get() ?? "") : "";
        const methodName = methodArg ? String(await methodArg.get() ?? "") : "";
        if (!methodName && cls.includes("::")) {
            const parts = cls.split("::");
            this.className = parts[0];
            this.methodName = parts[1];
        }
        else {
            this.className = cls;
            this.methodName = methodName;
        }
        const meta = metaArg ? await metaArg.get() : undefined;
        const fn = fnArg ? await fnArg.get() : undefined;
        this.meta = meta || parseJSFunctionMetadata(fn || meta?.fn, this.methodName);
    }
    getName(ctx) { return this.methodName; }
    async getDeclaringClass(ctx) {
        return await ReflectionClass[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.className));
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
            params.push(await ReflectionParameter[SYMBOL_PHP_NEW](ctx, new PHPLiteral(p.name), new PHPLiteral(idx), new PHPLiteral(p.defaultValue), new PHPLiteral(p.hasDefault)));
        }
        return params;
    }
    setAccessible(ctx, accessibleArg) { }
    async invoke(ctx, objectArg, ...args) {
        const object = await objectArg?.get();
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
        const object = await objectArg?.get();
        const args = argsArg ? await argsArg.get() : [];
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
    static async [SYMBOL_PHP_NEW](ctx, nameArg, fnOrCtxArg) {
        const obj = Object.create(ReflectionFunction.prototype);
        await ReflectionFunction.__construct.call(obj, ctx, nameArg, fnOrCtxArg);
        return obj;
    }
    static async __construct(ctx, nameArg, fnOrCtxArg) {
        this.name = nameArg ? String(await nameArg.get() ?? "") : "";
        let targetFn;
        const fnOrCtx = fnOrCtxArg ? await fnOrCtxArg.get() : undefined;
        if (typeof fnOrCtx === "function") {
            targetFn = fnOrCtx;
        }
        else if (ctx.engine) {
            targetFn = ctx.engine.functions[normalizePhpRegistryName(this.name)];
        }
        this.meta = parseJSFunctionMetadata(targetFn, this.name);
    }
    getName(ctx) { return this.name; }
    getNamespaceName(ctx) {
        const parts = this.name.replace(/^\\+/, "").split("\\");
        return parts.length > 1 ? parts.slice(0, -1).join("\\") : "";
    }
    inNamespace(ctx) { return this.getNamespaceName(ctx).length > 0; }
    getNumberOfParameters(ctx) { return this.meta?.numberOfParameters ?? 0; }
    getNumberOfRequiredParameters(ctx) { return this.meta?.numberOfRequiredParameters ?? 0; }
    async getParameters(ctx) {
        if (!this.meta?.parameters)
            return [];
        const params = [];
        for (let idx = 0; idx < this.meta.parameters.length; idx++) {
            const p = this.meta.parameters[idx];
            params.push(await ReflectionParameter[SYMBOL_PHP_NEW](ctx, new PHPLiteral(p.name), new PHPLiteral(idx), new PHPLiteral(p.defaultValue), new PHPLiteral(p.hasDefault)));
        }
        return params;
    }
    async invoke(ctx, ...args) {
        const fn = ctx.functions[normalizePhpRegistryName(this.name)] || ctx.functionMissing(this.name);
        return await fn(ctx, ...args);
    }
    async invokeArgs(ctx, argsArg) {
        const args = argsArg ? await argsArg.get() : [];
        const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
        const fn = ctx.functions[normalizePhpRegistryName(this.name)] || ctx.functionMissing(this.name);
        return await fn(ctx, ...callArgs);
    }
}
export class ReflectionClass {
    name;
    phpClass;
    classConstructor;
    interfaceFlag = false;
    static async [SYMBOL_PHP_NEW](ctx, nameOrInstanceArg) {
        const obj = Object.create(ReflectionClass.prototype);
        await ReflectionClass.__construct.call(obj, ctx, nameOrInstanceArg);
        return obj;
    }
    static async __construct(ctx, nameOrInstanceArg) {
        const nameOrInstance = await nameOrInstanceArg?.get();
        if (typeof nameOrInstance === "string") {
            const lower = normalizePhpRegistryName(nameOrInstance);
            this.classConstructor = ctx.classes[lower] || ctx.engine.classes[lower];
            this.interfaceFlag = Boolean(ctx.interfaces[lower] || ctx.engine.interfaces[lower]);
            this.phpClass = this.classConstructor?.phpClass;
            this.name = this.classConstructor?.[SYMBOL_PHP_NAME] || nameOrInstance;
        }
        else if (nameOrInstance?.phpClass) {
            this.phpClass = nameOrInstance.phpClass;
            this.name = this.phpClass?.name || "Object";
            this.classConstructor = nameOrInstance[SYMBOL_PHP_CLASS] || nameOrInstance.constructor;
        }
        else {
            this.classConstructor = typeof nameOrInstance === "function"
                ? nameOrInstance
                : nameOrInstance?.[SYMBOL_PHP_CLASS] || nameOrInstance?.constructor;
            this.name = this.classConstructor?.[SYMBOL_PHP_NAME] || nameOrInstance?.name || "Object";
            this.phpClass = this.classConstructor?.phpClass;
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
        const parent = this.classConstructor?.[SYMBOL_PHP_PARENT] || this.phpClass?.parentClass;
        if (!parent)
            return false;
        const parentName = parent[SYMBOL_PHP_NAME] || parent.name;
        return ReflectionClass[SYMBOL_PHP_NEW](ctx, new PHPLiteral(parentName));
    }
    isInterface(ctx) { return this.interfaceFlag; }
    isAbstract(ctx) { return this.phpClass?.isAbstract || false; }
    isFinal(ctx) { return this.phpClass?.isFinal || false; }
    isInstantiable(ctx) { return !this.isAbstract(ctx) && !this.isInterface(ctx); }
    async isSubclassOf(ctx, classNameArg) {
        const className = String(await classNameArg?.get() ?? "");
        return this.phpClass ? this.phpClass.isSubclassOf(className) : false;
    }
    async hasMethod(ctx, nameArg) {
        const name = String(await nameArg?.get() ?? "");
        const methods = this.classConstructor?.[SYMBOL_PHP_METHODS];
        if (Object.hasOwn(methods || {}, encodePhpMethodName(name)) || Object.hasOwn(methods || {}, encodePhpMethodName(name, true)))
            return true;
        return Object.hasOwn(this.phpClass?.methods || {}, name.toLowerCase());
    }
    async getMethod(ctx, nameArg) {
        const name = String(await nameArg?.get() ?? "");
        const methods = this.classConstructor?.[SYMBOL_PHP_METHODS];
        const meta = methods?.[encodePhpMethodName(name)]
            || methods?.[encodePhpMethodName(name, true)]
            || this.phpClass?.methods?.[name.toLowerCase()];
        return ReflectionMethod[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.name), new PHPLiteral(meta?.name || name), new PHPLiteral(meta), new PHPLiteral(meta?.fn));
    }
    async getMethods(ctx) {
        const methods = [];
        const metadata = this.classConstructor?.[SYMBOL_PHP_METHODS] || this.phpClass?.methods;
        if (!metadata)
            return methods;
        const entries = [...Object.entries(metadata), ...Object.getOwnPropertySymbols(metadata).map((key) => [key, metadata[key]])];
        for (const [methodKey, meta] of entries) {
            const methodName = meta?.name || methodKey;
            methods.push(await ReflectionMethod[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.name), new PHPLiteral(methodName), new PHPLiteral(meta), new PHPLiteral(meta?.fn)));
        }
        return methods;
    }
    async hasProperty(ctx, nameArg) {
        const name = String(await nameArg?.get() ?? "");
        const properties = this.classConstructor?.[SYMBOL_PHP_PROPERTIES];
        if (properties != null) {
            return Object.hasOwn(properties, name);
        }
        return Object.hasOwn(this.phpClass?.properties || {}, name);
    }
    async getProperty(ctx, nameArg) {
        const name = String(await nameArg?.get() ?? "");
        const properties = this.classConstructor?.[SYMBOL_PHP_PROPERTIES];
        const meta = properties?.[name] || this.phpClass?.properties?.[name];
        return ReflectionProperty[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.name), new PHPLiteral(name), new PHPLiteral(meta));
    }
    async getProperties(ctx) {
        const props = [];
        const metadata = (this.classConstructor?.[SYMBOL_PHP_PROPERTIES] || this.phpClass?.properties);
        if (!metadata)
            return props;
        for (const [propertyName, meta] of Object.entries(metadata)) {
            const p = meta?.name || propertyName;
            props.push(await ReflectionProperty[SYMBOL_PHP_NEW](ctx, new PHPLiteral(this.name), new PHPLiteral(p), new PHPLiteral(meta)));
        }
        return props;
    }
    async hasConstant(ctx, nameArg) {
        const name = String(await nameArg?.get() ?? "");
        const constants = this.classConstructor?.[SYMBOL_PHP_CONSTANTS];
        if (constants)
            return Object.hasOwn(constants, name.toLowerCase());
        return Object.hasOwn(this.phpClass?.constants || {}, name);
    }
    async getConstant(ctx, nameArg) {
        const name = String(await nameArg?.get() ?? "");
        const constant = this.classConstructor?.[SYMBOL_PHP_CONSTANTS]?.[name.toLowerCase()];
        if (constant !== undefined)
            return constant && typeof constant === "object" && "value" in constant ? constant.value : constant;
        return this.phpClass?.constants?.[name];
    }
    async getConstants(ctx) {
        const metadata = this.classConstructor?.[SYMBOL_PHP_CONSTANTS];
        if (metadata) {
            const constants = {};
            for (const [key, entry] of Object.entries(metadata)) {
                const constantName = entry && typeof entry === "object" && "name" in entry ? entry.name : key;
                constants[constantName] = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
            }
            return constants;
        }
        if (!this.phpClass)
            return {};
        return { ...this.phpClass.constants };
    }
    async newInstance(ctx, ...args) {
        return await ctx.createObject(this.name, args);
    }
    async newInstanceArgs(ctx, argsArg) {
        const args = argsArg ? await argsArg.get() : [];
        const callArgs = Array.isArray(args) ? args.map(a => new PHPLiteral(a)) : Object.values(args || {}).map(a => new PHPLiteral(a));
        return await ctx.createObject(this.name, callArgs);
    }
    async newInstanceWithoutConstructor(ctx) {
        const className = normalizePhpRegistryName(this.name);
        const cls = this.phpClass || ctx.classes[className] || ctx.engine.classes[className];
        if (cls?.[SYMBOL_PHP_INIT]) {
            const obj = Object.create(cls.prototype);
            await cls[SYMBOL_PHP_INIT](ctx, obj);
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