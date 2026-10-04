import { PHPEngine, NodeJSExtension } from "../../index.js";
describe("Node.js Extension Interop Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new PHPEngine({
            watch: false,
            extensions: [new NodeJSExtension()],
        });
    });
    afterEach(() => {
        engine.close();
    });
    test("Requires built-in Node.js module 'path' and calls method", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $path = nodejs_require("path");
      echo $path->basename("usr/local/bin/file.txt") . ";";
    `);
        expect(out).toBe("file.txt;");
    });
    test("Accesses Node.js process global variable", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $process = nodejs_global("process");
      echo $process->arch . ";";
    `);
        expect(out).toBe(`${process.arch};`);
    });
    test("Evaluates JavaScript expression via nodejs_eval", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $res = nodejs_eval("100 + 200");
      echo $res . ";";
    `);
        expect(out).toBe("300;");
    });
    test("Requires 'fs' module and checks directory existence", async () => {
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $fs = nodejs_require("fs");
      echo $fs->existsSync(__DIR__) ? "EXISTS;" : "NO;";
    `);
        expect(out).toBe("EXISTS;");
    });
});
//# sourceMappingURL=nodejs.test.js.map