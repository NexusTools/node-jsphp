"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPObject = exports.PHPClass = void 0;
class PHPClass {
    name;
    parentClass;
    interfaces = [];
    traits = [];
    constants = new Map();
    staticProperties = new Map();
    methods = new Map();
    isAbstract = false;
    isFinal = false;
    constructor(name, parentClass) {
        this.name = name;
        this.parentClass = parentClass;
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
    constructor(phpClass) {
        this.phpClass = phpClass;
    }
    async getProperty(ctx, name) {
        if (this.properties.has(name)) {
            return this.properties.get(name);
        }
        const __get = this.phpClass.methods.get("__get");
        if (__get) {
            return await __get.call(this, ctx, name);
        }
        return undefined;
    }
    async setProperty(ctx, name, value) {
        const __set = this.phpClass.methods.get("__set");
        if (__set) {
            await __set.call(this, ctx, name, value);
        }
        else {
            this.properties.set(name, value);
        }
    }
    async callMethod(ctx, name, args) {
        const method = this.phpClass.methods.get(name.toLowerCase());
        if (method) {
            return await method.apply(this, [ctx, ...args]);
        }
        const __call = this.phpClass.methods.get("__call");
        if (__call) {
            return await __call.call(this, ctx, name, args);
        }
        throw new Error(`Call to undefined method ${this.phpClass.name}::${name}()`);
    }
    async toString(ctx) {
        const __toString = this.phpClass.methods.get("__tostring");
        if (__toString) {
            return String(await __toString.call(this, ctx));
        }
        return `Object(${this.phpClass.name})`;
    }
}
exports.PHPObject = PHPObject;
//# sourceMappingURL=PHPObject.js.map