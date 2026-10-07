import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { runPhpToJS } from "../../src/cli/php-to-js.js";
import { PHPEngine } from "../../src/PHPEngine.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe("php-to-js CLI Tool Tests", () => {
    const tmpDir = path.join(__dirname, "tmp_phptojs_test");
    beforeAll(() => {
        fs.mkdirSync(tmpDir, { recursive: true });
    });
    afterAll(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        catch (e) { }
    });
    test("php-to-js transpiles PHP file with explicit output file argument and runs with PHPEngine/PHPContext", async () => {
        const phpFile = path.join(tmpDir, "hello.php");
        const jsFile = path.join(tmpDir, "custom_output.js");
        fs.writeFileSync(phpFile, "<?php $msg = 'Hello from PHP'; echo $msg; ?>", "utf8");
        await runPhpToJS([phpFile, jsFile]);
        expect(fs.existsSync(jsFile)).toBe(true);
        const code = fs.readFileSync(jsFile, "utf8");
        expect(code).toContain("export default async function(ctx)");
        // Execute generated JS module directly by importing it and passing a PHPContext
        const engine = new PHPEngine({ watch: false });
        let output = "";
        const ctx = engine.createContext({
            stdout: (data) => { output += data; },
        });
        const mod = await import("file://" + jsFile.replace(/\\/g, "/") + "?v=" + Date.now());
        const runScript = mod.default || mod;
        await runScript(ctx);
        expect(output).toBe("Hello from PHP");
        await ctx.destroy();
        await engine.close();
    });
    test("php-to-js generated module can accept a PHPEngine instance directly", async () => {
        const phpFile = path.join(tmpDir, "engine_pass.php");
        const jsFile = path.join(tmpDir, "engine_pass.js");
        fs.writeFileSync(phpFile, "<?php echo 'Engine Passed'; ?>", "utf8");
        await runPhpToJS([phpFile, jsFile]);
        const engine = new PHPEngine({ watch: false });
        let output = "";
        const originalCreateContext = engine.createContext.bind(engine);
        engine.createContext = (opts) => originalCreateContext({ ...opts, stdout: (data) => { output += data; } });
        const mod = await import("file://" + jsFile.replace(/\\/g, "/") + "?v=" + Date.now());
        const runScript = mod.default || mod;
        await runScript(engine);
        expect(output).toBe("Engine Passed");
        await engine.close();
    });
    test("php-to-js transpiles PHP file omitting output argument (replaces extension with .js)", async () => {
        const phpFile = path.join(tmpDir, "sample.phtml");
        const expectedJsFile = path.join(tmpDir, "sample.js");
        fs.writeFileSync(phpFile, "<?php $a = 10; $b = 20; echo ($a + $b); ?>", "utf8");
        await runPhpToJS([phpFile]);
        expect(fs.existsSync(expectedJsFile)).toBe(true);
        const code = fs.readFileSync(expectedJsFile, "utf8");
        expect(code).toContain("export default async function(ctx)");
        const engine = new PHPEngine({ watch: false });
        let output = "";
        const ctx = engine.createContext({
            stdout: (data) => { output += data; },
        });
        const mod = await import("file://" + expectedJsFile.replace(/\\/g, "/") + "?v=" + Date.now());
        const runScript = mod.default || mod;
        await runScript(ctx);
        expect(output).toBe("30");
        await ctx.destroy();
        await engine.close();
    });
    test("php-to-js does not run ASTOptimizer on generated code", async () => {
        const phpFile = path.join(tmpDir, "opt_check.php");
        const jsFile = path.join(tmpDir, "opt_check.js");
        fs.writeFileSync(phpFile, "<?php echo strlen('hello'); ?>", "utf8");
        await runPhpToJS([phpFile, jsFile]);
        const code = fs.readFileSync(jsFile, "utf8");
        // Without ASTOptimizer, strlen call is preserved as a function call instead of being folded to 5
        expect(code).toContain("strlen");
    });
});
//# sourceMappingURL=php-to-js.test.js.map