import { createRequire } from "module";
import { PHPExtension } from "../PHPExtension.js";
import { PHPObject, PHPClass } from "../runtime/PHPObject.js";
import { PHPVariable } from "../runtime/PHPVariable.js";
const customRequire = createRequire(import.meta.url);
export function wrapJSValue(val) {
    if (val === null || val === undefined)
        return val;
    if (typeof val === "boolean" || typeof val === "number" || typeof val === "string")
        return val;
    if (Array.isArray(val)) {
        return val.map(wrapJSValue);
    }
    return new NodeJSObject(val);
}
export function unwrapPHPValue(val) {
    const actual = val instanceof PHPVariable ? val.get() : val;
    if (actual instanceof NodeJSObject) {
        return actual.jsValue;
    }
    if (Array.isArray(actual)) {
        return actual.map(unwrapPHPValue);
    }
    return actual;
}
export class NodeJSObject extends PHPObject {
    jsValue;
    constructor(jsValue) {
        const clsName = typeof jsValue === "function" ? (jsValue.name || "NodeJSFunction") : "NodeJSObject";
        super(new PHPClass(clsName));
        this.jsValue = jsValue;
    }
    async getProperty(ctx, name) {
        if (!this.jsValue || (typeof this.jsValue !== "object" && typeof this.jsValue !== "function"))
            return undefined;
        const lowerName = name.toLowerCase();
        let targetName = name;
        if (!(name in this.jsValue)) {
            let target = this.jsValue;
            while (target && target !== Object.prototype) {
                for (const prop of Object.getOwnPropertyNames(target)) {
                    if (prop.toLowerCase() === lowerName) {
                        targetName = prop;
                        break;
                    }
                }
                target = Object.getPrototypeOf(target);
            }
        }
        const val = this.jsValue[targetName];
        if (typeof val === "function") {
            const boundFn = val.bind(this.jsValue);
            return wrapJSValue(boundFn);
        }
        return wrapJSValue(val);
    }
    async setProperty(ctx, name, value) {
        if (this.jsValue && (typeof this.jsValue === "object" || typeof this.jsValue === "function")) {
            const lowerName = name.toLowerCase();
            let targetName = name;
            if (!(name in this.jsValue)) {
                let target = this.jsValue;
                while (target && target !== Object.prototype) {
                    for (const prop of Object.getOwnPropertyNames(target)) {
                        if (prop.toLowerCase() === lowerName) {
                            targetName = prop;
                            break;
                        }
                    }
                    target = Object.getPrototypeOf(target);
                }
            }
            this.jsValue[targetName] = unwrapPHPValue(value);
        }
    }
    async callMethod(ctx, name, args = []) {
        if (!this.jsValue)
            return undefined;
        const lowerName = name.toLowerCase();
        let targetName = name;
        if (typeof this.jsValue[name] !== "function") {
            let target = this.jsValue;
            while (target && target !== Object.prototype) {
                for (const prop of Object.getOwnPropertyNames(target)) {
                    if (prop.toLowerCase() === lowerName && typeof target[prop] === "function") {
                        targetName = prop;
                        break;
                    }
                }
                target = Object.getPrototypeOf(target);
            }
        }
        if (typeof this.jsValue[targetName] === "function") {
            const unwrappedArgs = args.map(unwrapPHPValue);
            const res = await Promise.resolve(this.jsValue[targetName].apply(this.jsValue, unwrappedArgs));
            return wrapJSValue(res);
        }
        if (typeof this.jsValue === "function" && lowerName === "__invoke") {
            const unwrappedArgs = args.map(unwrapPHPValue);
            const res = await Promise.resolve(this.jsValue.apply(null, unwrappedArgs));
            return wrapJSValue(res);
        }
        return undefined;
    }
}
export class NodeJSService {
    static require(moduleName) {
        const mod = customRequire(moduleName);
        return wrapJSValue(mod);
    }
    static global(name) {
        const val = globalThis[name];
        return wrapJSValue(val);
    }
    static eval(code) {
        const fn = new Function("require", "process", "global", `return (${code});`);
        const res = fn(customRequire, process, global);
        return wrapJSValue(res);
    }
    static new(classNameOrModule, ...args) {
        const unwrappedArgs = args.map(unwrapPHPValue);
        let targetClass = globalThis[classNameOrModule];
        if (!targetClass) {
            try {
                targetClass = customRequire(classNameOrModule);
            }
            catch {
                targetClass = null;
            }
        }
        if (typeof targetClass === "function") {
            const instance = new targetClass(...unwrappedArgs);
            return wrapJSValue(instance);
        }
        return null;
    }
}
export class NodeJSExtension extends PHPExtension {
    name = "nodejs";
    onInit(engine) {
        this.functions = {
            nodejs_require: (ctx, moduleNameArg) => {
                const moduleName = String(moduleNameArg?.get() ?? "");
                return NodeJSService.require(moduleName);
            },
            nodejs_global: (ctx, nameArg) => {
                const name = String(nameArg?.get() ?? "");
                return NodeJSService.global(name);
            },
            nodejs_eval: (ctx, codeArg) => {
                const code = String(codeArg?.get() ?? "");
                return NodeJSService.eval(code);
            },
            nodejs_new: (ctx, classNameArg, ...args) => {
                const className = String(classNameArg?.get() ?? "");
                return NodeJSService.new(className, ...args);
            },
        };
        this.classes = {
            nodejs: NodeJSService,
        };
    }
}
//# sourceMappingURL=nodejs.js.map