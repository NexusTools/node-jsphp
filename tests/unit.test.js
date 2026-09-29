"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
describe("PHPEngine & AST Unit Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("Evaluates basic string and math expressions", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval("echo 'Hello ' . 'World! ' . (5 + 5);");
        expect(out).toBe("Hello World! 10");
    });
    test("Handles variable assignment and retrieval", async () => {
        const ctx = engine.createContext();
        await ctx.eval("$x = 42; $y = 'PHP';");
        expect(ctx.getVar("x")).toBe(42);
        expect(ctx.getVar("y")).toBe("PHP");
    });
    test("Handles conditional if/else blocks", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $val = 10;
      if ($val > 5) {
        echo 'Greater';
      } else {
        echo 'Lesser';
      }
    `);
        expect(out).toBe("Greater");
    });
    test("Executes while loops", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $i = 0;
      while ($i < 3) {
        echo $i;
        $i++;
      }
    `);
        expect(out).toBe("012");
    });
    test("Executes foreach loops on arrays", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $arr = array("a" => 1, "b" => 2);
      foreach ($arr as $k => $v) {
        echo $k . '=' . $v . ';';
      }
    `);
        expect(out).toBe("a=1;b=2;");
    });
    test("Executes PHP function definition and invocation", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      function add($a, $b = 5) {
        return $a + $b;
      }
      echo add(10) . ';' . add(10, 20);
    `);
        expect(out).toBe("15;30");
    });
    test("Executes PHP class instantiation and method invocation", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      class Greeter {
        public function sayHello($name) {
          return 'Hello ' . $name;
        }
      }
      $g = new Greeter();
      echo $g->sayHello('PHP');
    `);
        expect(out).toBe("Hello PHP");
    });
    test("Optimizes extension_loaded and dead code branches at compile time", async () => {
        const ast = {
            kind: "if",
            test: {
                kind: "call",
                what: { name: "extension_loaded" },
                arguments: [{ kind: "string", value: "mysqli" }],
            },
            body: [{ kind: "echo", arguments: [{ kind: "string", value: "Yes" }] }],
            alternate: [{ kind: "echo", arguments: [{ kind: "string", value: "No" }] }],
        };
        const optimized = index_1.ASTOptimizer.optimize(ast, engine);
        expect(Array.isArray(optimized)).toBe(true);
        expect(optimized[0].kind).toBe("echo");
        expect(optimized[0].arguments[0].value).toBe("Yes");
    });
    test("Optimizes if(false) away completely", async () => {
        const ast = {
            kind: "if",
            test: { kind: "boolean", value: false },
            body: [{ kind: "echo", arguments: [{ kind: "string", value: "Dead code" }] }],
        };
        const optimized = index_1.ASTOptimizer.optimize(ast, engine);
        expect(optimized).toBeNull();
    });
    test("Virtualizes stack traces replacing internal frames", async () => {
        const ctx = engine.createContext();
        try {
            await ctx.eval("throw_non_existent_func();");
        }
        catch (err) {
            expect(err.message).toContain("undefined function");
        }
    });
});
//# sourceMappingURL=unit.test.js.map