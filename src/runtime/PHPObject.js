import { PHPFatalError } from "./PHPError.js";
import { PHPVariable } from "./PHPVariable.js";
export class PHPClass {
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
export class PHPObject {
    phpClass;
    properties = new Map();
    settingProperties = new Set();
    gettingProperties = new Set();
    constructor(phpClass) {
        this.phpClass = phpClass;
        for (const [name, metadata] of phpClass.properties) {
            if (metadata.isStatic)
                continue;
            const value = metadata.defaultValue;
            this.properties.set(name, Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value);
        }
    }
    async getProperty(ctx, name) {
        if (!(this.gettingProperties instanceof Set)) {
            this.gettingProperties = new Set();
        }
        if (this.properties.has(name)) {
            return this.properties.get(name);
        }
        const __getMeta = this.phpClass.methods.get("__get");
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
            let cls = this.phpClass;
            while (cls) {
                if (cls.methods && typeof cls.methods.get === "function") {
                    const methodMeta = cls.methods.get(lowerName);
                    if (methodMeta?.fn) {
                        let res = await methodMeta.fn.apply(this, [ctx, ...args]);
                        if (res && typeof res === "object" && typeof res.get === "function")
                            res = res.get();
                        return res;
                    }
                }
                cls = cls.parentClass;
            }
            cls = this.phpClass;
            while (cls) {
                if (cls.methods && typeof cls.methods.get === "function") {
                    const __callMeta = cls.methods.get("__call");
                    if (__callMeta?.fn) {
                        let res = await __callMeta.fn.call(this, ctx, name, args);
                        if (res instanceof PHPVariable)
                            res = res.get();
                        return res;
                    }
                }
                cls = cls.parentClass;
            }
            let target = this;
            while (target && target !== Object.prototype) {
                for (const propName of Object.getOwnPropertyNames(target)) {
                    if (propName.toLowerCase() === lowerName && typeof this[propName] === "function") {
                        let res = await this[propName].apply(this, args);
                        if (res instanceof PHPVariable)
                            res = res.get();
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
        const __toStringMeta = this.phpClass.methods.get("__tostring");
        if (__toStringMeta?.fn) {
            return String(await __toStringMeta.fn.call(this, ctx));
        }
        return `Object(${this.phpClass.name})`;
    }
}
//# sourceMappingURL=PHPObject.js.map