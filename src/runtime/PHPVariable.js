import { PHPFatalError } from "./PHPError.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";
export class PHPReference {
    __isPHPReference = true;
}
export function isPHPReference(val) {
    if (!val || (typeof val !== "object" && typeof val !== "function"))
        return false;
    return val instanceof PHPReference || Object.getOwnPropertyDescriptor(val, "__isPHPReference")?.value === true;
}
export function isPHPVariable(val) {
    if (!val || (typeof val !== "object" && typeof val !== "function"))
        return false;
    return val instanceof PHPVariable || Object.getOwnPropertyDescriptor(val, "__isPHPVariable")?.value === true;
}
export class PHPLiteral extends PHPReference {
    __isPHPLiteral = true;
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    get() {
        return this.value;
    }
    set(val) {
        throw new PHPFatalError(`Literals cannot be changed`);
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
        throw new PHPFatalError(`Call to a member function ${method}() on a non-object`);
    }
    toString() {
        const val = this.get();
        return val === null || val === undefined ? "" : String(val);
    }
    valueOf() {
        return this.get();
    }
    [Symbol.toPrimitive](hint) {
        const val = this.get();
        if (hint === "number")
            return Number(val) || 0;
        if (hint === "string")
            return val === null || val === undefined ? "" : String(val);
        return val;
    }
}
export class PHPPropertyReference extends PHPReference {
    ctx;
    obj;
    prop;
    constructor(ctx, obj, prop) {
        super();
        this.ctx = ctx;
        this.obj = obj;
        this.prop = prop;
    }
    get() {
        let target = this.obj instanceof PHPReference ? this.obj.get() : this.obj;
        if (!target || typeof target !== "object")
            return undefined;
        const p = this.prop.startsWith("$") ? this.prop : "$" + this.prop;
        const nop = this.prop.startsWith("$") ? this.prop.slice(1) : this.prop;
        if (p in target) {
            const val = target[p];
            return val instanceof PHPReference ? val.get() : val;
        }
        if (nop in target && typeof target[nop] !== "function") {
            const val = target[nop];
            return val instanceof PHPReference ? val.get() : val;
        }
        const dataObj = target["$data"]?.get ? target["$data"].get() : target["$data"] || target.data;
        if (dataObj && typeof dataObj === "object") {
            if (p in dataObj) {
                const val = dataObj[p];
                return val instanceof PHPReference ? val.get() : val;
            }
            if (nop in dataObj && typeof dataObj[nop] !== "function") {
                const val = dataObj[nop];
                return val instanceof PHPReference ? val.get() : val;
            }
        }
        return undefined;
    }
    set(val) {
        return this.ctx.setProperty(this.obj, this.prop, val);
    }
}
export class PHPArrayOffsetReference extends PHPReference {
    container;
    key;
    constructor(container, key) {
        super();
        this.container = container;
        this.key = key;
    }
    get() {
        const obj = this.container instanceof PHPReference ? this.container.get() : this.container;
        if (obj && typeof obj === "object") {
            const val = obj[this.key];
            return val instanceof PHPReference ? val.get() : val;
        }
        return undefined;
    }
    set(val) {
        const obj = this.container instanceof PHPReference ? this.container.get() : this.container;
        const unwrapped = val instanceof PHPReference ? val.get() : val;
        if (obj && typeof obj === "object") {
            obj[this.key] = unwrapped;
        }
        return unwrapped;
    }
}
export class PHPVariable extends PHPReference {
    __isPHPVariable = true;
    value;
    refTarget;
    constructor(initialValue = undefined) {
        super();
        if (initialValue instanceof PHPReference) {
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
        const unwrapped = val instanceof PHPReference ? val.get() : val;
        if (Array.isArray(unwrapped)) {
            const copy = [...unwrapped];
            for (const k of Object.keys(unwrapped)) {
                if (isNaN(Number(k)))
                    copy[k] = unwrapped[k];
            }
            delete copy.__ptr;
            this.value = copy;
            return copy;
        }
        else if (typeof unwrapped === "object" && unwrapped !== null && !unwrapped[SYMBOL_PHP_NAME] && unwrapped.constructor === Object) {
            const copy = { ...unwrapped };
            delete copy.__ptr;
            this.value = copy;
            return copy;
        }
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
            throw new PHPFatalError(`Call to a member function ${method}() on a non-object`);
        }
        const lowerMethod = method.toLowerCase();
        const callArgs = args.map((arg) => (arg instanceof PHPReference ? arg : new PHPLiteral(arg)));
        if (typeof obj.callMethod === "function") {
            let res = await obj.callMethod(ctx, method, callArgs);
            if (res instanceof PHPReference)
                res = res.get();
            return res;
        }
        const metadata = obj?.phpClass?.methods?.get ? (obj.phpClass.methods.get(method) || obj.phpClass.methods.get(lowerMethod)) : (obj?.phpClass?.methods?.[method] || obj?.phpClass?.methods?.[lowerMethod]);
        if (metadata?.fn) {
            let res = await metadata.fn.apply(obj, [ctx, ...callArgs]);
            if (res instanceof PHPReference)
                res = res.get();
            return res;
        }
        if (typeof obj[method] === "function") {
            let res = await obj[method].apply(obj, [ctx, ...callArgs]);
            if (res instanceof PHPReference)
                res = res.get();
            return res;
        }
        if (typeof obj[lowerMethod] === "function") {
            let res = await obj[lowerMethod].apply(obj, [ctx, ...callArgs]);
            if (res instanceof PHPReference)
                res = res.get();
            return res;
        }
        throw new PHPFatalError(`Call to undefined method ${obj?.constructor?.name}::${method}()`);
    }
    toString() {
        const val = this.get();
        return val === null || val === undefined ? "" : String(val);
    }
    valueOf() {
        return this.get();
    }
    [Symbol.toPrimitive](hint) {
        const val = this.get();
        if (hint === "number")
            return Number(val) || 0;
        if (hint === "string")
            return val === null || val === undefined ? "" : String(val);
        return val;
    }
}
//# sourceMappingURL=PHPVariable.js.map