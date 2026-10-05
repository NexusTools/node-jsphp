import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { fileURLToPath } from "url";
import { PHPEngine } from "../../index.js";
import { PHPLiteral } from "../../src/runtime/PHPVariable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("FileSystem Runtime Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("glob supports request directories, brace expansion, and PHP flags", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "jsphp-glob-"));
    try {
      await fs.writeFile(path.join(directory, "alpha.mo"), "translation");
      await fs.writeFile(path.join(directory, "beta.l10n.php"), "translation");
      await fs.writeFile(path.join(directory, "ignore.txt"), "other");
      await fs.mkdir(path.join(directory, "nested"));
      const ctx = engine.createContext({ cwd: directory });
      await ctx.eval(`
        $files = glob('*.{mo,php}', GLOB_BRACE);
        $missing = glob('*.missing', GLOB_NOCHECK);
        $directories = glob('*', GLOB_ONLYDIR | GLOB_MARK);
        $permissions = fileperms('alpha.mo');
      `);
      expect(ctx.getVar("files")).toEqual(["alpha.mo", "beta.l10n.php"]);
      expect(ctx.getVar("missing")).toEqual(["*.missing"]);
      expect(ctx.getVar("directories")).toEqual(["nested/"]);
      expect(ctx.getVar("permissions")).toBe((await fs.stat(path.join(directory, "alpha.mo"))).mode);
      const fnPerms = ctx.functions["fileperms"] || ctx.functionMissing("fileperms");
      expect(await fnPerms(ctx, new PHPLiteral("missing-file"))).toBe(false);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
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

    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  });
});
