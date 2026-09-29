"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPEnum = void 0;
class PHPEnum {
    name;
    value;
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
    static cases(enumClass) {
        if (enumClass && enumClass.cases) {
            return enumClass.cases;
        }
        return [];
    }
    static from(enumClass, value) {
        const found = (enumClass.cases || []).find((c) => c.value === value);
        if (!found) {
            throw new Error(`ValueError: ${value} is not a valid backing value for enum ${enumClass.name}`);
        }
        return found;
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