"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPObject = exports.PHPClass = void 0;
const PHPError_1 = require("./PHPError");
class PHPClass {
    name;
    parentClass;
    nativeConstructor;
    interfaces = [];
    traits = [];
    constants = new Map();
    staticProperties = new Map();
    properties = new Map();
    methods = new Map();
    isAbstract = false;
    isFinal = false;
    constructor(name, parentClass) {
        this.name = name;
        if (typeof parentClass === "function") {
            const nativeParent = new PHPClass(parentClass.phpName || parentClass.name);
            nativeParent.nativeConstructor = parentClass;
            parentClass = nativeParent;
        }
        this.parentClass = parentClass;
        if (parentClass instanceof PHPClass) {
            this.nativeConstructor = parentClass.nativeConstructor;
            this.properties = new Map(parentClass.properties);
            this.methods = new Map(parentClass.methods);
            this.constants = new Map(parentClass.constants);
        }
    }
    isSubclassOf(className) {
        if (this.name.toLowerCase() === className.toLowerCase())
            return true;
        if (this.parentClass && this.parentClass.isSubclassOf(className))
            return true;
        return this.interfaces.some((iface) => iface.isSubclassOf(className));
    }
}
exports.PHPClass = PHPClass;
class PHPObject {
    phpClass;
    properties = new Map();
    settingProperties = new Set();
    proxy;
    constructor(phpClass) {
        this.phpClass = phpClass;
        for (const [name, metadata] of phpClass.properties) {
            if (metadata.isStatic)
                continue;
            const value = metadata.defaultValue;
            this.properties.set(name, Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value);
        }
    }
    asProxy(ctx) {
        if (this.proxy)
            return this.proxy;
        const target = this;
        this.proxy = new Proxy(target, {
            get(object, property, receiver) {
                if (property === "then")
                    return undefined;
                if (typeof property !== "string")
                    return Reflect.get(object, property, receiver);
                if (property in object)
                    return Reflect.get(object, property, receiver);
                if (object.properties.has(property))
                    return object.properties.get(property);
                if (object.phpClass.methods.has("__get"))
                    return object.getProperty(ctx, property);
                if (object.phpClass.methods.has("__call"))
                    return (...args) => object.callMethod(ctx, property, args);
                return undefined;
            },
            set(object, property, value) {
                if (typeof property !== "string" || property in object)
                    return Reflect.set(object, property, value);
                void object.setProperty(ctx, property, value);
                return true;
            },
        });
        return this.proxy;
    }
    async getProperty(ctx, name) {
        if (this.properties.has(name)) {
            return this.properties.get(name);
        }
        const __getMeta = this.phpClass.methods.get("__get");
        if (__getMeta?.fn) {
            return await __getMeta.fn.call(this, ctx, name);
        }
        return undefined;
    }
    async setProperty(ctx, name, value) {
        const __setMeta = this.phpClass.methods.get("__set");
        if (__setMeta?.fn && !this.settingProperties.has(name)) {
            this.settingProperties.add(name);
            try {
                await __setMeta.fn.call(this, ctx, name, value);
            }
            finally {
                this.settingProperties.delete(name);
            }
        }
        else {
            this.properties.set(name, value);
        }
    }
    async callMethod(ctx, name, args) {
        const lowerName = name.toLowerCase();
        ctx.currentClassStack.push(this.phpClass);
        try {
            const methodMeta = this.phpClass.methods.get(lowerName);
            if (methodMeta?.fn) {
                return await methodMeta.fn.apply(this, [ctx, ...args]);
            }
            const __callMeta = this.phpClass.methods.get("__call");
            if (__callMeta?.fn) {
                return await __callMeta.fn.call(this, ctx, name, args);
            }
            let target = this;
            while (target && target !== Object.prototype) {
                for (const propName of Object.getOwnPropertyNames(target)) {
                    if (propName.toLowerCase() === lowerName && typeof this[propName] === "function") {
                        return await this[propName].apply(this, args);
                    }
                }
                target = Object.getPrototypeOf(target);
            }
            throw new PHPError_1.PHPFatalError(`Call to undefined method ${this.phpClass.name}::${name}()`);
        }
        finally {
            ctx.currentClassStack.pop();
        }
    }
    async toString(ctx) {
        const __toStringMeta = this.phpClass.methods.get("__tostring");
        if (__toStringMeta?.fn) {
            return String(await __toStringMeta.fn.call(this, ctx));
        }
        return `Object(${this.phpClass.name})`;
    }
}
exports.PHPObject = PHPObject;
//# sourceMappingURL=PHPObject.js.map