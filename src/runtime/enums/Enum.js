"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPEnum = void 0;
const PHPObject_1 = require("../objects/PHPObject");
const PHPError_1 = require("../errors/PHPError");
class PHPEnum extends PHPObject_1.PHPObject {
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
        throw new PHPError_1.PHPFatalError(`ValueError: ${value} is not a valid backing value for enum ${enumClass.name}`);
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
exports.PHPEnum = PHPEnum;
//# sourceMappingURL=Enum.js.map