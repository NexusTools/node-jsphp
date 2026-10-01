import { PHPClass, PHPObject } from "./PHPObject";
import { PHPFatalError } from "./PHPError";
import type { PHPEngine } from "../PHPEngine";

export class EnumRuntime {
  public static register(engine: PHPEngine): void {
    engine.registerClass("enum", PHPEnum);
  }
}

export class PHPEnum extends PHPObject {
  public readonly name: string;
  public readonly value?: any;

  constructor(enumClass: PHPClass, name: string, value?: any) {
    super(enumClass);
    this.name = name;
    this.value = value;
  }

  public static from(enumClass: PHPClass, value: any): PHPEnum {
    const cases = Array.from(enumClass.constants.entries());
    for (const [caseName, caseVal] of cases) {
      if (caseVal === value) {
        return new PHPEnum(enumClass, caseName, caseVal);
      }
    }
    throw new PHPFatalError(`ValueError: ${value} is not a valid backing value for enum ${enumClass.name}`);
  }

  public static tryFrom(enumClass: PHPClass, value: any): PHPEnum | null {
    try {
      return PHPEnum.from(enumClass, value);
    } catch {
      return null;
    }
  }
}
