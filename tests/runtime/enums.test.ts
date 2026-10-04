import { PHPEngine } from "../../index.js";

describe("Enums Runtime Tests", () => {
  let engine: PHPEngine;

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
