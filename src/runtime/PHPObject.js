import { PHPFatalError } from "./PHPError.js";
import { PHPReference } from "./PHPVariable.js";
import { normalizePhpRegistryName } from "./Reflection.js";
export class PHPClass {
    name;
    parentClass;
    nativeConstructor;
    interfaces = [];
    traits = [];
    constants = Object.create(null);
    staticProperties = Object.create(null);
    properties = Object.create(null);
    methods = Object.create(null);
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
            this.properties = Object.assign(Object.create(null), parentClass.properties);
            this.methods = Object.assign(Object.create(null), parentClass.methods);
            this.constants = Object.assign(Object.create(null), parentClass.constants);
        }
    }
    isSubclassOf(className) {
        if (normalizePhpRegistryName(this.name) === normalizePhpRegistryName(className))
            return true;
        if (this.parentClass && this.parentClass.isSubclassOf(className))
            return true;
        return this.interfaces.some((iface) => iface.isSubclassOf(className));
    }
}
export class PHPObject {
    phpClass;
    properties = Object.create(null);
    settingProperties = new Set();
    gettingProperties = new Set();
    constructor(phpClass) {
        this.phpClass = phpClass;
        for (const [name, metadata] of Object.entries(phpClass.properties)) {
            if (metadata.isStatic)
                continue;
            const value = metadata.defaultValue;
            this.properties[name] = Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value;
        }
    }
    async getProperty(ctx, name) {
        if (!(this.gettingProperties instanceof Set)) {
            this.gettingProperties = new Set();
        }
        if (Object.hasOwn(this.properties, name)) {
            return this.properties[name];
        }
        const __getMeta = this.phpClass.methods["__get"];
        if (__getMeta?.fn && !this.gettingProperties.has(name)) {
            this.gettingProperties.add(name);
            try {
                return await __getMeta.fn.call(this, ctx, name);
            }
            finally {
                this.gettingProperties.delete(name);
            }
        }
        return undefined;
    }
    async setProperty(ctx, name, value) {
        if (!(this.settingProperties instanceof Set)) {
            this.settingProperties = new Set();
        }
        const __setMeta = this.phpClass.methods["__set"];
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
            this.properties[name] = value;
        }
    }
    async callMethod(ctx, name, args) {
        const lowerName = name.toLowerCase();
        ctx.currentClassStack.push(this.phpClass);
        try {
            let cls = this.phpClass;
            while (cls) {
                const methodMeta = cls.methods[lowerName];
                if (methodMeta?.fn) {
                    let res = await methodMeta.fn.apply(this, [ctx, ...args]);
                    if (res && typeof res === "object" && typeof res.get === "function")
                        res = await res.get();
                    return res;
                }
                cls = cls.parentClass;
            }
            cls = this.phpClass;
            while (cls) {
                const __callMeta = cls.methods["__call"];
                if (__callMeta?.fn) {
                    let res = await __callMeta.fn.call(this, ctx, name, args);
                    if (res instanceof PHPReference)
                        res = await res.get();
                    return res;
                }
                cls = cls.parentClass;
            }
            let target = this;
            while (target && target !== Object.prototype) {
                for (const propName of Object.getOwnPropertyNames(target)) {
                    if (propName.toLowerCase() === lowerName && typeof this[propName] === "function") {
                        let res = await this[propName].apply(this, args);
                        if (res instanceof PHPReference)
                            res = await res.get();
                        return res;
                    }
                }
                target = Object.getPrototypeOf(target);
            }
            throw new PHPFatalError(`Call to undefined method ${this.phpClass.name}::${name}()`);
        }
        finally {
            ctx.currentClassStack.pop();
        }
    }
    async toString(ctx) {
        const __toStringMeta = this.phpClass.methods["__tostring"];
        if (__toStringMeta?.fn) {
            return String(await __toStringMeta.fn.call(this, ctx));
        }
        return `Object(${this.phpClass.name})`;
    }
}
//# sourceMappingURL=PHPObject.js.map