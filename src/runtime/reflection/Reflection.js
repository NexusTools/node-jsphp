"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectionMethod = exports.ReflectionClass = void 0;
class ReflectionClass {
    name;
    phpClass;
    constructor(nameOrInstance) {
        this.name = typeof nameOrInstance === "string" ? nameOrInstance : nameOrInstance?.phpClass?.name || "Object";
    }
    getName() {
        return this.name;
    }
    isInstantiable() {
        return true;
    }
}
exports.ReflectionClass = ReflectionClass;
class ReflectionMethod {
    className;
    methodName;
    constructor(className, methodName) {
        this.className = className;
        this.methodName = methodName;
    }
    getName() {
        return this.methodName;
    }
}
exports.ReflectionMethod = ReflectionMethod;
//# sourceMappingURL=Reflection.js.map