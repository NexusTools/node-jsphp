import { createRequire } from "module";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NEW } from "../runtime/Reflection.js";

export const SYMBOL_PHP_NODEJS_PROXY = Symbol.for("php.nodejsProxy");
export const SYMBOL_PHP_NODEJS_VALUE = Symbol.for("php.nodejsValue");

const customRequire = createRequire(import.meta.url);

export function wrapJSValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === "boolean" || typeof val === "number" || typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val.map(wrapJSValue);
  }
  if (typeof val !== "object" && typeof val !== "function") {
    return val;
  }
  if (val[SYMBOL_PHP_NODEJS_PROXY]) {
    return val[SYMBOL_PHP_NODEJS_PROXY];
  }

  const proxy = new Proxy(val, {
    get(target, prop, receiver) {
      if (prop === SYMBOL_PHP_NODEJS_PROXY || prop === SYMBOL_PHP_NODEJS_VALUE) {
        return target;
      }
      if (prop === SYMBOL_PHP_NEW) {
        return async (ctx: PHPContext, ...args: PHPReference[]) => {
          const unwrappedArgs = await Promise.all(args.map(unwrapPHPValue));
          if (typeof target === "function") {
            try {
              const instance = new (target as any)(...unwrappedArgs);
              return wrapJSValue(instance);
            } catch {
              const instance = (target as any)(...unwrappedArgs);
              return wrapJSValue(instance);
            }
          }
          return null;
        };
      }
      if (
        prop === "get" ||
        prop === "set" ||
        prop === "then" ||
        prop === "catch" ||
        prop === "finally" ||
        typeof prop === "symbol"
      ) {
        return target[prop];
      }

      const propStr = typeof prop === "string" ? (prop.startsWith("$") ? prop.slice(1) : prop) : String(prop);
      const lowerProp = propStr.toLowerCase();

      let targetName = propStr;
      if (target && (typeof target === "object" || typeof target === "function")) {
        if (!(propStr in target)) {
          let curr = target;
          while (curr && curr !== Object.prototype) {
            for (const p of Object.getOwnPropertyNames(curr)) {
              if (p.toLowerCase() === lowerProp) {
                targetName = p;
                break;
              }
            }
            curr = Object.getPrototypeOf(curr);
          }
        }
      }

      const item = target[targetName];
      if (typeof item === "function") {
        const boundFn = item.bind(target);
        return async (ctx: PHPContext, ...args: PHPReference[]) => {
          const unwrappedArgs = await Promise.all(args.map(unwrapPHPValue));
          const res = await Promise.resolve(boundFn(...unwrappedArgs));
          return wrapJSValue(res);
        };
      }
      return wrapJSValue(item);
    },

    set(target, prop, value, receiver) {
      const propStr = typeof prop === "string" ? (prop.startsWith("$") ? prop.slice(1) : prop) : String(prop);
      const lowerProp = propStr.toLowerCase();
      let targetName = propStr;
      if (target && (typeof target === "object" || typeof target === "function")) {
        if (!(propStr in target)) {
          let curr = target;
          while (curr && curr !== Object.prototype) {
            for (const p of Object.getOwnPropertyNames(curr)) {
              if (p.toLowerCase() === lowerProp) {
                targetName = p;
                break;
              }
            }
            curr = Object.getPrototypeOf(curr);
          }
        }
      }
      target[targetName] = value;
      return true;
    },

    async apply(target, thisArg, argArray) {
      if (typeof target === "function") {
        const unwrappedArgs = await Promise.all((argArray || []).slice(1).map(unwrapPHPValue));
        const res = await target.apply(thisArg, unwrappedArgs);
        return wrapJSValue(res);
      }
      return undefined;
    }
  });

  try {
    Object.defineProperty(val, SYMBOL_PHP_NODEJS_PROXY, {
      value: proxy,
      writable: false,
      configurable: true,
      enumerable: false,
    });
  } catch {}

  return proxy;
}

export async function unwrapPHPValue(val: any): Promise<any> {
  if (val === null || val === undefined) return val;
  const actual = val instanceof PHPReference ? await val.get() : val;
  if (actual && (typeof actual === "object" || typeof actual === "function") && actual[SYMBOL_PHP_NODEJS_PROXY]) {
    return actual[SYMBOL_PHP_NODEJS_PROXY];
  }
  if (actual && (typeof actual === "object" || typeof actual === "function") && actual[SYMBOL_PHP_NODEJS_VALUE]) {
    return actual[SYMBOL_PHP_NODEJS_VALUE];
  }
  if (Array.isArray(actual)) {
    return await Promise.all(actual.map(unwrapPHPValue));
  }
  return actual;
}

export class NodeJSExtension extends PHPExtension {
  public readonly name = "nodejs";

  public onInit(engine: PHPEngine): void {
    const njs_import = async (ctx: PHPContext, moduleNameArg?: PHPReference) => {
      const moduleName = String(await moduleNameArg?.get() ?? "");
      try {
        const mod = customRequire(moduleName);
        return wrapJSValue(mod);
      } catch {
        return null;
      }
    };

    const njs_global = async (ctx: PHPContext, nameArg?: PHPReference) => {
      const name = String(await nameArg?.get() ?? "");
      const val = (globalThis as any)[name];
      return wrapJSValue(val);
    };

    const njs_eval = async (ctx: PHPContext, codeArg?: PHPReference) => {
      const code = String(await codeArg?.get() ?? "");
      const fn = new Function("process", "global", `return (async () => { return (${code}); })();`);
      const res = await fn(process, globalThis);
      return wrapJSValue(res);
    };

    const njs_new = async (ctx: PHPContext, classNameArg?: PHPReference, ...args: PHPReference[]) => {
      const className = String(await classNameArg?.get() ?? "");
      const unwrappedArgs = await Promise.all(args.map(unwrapPHPValue));
      let targetClass: any = (globalThis as any)[className];
      if (!targetClass) {
        try {
          targetClass = customRequire(className);
        } catch {
          targetClass = null;
        }
      }
      if (typeof targetClass === "function") {
        const instance = new targetClass(...unwrappedArgs);
        return wrapJSValue(instance);
      }
      return null;
    };

    this.functions = {
      njs_import,
      njs_global,
      njs_eval,
      njs_new,
      nodejs_require: njs_import,
      nodejs_global: njs_global,
      nodejs_eval: njs_eval,
      nodejs_new: njs_new,
    };
  }
}
