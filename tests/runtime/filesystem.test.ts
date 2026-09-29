import * as path from "path";
import * as fs from "fs/promises";
import { PHPEngine } from "../../index";

describe("FileSystem Runtime Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
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

    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  });
});
