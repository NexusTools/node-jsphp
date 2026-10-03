import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";
import { PHPObject, PHPClass } from "../runtime/PHPObject";
import { PHPVariable, PHPReference } from "../runtime/PHPVariable";

export function wrapJSValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === "boolean" || typeof val === "number" || typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val.map(wrapJSValue);
  }
  return new NodeJSObject(val);
}

export function unwrapPHPValue(val: any): any {
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
  public jsValue: any;

  constructor(jsValue: any) {
    const clsName = typeof jsValue === "function" ? (jsValue.name || "NodeJSFunction") : "NodeJSObject";
    super(new PHPClass(clsName));
    this.jsValue = jsValue;
  }

  public async getProperty(ctx: PHPContext, name: string): Promise<any> {
    if (!this.jsValue || (typeof this.jsValue !== "object" && typeof this.jsValue !== "function")) return undefined;
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

  public async setProperty(ctx: PHPContext, name: string, value: any): Promise<void> {
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

  public async callMethod(ctx: PHPContext, name: string, args: any[] = []): Promise<any> {
    if (!this.jsValue) return undefined;
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
  public static require(moduleName: string): any {
    const mod = require(moduleName);
    return wrapJSValue(mod);
  }

  public static global(name: string): any {
    const val = (globalThis as any)[name];
    return wrapJSValue(val);
  }

  public static eval(code: string): any {
    const fn = new Function("require", "process", "global", `return (${code});`);
    const res = fn(require, process, global);
    return wrapJSValue(res);
  }

  public static new(classNameOrModule: string, ...args: any[]): any {
    const unwrappedArgs = args.map(unwrapPHPValue);
    let targetClass: any = (globalThis as any)[classNameOrModule];
    if (!targetClass) {
      try {
        targetClass = require(classNameOrModule);
      } catch {
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
  public readonly name = "nodejs";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      nodejs_require: (ctx: PHPContext, moduleNameArg?: PHPReference) => {
        const moduleName = String(moduleNameArg?.get() ?? "");
        return NodeJSService.require(moduleName);
      },
      nodejs_global: (ctx: PHPContext, nameArg?: PHPReference) => {
        const name = String(nameArg?.get() ?? "");
        return NodeJSService.global(name);
      },
      nodejs_eval: (ctx: PHPContext, codeArg?: PHPReference) => {
        const code = String(codeArg?.get() ?? "");
        return NodeJSService.eval(code);
      },
      nodejs_new: (ctx: PHPContext, classNameArg?: PHPReference, ...args: PHPReference[]) => {
        const className = String(classNameArg?.get() ?? "");
        return NodeJSService.new(className, ...args);
      },
    };

    this.classes = {
      nodejs: NodeJSService,
    };
  }
}
