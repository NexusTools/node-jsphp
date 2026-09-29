"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPObject = exports.PHPClass = void 0;
const PHPError_1 = require("../errors/PHPError");
class PHPClass {
    name;
    parentClass;
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
        const __getMeta = this.phpClass.methods.get("__get");
        if (__getMeta?.fn) {
            return await __getMeta.fn.call(this, ctx, name);
        }
        return undefined;
    }
    async setProperty(ctx, name, value) {
        const __setMeta = this.phpClass.methods.get("__set");
        if (__setMeta?.fn) {
            await __setMeta.fn.call(this, ctx, name, value);
        }
        else {
            this.properties.set(name, value);
        }
    }
    async callMethod(ctx, name, args) {
        const methodMeta = this.phpClass.methods.get(name.toLowerCase());
        if (methodMeta?.fn) {
            return await methodMeta.fn.apply(this, [ctx, ...args]);
        }
        const __callMeta = this.phpClass.methods.get("__call");
        if (__callMeta?.fn) {
            return await __callMeta.fn.call(this, ctx, name, args);
        }
        throw new PHPError_1.PHPFatalError(`Call to undefined method ${this.phpClass.name}::${name}()`);
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