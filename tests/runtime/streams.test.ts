import { PHPEngine } from "../../index";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

describe("Streams Runtime Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("stream_context_create, stream_get_wrappers, stream_is_local", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $wrappers = stream_get_wrappers();
      echo in_array('file', $wrappers) ? 'OK;' : 'FAIL;';
      echo stream_is_local('file://test.txt') ? 'LOCAL;' : 'REMOTE;';
    `);
    expect(out).toBe("OK;LOCAL;");
  });

  test("File handles support asynchronous creation, writing, reading, ownership, and closing", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "jsphp-stream-"));
    try {
      const ctx = engine.createContext({ cwd: directory });
      await ctx.eval(`
        $handle = fopen('probe.txt', 'wb');
        $opened = is_resource($handle);
        $written = fwrite($handle, 'contents');
        $closed = fclose($handle);
        $no_longer_resource = !is_resource($handle);
        $handle = fopen('probe.txt', 'rb');
        echo fread($handle, 3) . ';' . stream_get_contents($handle);
        fclose($handle);
        $owner = fileowner('probe.txt');
      `);
      expect(ctx.getVar("opened")).toBe(true);
      expect(ctx.getVar("written")).toBe(8);
      expect(ctx.getVar("closed")).toBe(true);
      expect(ctx.getVar("no_longer_resource")).toBe(true);
      expect(ctx.outputText).toBe("con;tents");
      expect(ctx.getVar("owner")).toBe((await fs.stat(path.join(directory, "probe.txt"))).uid);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
