import { PHPEngine } from "../../index.js";
describe("Enums Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("Enum class registration", async () => {
        expect("enum" in engine.classes).toBe(true);
    });
});
//# sourceMappingURL=enums.test.js.map