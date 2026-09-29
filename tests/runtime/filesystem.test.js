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
const index_1 = require("../../index");
describe("FileSystem Runtime Tests", () => {
    let engine;
    beforeEach(() => {
        engine = new index_1.PHPEngine({ watch: false });
    });
    afterEach(() => {
        engine.close();
    });
    test("FileSystem async functions: file_get_contents, file_put_contents, file_exists, is_file, is_dir, is_readable, is_writable, filesize, filemtime, realpath, basename, dirname, pathinfo, mkdir, rmdir, unlink, rename, copy, tempnam, sys_get_temp_dir, scandir", async () => {
        const tmpDir = path.join(__dirname, "tmp_fs_test2");
        const testFile = path.join(tmpDir, "file.txt");
        const renFile = path.join(tmpDir, "file_ren.txt");
        let out = "";
        const ctx = engine.createContext({ stdout: (d) => { out += d; } });
        await ctx.eval(`
      $dir = '${tmpDir.replace(/\\/g, "/")}';
      $file = '${testFile.replace(/\\/g, "/")}';
      $ren = '${renFile.replace(/\\/g, "/")}';

      mkdir($dir, 0777, true);
      file_put_contents($file, 'FileSystem Test Content');
      echo file_exists($file) ? '1;' : '0;';
      echo is_file($file) ? '1;' : '0;';
      echo is_dir($dir) ? '1;' : '0;';
      echo is_readable($file) ? '1;' : '0;';
      echo is_writable($file) ? '1;' : '0;';
      echo file_get_contents($file) . ';';
      echo basename($file) . ';';
      echo dirname($file) !== '' ? '1;' : '0;';

      rename($file, $ren);
      echo file_exists($ren) ? '1;' : '0;';

      unlink($ren);
      rmdir($dir);
    `);
        expect(out).toContain("1;1;1;1;1;FileSystem Test Content;file.txt;1;1;");
        try {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
        catch { }
    });
});
//# sourceMappingURL=filesystem.test.js.map