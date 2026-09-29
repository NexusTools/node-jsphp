export interface UnitEnum {
  name: string;
}

export interface BackedEnum extends UnitEnum {
  value: string | number;
}

export class PHPEnum implements BackedEnum {
  public name: string;
  public value: string | number;

  constructor(name: string, value: string | number) {
    this.name = name;
    this.value = value;
  }

  public static cases(enumClass: any): UnitEnum[] {
    if (enumClass && enumClass.cases) {
      return enumClass.cases;
    }
    return [];
  }

  public static from(enumClass: any, value: string | number): BackedEnum {
    const found = (enumClass.cases || []).find((c: BackedEnum) => c.value === value);
    if (!found) {
      throw new Error(`ValueError: ${value} is not a valid backing value for enum ${enumClass.name}`);
    }
    return found;
  }

  public static tryFrom(enumClass: any, value: string | number): BackedEnum | null {
    try {
      return PHPEnum.from(enumClass, value);
    } catch {
      return null;
    }
  }
}
