import { PHPFatalError } from "./PHPError.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";
export const SYMBOL_PHP_REFERENCE = Symbol.for("php.reference");
export const SYMBOL_PHP_VARIABLE = Symbol.for("php.variable");
export class PHPReference {
    static [Symbol.hasInstance](value) {
        if (Function.prototype[Symbol.hasInstance].call(this, value))
            return true;
        return this === PHPReference
            && value !== null
            && (typeof value === "object" || typeof value === "function")
            && value[SYMBOL_PHP_REFERENCE] === true;
    }
    async setFrom(otherref) {
        return await this.set(await otherref.get());
    }
    async isset() {
        const value = await this.get();
        return value !== null && value !== undefined;
    }
    async unset() {
        await this.set(undefined);
    }
}
export function isPHPReference(value) {
    return value instanceof PHPReference
        || (value !== null && (typeof value === "object" || typeof value === "function") && value[SYMBOL_PHP_REFERENCE] === true);
}
export function isPHPVariable(value) {
    return value instanceof PHPVariable
        || (value !== null && (typeof value === "object" || typeof value === "function") && value[SYMBOL_PHP_VARIABLE] === true);
}
export class PHPLiteral extends PHPReference {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    async get() {
        return this.value;
    }
    async set(_value) {
        throw new PHPFatalError("Literals cannot be changed");
    }
    toString() {
        return this.value === null || this.value === undefined ? "" : String(this.value);
    }
    valueOf() {
        return this.value;
    }
    [Symbol.toPrimitive](hint) {
        if (hint === "number")
            return Number(this.value) || 0;
        if (hint === "string")
            return this.value === null || this.value === undefined ? "" : String(this.value);
        return this.value;
    }
}
export class PHPPropertyReference extends PHPReference {
    ctx;
    obj;
    prop;
    phpName;
    constructor(ctx, obj, prop, phpName = prop.startsWith("$") ? prop.slice(1) : prop) {
        super();
        this.ctx = ctx;
        this.obj = obj;
        this.prop = prop;
        this.phpName = phpName;
    }
    async get() {
        const target = isPHPReference(this.obj) ? await this.obj.get() : this.obj;
        if (target === null || target === undefined) {
            return this.ctx.getProperty(target, this.prop);
        }
        const direct = target[this.prop];
        if (direct !== undefined) {
            return isPHPReference(direct) ? await direct.get() : direct;
        }
        if (typeof target.__get === "function") {
            return await target.__get(this.ctx, new PHPLiteral(this.phpName));
        }
        return await this.ctx.getProperty(target, this.prop);
    }
    async set(value) {
        const target = isPHPReference(this.obj) ? await this.obj.get() : this.obj;
        if (target === null || target === undefined) {
            return this.ctx.setProperty(target, this.prop, value);
        }
        const direct = target[this.prop];
        if (isPHPReference(direct))
            return await direct.set(value);
        if (direct !== undefined) {
            target[this.prop] = value;
            return value;
        }
        if (typeof target.__set === "function") {
            return await target.__set(this.ctx, new PHPLiteral(this.phpName), new PHPLiteral(value));
        }
        return await this.ctx.setProperty(target, this.prop, value);
    }
    async isset() {
        const target = isPHPReference(this.obj) ? await this.obj.get() : this.obj;
        if (target === null || target === undefined)
            return false;
        const direct = target[this.prop];
        if (direct !== undefined) {
            const value = isPHPReference(direct) ? await direct.get() : direct;
            return value !== null && value !== undefined;
        }
        if (typeof target.__isset === "function") {
            const result = await target.__isset(this.ctx, new PHPLiteral(this.phpName));
            return this.ctx.isTruthy(isPHPReference(result) ? await result.get() : result);
        }
        return false;
    }
    async unset() {
        const target = isPHPReference(this.obj) ? await this.obj.get() : this.obj;
        if (target === null || target === undefined)
            return;
        if (target[this.prop] === undefined && typeof target.__unset === "function") {
            await target.__unset(this.ctx, new PHPLiteral(this.phpName));
            return;
        }
        delete target[this.prop];
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
    async get() {
        const target = isPHPReference(this.container) ? await this.container.get() : this.container;
        if (target === null || (typeof target !== "object" && typeof target !== "function"))
            return undefined;
        const value = target[this.key];
        return isPHPReference(value) ? await value.get() : value;
    }
    async set(value) {
        const target = isPHPReference(this.container) ? await this.container.get() : this.container;
        const actual = isPHPReference(value) ? await value.get() : value;
        if (target !== null && (typeof target === "object" || typeof target === "function")) {
            target[this.key] = actual;
        }
        return actual;
    }
}
export class PHPVariable extends PHPReference {
    value;
    constructor(initialValue = undefined) {
        super();
        this.value = initialValue;
    }
    async get() {
        return this.value;
    }
    async set(value) {
        const actual = isPHPReference(value) ? await value.get() : value;
        if (Array.isArray(actual)) {
            const copy = [...actual];
            for (const key of Object.keys(actual)) {
                if (isNaN(Number(key)))
                    copy[key] = actual[key];
            }
            delete copy.__ptr;
            this.value = copy;
            return copy;
        }
        if (typeof actual === "object" && actual !== null && !actual[SYMBOL_PHP_NAME] && actual.constructor === Object) {
            const copy = { ...actual };
            delete copy.__ptr;
            this.value = copy;
            return copy;
        }
        this.value = actual;
        return actual;
    }
    setFrom(otherref) {
        if (otherref instanceof PHPVariable)
            return this.set(otherref.value);
        return super.setFrom(otherref);
    }
    toString() {
        return this.value === null || this.value === undefined ? "" : String(this.value);
    }
    valueOf() {
        return this.value;
    }
    [Symbol.toPrimitive](hint) {
        if (hint === "number")
            return Number(this.value) || 0;
        if (hint === "string")
            return this.value === null || this.value === undefined ? "" : String(this.value);
        return this.value;
    }
}
Object.defineProperties(PHPReference.prototype, {
    [SYMBOL_PHP_REFERENCE]: { value: true },
});
Object.defineProperties(PHPVariable.prototype, {
    [SYMBOL_PHP_VARIABLE]: { value: true },
});
//# sourceMappingURL=PHPVariable.js.map