import { PHPClass, PHPObject } from "./PHPObject.js";
import { PHPFatalError } from "./PHPError.js";
import { SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_NEW } from "./Reflection.js";
import type { PHPEngine } from "../PHPEngine.js";

export class EnumRuntime {
  public static register(engine: PHPEngine): void {
    engine.registerClass("enum", PHPEnum);
  }
}

export class PHPEnum {
  public name!: string;
  public value?: any;

  public static async [SYMBOL_PHP_NEW](ctx: any, nameArg?: any, valueArg?: any): Promise<PHPEnum> {
    const obj = Object.create(this.prototype);
    await obj.__construct(ctx, nameArg, valueArg);
    return obj;
  }

  public async __construct(ctx: any, nameArg?: any, valueArg?: any): Promise<void> {
    this.name = nameArg ? String(await nameArg.get() ?? "") : "";
    this.value = valueArg ? await valueArg.get() : undefined;
  }

  public static from(enumClass: any, value: any): PHPEnum {
    const constants = enumClass[SYMBOL_PHP_CONSTANTS] || enumClass.constants || {};
    const cases = Object.entries(constants) as [string, any][];
    for (const [caseName, entry] of cases) {
      const caseVal = entry && typeof entry === "object" && Object.hasOwn(entry, "value") ? entry.value : entry;
      if (caseVal === value) {
        const obj = Object.create(PHPEnum.prototype);
        obj.name = entry && typeof entry === "object" && typeof entry.name === "string" ? entry.name : caseName;
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
