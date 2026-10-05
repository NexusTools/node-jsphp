import { PHPClass, PHPObject } from "./PHPObject.js";
import { PHPFatalError } from "./PHPError.js";
import type { PHPEngine } from "../PHPEngine.js";

export class EnumRuntime {
  public static register(engine: PHPEngine): void {
    engine.registerClass("enum", PHPEnum);
  }
}

export class PHPEnum {
  public name!: string;
  public value?: any;

  public static async __$$__new(ctx: any, nameArg?: any, valueArg?: any): Promise<PHPEnum> {
    const obj = Object.create(this.prototype);
    if (typeof obj.__construct === "function") await obj.__construct(ctx, nameArg, valueArg);
    return obj;
  }

  public async __construct(ctx: any, nameArg?: any, valueArg?: any): Promise<void> {
    this.name = nameArg ? String(nameArg.get() ?? "") : "";
    this.value = valueArg ? valueArg.get() : undefined;
  }

  public static from(enumClass: any, value: any): PHPEnum {
    const map = (enumClass as any).__php_constants || enumClass.constants || new Map();
    const cases = Array.from((map instanceof Map ? map : new Map(Object.entries(map))).entries());
    for (const [caseName, caseVal] of cases) {
      if (caseVal === value) {
        const obj = Object.create(PHPEnum.prototype);
        obj.name = caseName;
        obj.value = caseVal;
        return obj;
      }
    }
    throw new PHPFatalError(`ValueError: ${value} is not a valid backing value for enum ${enumClass.name}`);
  }

  public static tryFrom(enumClass: any, value: any): PHPEnum | null {
    try {
      return PHPEnum.from(enumClass, value);
    } catch {
      return null;
    }
  }
}
