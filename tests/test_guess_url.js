const path = require("path");
const { PHPEngine } = require("../index");

async function test() {
  const engine = new PHPEngine({ watch: false });
  const wpDir = "C:\\Users\\ktaey\\Downloads\\wordpress";

  const ctx = engine.createContext({
    cwd: wpDir,
    stdout: (data) => console.log("[PHP STDOUT]:", data),
    stderr: (data) => console.error("[PHP STDERR]:", data),
    superglobals: {
      server: {
        REQUEST_METHOD: "GET",
        REQUEST_URI: "/index.php",
        DOCUMENT_ROOT: wpDir,
        SCRIPT_FILENAME: path.join(wpDir, "index.php"),
        HTTP_HOST: "127.0.0.1:8080",
        SERVER_NAME: "127.0.0.1",
        SERVER_PORT: "8080",
      },
    },
  });

  try {
    await ctx.require(path.join(wpDir, "wp-includes/load.php"));
    await ctx.require(path.join(wpDir, "wp-includes/functions.php"));
    console.log("Calling wp_guess_url()...");
    const url = await ctx.callFunction("wp_guess_url", []);
    console.log("wp_guess_url() RESULT:", url);
  } catch (err) {
    console.error("CATCH:", err.stack || err);
  }

  engine.close();
}

test().catch(console.error);
