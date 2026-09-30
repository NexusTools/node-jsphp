const path = require("path");
const { PHPEngine } = require("../index");

async function test() {
  const engine = new PHPEngine({ watch: false });
  const wpDir = "C:\\Users\\ktaey\\Downloads\\wordpress";

  console.log("Creating context...");
  let output = "";
  const ctx = engine.createContext({
    cwd: wpDir,
    stdout: (data) => { console.log("[PHP STDOUT]:", data); output += data; },
    stderr: (data) => console.error("[PHP STDERR]:", data),
    superglobals: {
      server: {
        REQUEST_METHOD: "GET",
        REQUEST_URI: "/index.php",
        DOCUMENT_ROOT: wpDir,
        SCRIPT_FILENAME: path.join(wpDir, "index.php"),
      },
    },
  });

  ctx.setInternalVar("hasServerResponseHandler", true);

  console.log("Requiring index.php...");
  try {
    await ctx.require(path.join(wpDir, "index.php"));
    console.log("FINISHED!");
    console.log("Status Code:", ctx.response.statusCode);
    console.log("Response Headers:", ctx.response.headers);
  } catch (err) {
    console.error("CATCH:", err);
  }

  engine.close();
}

test().catch(console.error);
