"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
describe("Enums Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("Enum class registration", async () => {
        expect("enum" in engine.classes).toBe(true);
    });
});
//# sourceMappingURL=enums.test.js.map