import { PHPEngine, ReflectionClass, ReflectionFunction } from "../../index.js";
import { PHPLiteral } from "../../src/runtime/PHPVariable.js";
describe("Reflection Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("ReflectionFunction and ReflectionClass metadata queries", async () => {
        const ctx = engine.createContext();
        await ctx.eval("function my_fn($a, $b = 'default') { return $a; }");
        const fn = ctx.functions["my_fn"] || engine.functions["my_fn"];
        expect(fn).toBeDefined();
        const refFn = await ReflectionFunction.__$$__new(ctx, new PHPLiteral("my_fn"), new PHPLiteral(fn));
        expect(refFn.getName(ctx)).toBe("my_fn");
        expect(refFn.getNumberOfParameters(ctx)).toBe(2);
        expect(refFuncRequired(ctx, refFn)).toBe(1);
        const refCls = await ReflectionClass.__$$__new(ctx, new PHPLiteral("ReflectionClass"));
        expect(refCls.getName(ctx)).toBe("ReflectionClass");
        expect(refCls.isInstantiable(ctx)).toBe(true);
    });
    test("ReflectionFunction fallback parsing for raw JavaScript function without .phpMeta", async () => {
        const ctx = engine.createContext();
        function rawJsFunction(ctx, paramOne, paramTwo = "hello", paramThree = 42) {
            return paramOne;
        }
        const refFn = await ReflectionFunction.__$$__new(ctx, new PHPLiteral("rawJsFunction"), new PHPLiteral(rawJsFunction));
        expect(refFn.getName(ctx)).toBe("rawJsFunction");
        expect(refFn.getNumberOfParameters(ctx)).toBe(3);
        expect(refFn.getNumberOfRequiredParameters(ctx)).toBe(1);
        const params = await refFn.getParameters(ctx);
        expect(params.length).toBe(3);
        expect(params[0].getName(ctx)).toBe("paramOne");
        expect(params[0].isOptional(ctx)).toBe(false);
        expect(params[1].getName(ctx)).toBe("paramTwo");
        expect(params[1].isOptional(ctx)).toBe(true);
        expect(params[1].getDefaultValue(ctx)).toBe("hello");
        expect(params[2].getName(ctx)).toBe("paramThree");
        expect(params[2].isOptional(ctx)).toBe(true);
        expect(params[2].getDefaultValue(ctx)).toBe(42);
    });
});
function refFuncRequired(ctx, refFn) {
    return refFn.getNumberOfRequiredParameters(ctx);
}
//# sourceMappingURL=reflection.test.js.map