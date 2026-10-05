import { PHPFatalError } from "./PHPError.js";
export class EnumRuntime {
    static register(engine) {
        engine.registerClass("enum", PHPEnum);
    }
}
export class PHPEnum {
    name;
    value;
    static async __$$__new(ctx, nameArg, valueArg) {
        const obj = Object.create(this.prototype);
        if (typeof obj.__construct === "function")
            await obj.__construct(ctx, nameArg, valueArg);
        return obj;
    }
    async __construct(ctx, nameArg, valueArg) {
        this.name = nameArg ? String(nameArg.get() ?? "") : "";
        this.value = valueArg ? valueArg.get() : undefined;
    }
    static from(enumClass, value) {
        const map = enumClass.__php_constants || enumClass.constants || new Map();
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