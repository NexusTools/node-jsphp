import { PHPObject } from "./PHPObject.js";
import { PHPFatalError } from "./PHPError.js";
export class EnumRuntime {
    static register(engine) {
        engine.registerClass("enum", PHPEnum);
    }
}
export class PHPEnum extends PHPObject {
    name;
    value;
    constructor(enumClass, name, value) {
        super(enumClass);
        this.name = name;
        this.value = value;
    }
    static from(enumClass, value) {
        const cases = Array.from(enumClass.constants.entries());
        for (const [caseName, caseVal] of cases) {
            if (caseVal === value) {
                return new PHPEnum(enumClass, caseName, caseVal);
            }
        }
        throw new PHPFatalError(`ValueError: ${value} is not a valid backing value for enum ${enumClass.name}`);
    }
    static tryFrom(enumClass, value) {
        try {
            return PHPEnum.from(enumClass, value);
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=Enum.js.map