"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPVariable = exports.PHPLiteral = void 0;
const PHPError_1 = require("./PHPError");
class PHPLiteral {
    value;
    constructor(value) {
        this.value = value && typeof value === "object" && typeof value.get === "function"
            ? value.get()
            : value;
    }
    get() {
        return this.value;
    }
    set(val) {
        throw new PHPError_1.PHPFatalError(`Literals cannot be changed`);
    }
    bindRef(target) {
        // Literal variables do not bind references
    }
    unbindRef() {
        // N/A
    }
    isReference() {
        return false;
    }
    async call(ctx, method, args = []) {
        throw new PHPError_1.PHPFatalError(`Call to a member function ${method}() on a non-object`);
    }
}
exports.PHPLiteral = PHPLiteral;
class PHPVariable {
    value;
    refTarget;
    constructor(initialValue = undefined) {
        if (initialValue && typeof initialValue === "object" && typeof initialValue.get === "function") {
            const ref = initialValue;
            if (ref.refTarget) {
                let rootTarget = ref.refTarget;
                while (rootTarget.refTarget) {
                    rootTarget = rootTarget.refTarget;
                }
                this.refTarget = rootTarget;
            }
            else {
                this.value = ref.get();
            }
        }
        else {
            this.value = initialValue;
        }
    }
    get() {
        if (this.refTarget)
            return this.refTarget.get();
        return this.value;
    }
    set(val) {
        if (this.refTarget)
            return this.refTarget.set(val);
        const unwrapped = val && typeof val === "object" && typeof val.get === "function" ? val.get() : val;
        this.value = unwrapped;
        return unwrapped;
    }
    bindRef(target) {
        let actualTarget = target;
        while (actualTarget.refTarget) {
            actualTarget = actualTarget.refTarget;
        }
        this.refTarget = actualTarget;
    }
    unbindRef() {
        if (this.refTarget) {
            this.value = this.refTarget.get();
            this.refTarget = undefined;
        }
    }
    isReference() {
        return Boolean(this.refTarget);
    }
    async call(ctx, method, args = []) {
        const obj = this.get();
        if (!obj || (typeof obj !== "object" && typeof obj !== "function")) {
            throw new PHPError_1.PHPFatalError(`Call to a member function ${method}() on a non-object`);
        }
        const lowerMethod = method.toLowerCase();
        const callArgs = args.map((arg) => (arg && typeof arg === "object" && typeof arg.get === "function" ? arg : new PHPLiteral(arg)));
        if (typeof obj.callMethod === "function") {
            let res = await obj.callMethod(ctx, method, callArgs);
            if (res && typeof res === "object" && typeof res.get === "function")
                res = res.get();
            return res;
        }
        const metadata = obj?.phpClass?.methods?.get ? (obj.phpClass.methods.get(method) || obj.phpClass.methods.get(lowerMethod)) : (obj?.phpClass?.methods?.[method] || obj?.phpClass?.methods?.[lowerMethod]);
        if (metadata?.fn) {
            let res = await metadata.fn.apply(obj, [ctx, ...callArgs]);
            if (res && typeof res === "object" && typeof res.get === "function")
                res = res.get();
            return res;
        }
        if (typeof obj[method] === "function") {
            let res = await obj[method].apply(obj, [ctx, ...callArgs]);
            if (res && typeof res === "object" && typeof res.get === "function")
                res = res.get();
            return res;
        }
        if (typeof obj[lowerMethod] === "function") {
            let res = await obj[lowerMethod].apply(obj, [ctx, ...callArgs]);
            if (res && typeof res === "object" && typeof res.get === "function")
                res = res.get();
            return res;
        }
        let target = obj;
        while (target && target !== Object.prototype) {
            for (const propName of Object.getOwnPropertyNames(target)) {
                if (propName.toLowerCase() === lowerMethod && typeof obj[propName] === "function") {
                    let res = await obj[propName].apply(obj, [ctx, ...callArgs]);
                    if (res && typeof res === "object" && typeof res.get === "function")
                        res = res.get();
                    return res;
                }
            }
            target = Object.getPrototypeOf(target);
        }
        throw new PHPError_1.PHPFatalError(`Call to undefined method ${obj?.constructor?.name || "object"}::${method}()`);
    }
}
exports.PHPVariable = PHPVariable;
//# sourceMappingURL=PHPVariable.js.map