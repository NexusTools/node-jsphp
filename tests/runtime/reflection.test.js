"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Reflection Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("ReflectionFunction and ReflectionClass metadata queries", async () => {
        const ctx = engine.createContext();
        await ctx.eval("function my_fn($a, $b = 'default') { return $a; }");
        const fn = engine.functions.get("my_fn");
        expect(fn).toBeDefined();
        const refFn = new index_1.ReflectionFunction("my_fn", fn);
        expect(refFn.getName()).toBe("my_fn");
        expect(refFn.getNumberOfParameters()).toBe(2);
        expect(refFuncRequired(refFn)).toBe(1);
        const refCls = new index_1.ReflectionClass("ReflectionClass");
        expect(refCls.getName()).toBe("ReflectionClass");
        expect(refCls.isInstantiable()).toBe(true);
    });
    test("ReflectionFunction fallback parsing for raw JavaScript function without .phpMeta", () => {
        function rawJsFunction(ctx, paramOne, paramTwo = "hello", paramThree = 42) {
            return paramOne;
        }
        const refFn = new index_1.ReflectionFunction("rawJsFunction", rawJsFunction);
        expect(refFn.getName()).toBe("rawJsFunction");
        expect(refFn.getNumberOfParameters()).toBe(3);
        expect(refFn.getNumberOfRequiredParameters()).toBe(1);
        const params = refFn.getParameters();
        expect(params.length).toBe(3);
        expect(params[0].getName()).toBe("paramOne");
        expect(params[0].isOptional()).toBe(false);
        expect(params[1].getName()).toBe("paramTwo");
        expect(params[1].isOptional()).toBe(true);
        expect(params[1].getDefaultValue()).toBe("hello");
        expect(params[2].getName()).toBe("paramThree");
        expect(params[2].isOptional()).toBe(true);
        expect(params[2].getDefaultValue()).toBe(42);
    });
});
function refFuncRequired(refFn) {
    return refFn.getNumberOfRequiredParameters();
}
//# sourceMappingURL=reflection.test.js.map