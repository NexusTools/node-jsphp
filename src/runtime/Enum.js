import { PHPFatalError } from "./PHPError.js";
import { SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_NEW } from "./Reflection.js";
export class EnumRuntime {
    static register(engine) {
        engine.registerClass("enum", PHPEnum);
    }
}
export class PHPEnum {
    name;
    value;
    static async [SYMBOL_PHP_NEW](ctx, nameArg, valueArg) {
        const obj = Object.create(this.prototype);
        await obj.__construct(ctx, nameArg, valueArg);
        return obj;
    }
    async __construct(ctx, nameArg, valueArg) {
        this.name = nameArg ? String(await nameArg.get() ?? "") : "";
        this.value = valueArg ? await valueArg.get() : undefined;
    }
    static from(enumClass, value) {
        const constants = enumClass[SYMBOL_PHP_CONSTANTS] || enumClass.constants || {};
        const cases = Object.entries(constants);
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