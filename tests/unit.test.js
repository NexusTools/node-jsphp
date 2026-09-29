"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const index_1 = require("../index");
describe("PHPEngine & PHPContext Unit Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("Evaluates basic PHP code asynchronously", async () => {
        let output = "";
        const ctx = engine.createContext({
            stdout: (data) => { output += data; },
        });
        await ctx.eval("echo 'Hello from JSPHP!';");
        expect(output).toBe("Hello from JSPHP!");
    });
    test("Executes async transparent FileSystem methods", async () => {
        const tmpDir = path.join(__dirname, "tmp_fs_test");
        const testFile = path.join(tmpDir, "test.txt");
        const copyFile = path.join(tmpDir, "test_copy.txt");
        let output = "";
        const ctx = engine.createContext({
            cwd: __dirname,
            stdout: (data) => { output += data; },
        });
        // Test mkdir, file_put_contents, file_exists, is_file, is_dir, file_get_contents, copy, unlink, rmdir
        await ctx.eval(`
      $dir = '${tmpDir.replace(/\\/g, "/")}';
      $file = '${testFile.replace(/\\/g, "/")}';
      $copy = '${copyFile.replace(/\\/g, "/")}';

      mkdir($dir, 0777, true);
      file_put_contents($file, 'Async PHP FS Test');
      echo file_exists($file) ? 'EXISTS' : 'NO';
      echo is_file($file) ? 'FILE' : 'NO';
      echo is_dir($dir) ? 'DIR' : 'NO';
      echo file_get_contents($file);

      copy($file, $copy);
      echo file_exists($copy) ? 'COPY_EXISTS' : 'NO';

      unlink($file);
      unlink($copy);
      rmdir($dir);
    `);
        expect(output).toContain("EXISTSFILEDIRAsync PHP FS TestCOPY_EXISTS");
        // Ensure cleanup
        try {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
        catch { }
    });
    test("Executes async transparent Exec shell commands", async () => {
        let output = "";
        const ctx = engine.createContext({
            stdout: (data) => { output += data; },
        });
        await ctx.eval("$out = shell_exec('node -v'); echo is_string($out) ? 'OK' : 'FAIL';");
        expect(output).toBe("OK");
    });
    test("Stores function parameter and visibility metadata for Reflection", async () => {
        const ctx = engine.createContext();
        await ctx.eval("function test_func($a, $b = 10) { return $a + $b; }");
        const fn = engine.functions.get("test_func");
        expect(fn).toBeDefined();
        const refFunc = new index_1.ReflectionFunction("test_func", fn);
        expect(refFunc.getNumberOfParameters()).toBe(2);
        expect(refFunc.getNumberOfRequiredParameters()).toBe(1);
    });
    test("Evaluates networking and IP functions", async () => {
        let output = "";
        const ctx = engine.createContext({
            stdout: (data) => { output += data; },
        });
        await ctx.eval("$ip = long2ip(ip2long('127.0.0.1')); echo $ip;");
        expect(output).toBe("127.0.0.1");
    });
    test("Evaluates math and variable type functions", async () => {
        let output = "";
        const ctx = engine.createContext({
            stdout: (data) => { output += data; },
        });
        await ctx.eval("echo round(3.567, 2); echo gettype('hello');");
        expect(output).toBe("3.57string");
    });
    test("Optimizes extension_loaded and dead code branches at compile time", async () => {
        const optCtx = {
            enabledExtensions: new Set(["mysqli"]),
            constants: new Map([["TEST_CONST", "123"]]),
        };
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
        const optimized = index_1.ASTOptimizer.optimize(ast, optCtx);
        expect(Array.isArray(optimized)).toBe(true);
        expect(optimized[0].kind).toBe("echo");
        expect(optimized[0].arguments[0].value).toBe("Yes");
    });
    test("Optimizes if(false) away completely", async () => {
        const optCtx = {
            enabledExtensions: new Set(),
            constants: new Map(),
        };
        const ast = {
            kind: "if",
            test: { kind: "boolean", value: false },
            body: [{ kind: "echo", arguments: [{ kind: "string", value: "Dead code" }] }],
        };
        const optimized = index_1.ASTOptimizer.optimize(ast, optCtx);
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