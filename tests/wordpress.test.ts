import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import AdmZip from "adm-zip";
import mysql2 from "mysql2/promise";
import { PHPEngine, PHPContext } from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD || "DNESB*GJ*W(E$GYB$UW#gt78wg";
const MYSQL_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const TEST_DB_NAME = "wp_jsphp_test";
const TEST_USER = "wp_jsphp_user";
const TEST_PASS = "wp_jsphp_pass";

function forceRmSync(dir: string) {
  if (!fs.existsSync(dir)) return;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      try { fs.chmodSync(full, 0o666); } catch (e) {}
      if (entry.isDirectory()) {
        forceRmSync(full);
      } else {
        try { fs.unlinkSync(full); } catch (e) {}
      }
    }
    try { fs.rmdirSync(dir); } catch (e) {}
  } catch (e) {}
}

function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  const stats = exists ? fs.statSync(src) : null;
  const isDirectory = Boolean(stats && stats.isDirectory());
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const childItemName of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    }
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

describe("Complete WordPress End-to-End Installation & Control Panel Test", () => {
  let engine: PHPEngine;
  const wpDir = path.join(__dirname, "../wordpress-test");
  const wpZipPath = path.join(__dirname, "latest.zip");
  let parsedCookies: Record<string, string> = {};

  beforeAll(async () => {
    engine = new PHPEngine({ cacheDir: null, watch: false });

    console.log("Setting up MySQL database...");
    const possibleHosts = [MYSQL_HOST, "127.0.0.1", "localhost"];
    const possiblePasses = Array.from(new Set([process.env.MYSQL_ROOT_PASSWORD, "", "root", "DNESB*GJ*W(E$GYB$UW#gt78wg"].filter((x): x is string => typeof x === "string")));
    let conn: any;
    let rootPassUsed = "";
    for (const h of possibleHosts) {
      for (const p of possiblePasses) {
        try {
          conn = await mysql2.createConnection({ host: h, user: "root", password: p, port: MYSQL_PORT });
          console.log(`MYSQL ROOT SUCCESS: host=${h}, pass=${JSON.stringify(p)}`);
          rootPassUsed = p;
          break;
        } catch (e: any) {
          console.log(`MYSQL ROOT FAILED host=${h} pass=${JSON.stringify(p)}:`, e.message);
        }
      }
      if (conn) break;
    }

    if (conn) {
      await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\`;`);
      await conn.query(`CREATE DATABASE \`${TEST_DB_NAME}\`;`);
      try { await conn.query(`DROP USER IF EXISTS '${TEST_USER}'@'%';`); } catch (e) {}
      try { await conn.query(`DROP USER IF EXISTS '${TEST_USER}'@'localhost';`); } catch (e) {}
      try { await conn.query(`DROP USER IF EXISTS '${TEST_USER}'@'127.0.0.1';`); } catch (e) {}
      try { await conn.query(`CREATE USER '${TEST_USER}'@'%' IDENTIFIED BY '${TEST_PASS}';`); } catch (e) {}
      try { await conn.query(`CREATE USER '${TEST_USER}'@'localhost' IDENTIFIED BY '${TEST_PASS}';`); } catch (e) {}
      try { await conn.query(`CREATE USER '${TEST_USER}'@'127.0.0.1' IDENTIFIED BY '${TEST_PASS}';`); } catch (e) {}
      try { await conn.query(`GRANT ALL PRIVILEGES ON \`${TEST_DB_NAME}\`.* TO '${TEST_USER}'@'%';`); } catch (e) {}
      try { await conn.query(`GRANT ALL PRIVILEGES ON \`${TEST_DB_NAME}\`.* TO '${TEST_USER}'@'localhost';`); } catch (e) {}
      try { await conn.query(`GRANT ALL PRIVILEGES ON \`${TEST_DB_NAME}\`.* TO '${TEST_USER}'@'127.0.0.1';`); } catch (e) {}
      await conn.query("FLUSH PRIVILEGES;");
      await conn.end();
      console.log(`MySQL setup complete using root password: ${JSON.stringify(rootPassUsed)}`);
    } else {
      console.error("CRITICAL: MySQL root connection failed for all attempted passwords!");
    }

    if (!fs.existsSync(wpZipPath)) {
      console.log("Downloading latest WordPress zip...");
      const res = await fetch("https://wordpress.org/latest.zip");
      if (!res.ok) {
        throw new Error(`Failed to download WordPress zip: ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(wpZipPath, Buffer.from(arrayBuffer));
      console.log("WordPress zip downloaded successfully.");
    }

    const translationsFile = path.join(wpDir, "wp-includes", "pomo", "translations.php");
    if (!fs.existsSync(translationsFile)) {
      console.log("Extracting WordPress archive...");
      forceRmSync(wpDir);
      fs.mkdirSync(wpDir, { recursive: true });

      const tmpDir = path.join(__dirname, "../wp_temp_extract");
      forceRmSync(tmpDir);
      fs.mkdirSync(tmpDir, { recursive: true });

      const zip = new AdmZip(wpZipPath);
      zip.extractAllTo(tmpDir, true);

      const subFolder = path.join(tmpDir, "wordpress");
      copyRecursiveSync(subFolder, wpDir);
      forceRmSync(tmpDir);
      console.log("WordPress extracted successfully to:", wpDir);
    }

    const wpConfigPath = path.join(wpDir, "wp-config.php");
    if (fs.existsSync(wpConfigPath)) {
      fs.unlinkSync(wpConfigPath);
    }
  }, 180000);

  afterAll(async () => {
    if (engine) {
      try {
        const cleanupCtx = engine.createContext();
        await cleanupCtx.eval(`
          $conn = mysqli_connect('${MYSQL_HOST}', 'root', '${MYSQL_ROOT_PASSWORD}', '', ${MYSQL_PORT});
          if ($conn) {
            mysqli_query($conn, "DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\`;");
            mysqli_query($conn, "DROP USER IF EXISTS '${TEST_USER}'@'%';");
            mysqli_close($conn);
          }
        `);
        console.log("Cleaned up MySQL test database and user via PHP.");
      } catch (e) {
      }
      engine.close();
    }
  });

  test("Step 1: Renders Setup Config (setup-config.php?step=1)", async () => {
    const setupPhpPath = path.join(wpDir, "wp-admin", "setup-config.php");

    let getOutput = "";
    const getCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { getOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/setup-config.php?step=1",
          QUERY_STRING: "step=1",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: setupPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
        get: { step: "1" },
      },
    });

    getCtx.setInternalVar("hasServerResponseHandler", true);

    try {
      await getCtx.require(setupPhpPath);
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    console.log("STEP 1 FULL OUTPUT:\n", getOutput);
    const $get = cheerio.load(getOutput);
    const form = $get("form[action='setup-config.php?step=2']");
    expect(form.length).toBeGreaterThan(0);
    expect($get("input[name='dbname']").length).toBe(1);
    expect($get("input[name='uname']").length).toBe(1);
    expect($get("input[name='pwd']").length).toBe(1);

    // Verify rendered text
    const labelDbName = $get("label[for='dbname']").text();
    expect(labelDbName).toContain("Database Name");

    const labelUname = $get("label[for='uname']").text();
    expect(labelUname).toContain("Username");

    const labelPwd = $get("label[for='pwd']").text();
    expect(labelPwd).toContain("Password");

    const labelDbHost = $get("label[for='dbhost']").text();
    expect(labelDbHost).toContain("Database Host");

    const labelPrefix = $get("label[for='prefix']").text();
    expect(labelPrefix).toContain("Table Prefix");

    // Verify <link> stylesheet tag in <head>
    const linkTags = $get("link[rel='stylesheet']");
    expect(linkTags.length).toBeGreaterThan(0);

    const href = linkTags.first().attr("href") || "";
    expect(href).toContain(".css");

    // Verify the linked CSS file exists and has valid CSS styles
    const installCssPath = path.join(wpDir, "wp-admin", "css", "install.css");
    expect(fs.existsSync(installCssPath)).toBe(true);
    const cssContent = fs.readFileSync(installCssPath, "utf8");
    expect(cssContent).toContain("#logo");
    expect(cssContent).toContain("body");
  }, 30000);

  test("Step 2: Submit Database Configuration and Create wp-config.php (setup-config.php?step=2)", async () => {
    const setupPhpPath = path.join(wpDir, "wp-admin", "setup-config.php");

    let postOutput = "";
    const postCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { postOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "POST",
          REQUEST_URI: "/wp-admin/setup-config.php?step=2",
          QUERY_STRING: "step=2",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: setupPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
        get: { step: "2" },
        post: {
          dbname: TEST_DB_NAME,
          uname: TEST_USER,
          pwd: TEST_PASS,
          dbhost: MYSQL_HOST + ":" + MYSQL_PORT,
          prefix: "wp_",
          language: "",
        },
      },
    });

    postCtx.setInternalVar("hasServerResponseHandler", true);

    try {
      await postCtx.require(setupPhpPath);
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    const $post = cheerio.load(postOutput);
    const installLink = $post("a[href^='install.php']");

    if (installLink.length === 0) {
      console.log("Failed DB Setup Output:\n", postOutput);
    }

    expect(installLink.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(wpDir, "wp-config.php"))).toBe(true);
  }, 30000);

  test("Step 3: Render Installation Form (install.php)", async () => {
    const installPhpPath = path.join(wpDir, "wp-admin", "install.php");

    let getOutput = "";
    const getCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { getOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/install.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: installPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
      },
    });

    getCtx.setInternalVar("hasServerResponseHandler", true);

    try {
      await getCtx.require(installPhpPath);
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    const $get = cheerio.load(getOutput);
    const form = $get("form[action='install.php?step=2']");
    expect(form.length).toBeGreaterThan(0);
  }, 30000);

  test("Step 4: Execute WordPress Installation (install.php?step=2)", async () => {
    const installPhpPath = path.join(wpDir, "wp-admin", "install.php");

    let getOutput = "";
    const getCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { getOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/install.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: installPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
      },
    });
    getCtx.setInternalVar("hasServerResponseHandler", true);
    try { await getCtx.require(installPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }

    const $get = cheerio.load(getOutput);
    const wpNonce = $get("input[name='_wpnonce']").val() || "";

    let postOutput = "";
    const postCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { postOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "POST",
          REQUEST_URI: "/wp-admin/install.php?step=2",
          QUERY_STRING: "step=2",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: installPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
        get: { step: "2" },
        post: {
          weblog_title: "WordPress on JSPHP",
          user_name: "admin",
          admin_password: "password123!",
          admin_email: "admin@example.com",
          blog_public: "1",
          pw_weak: "1",
          _wpnonce: wpNonce,
        },
      },
    });

    postCtx.setInternalVar("hasServerResponseHandler", true);

    try {
      await postCtx.require(installPhpPath);
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    const $post = cheerio.load(postOutput);
    const loginLink = $post("a[href='wp-login.php']");

    if (loginLink.length === 0) {
      console.log("Failed Install Output:\n", postOutput);
    }

    expect(loginLink.length).toBeGreaterThan(0);
    expect($post("body").text()).toContain("Success!");
  }, 60000);

  test("Step 5: Login to Control Panel and save session cookies", async () => {
    const loginPhpPath = path.join(wpDir, "wp-login.php");

    let postOutput = "";
    const loginCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { postOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "POST",
          REQUEST_URI: "/wp-login.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: loginPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
        post: {
          log: "admin",
          pwd: "password123!",
          wp_submit: "Log In",
          redirect_to: "http://127.0.0.1/wp-admin/",
          testcookie: "1",
        },
      },
    });
    loginCtx.setInternalVar("hasServerResponseHandler", true);

    try {
      await loginCtx.require(loginPhpPath);
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    const headers = loginCtx.response.headers;
    const setCookies = headers.filter(h => h.name.toLowerCase() === "set-cookie").map(h => h.value);

    for (const cookieStr of setCookies) {
      const parts = cookieStr.split(";")[0].split("=");
      if (parts.length >= 2) {
        parsedCookies[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    }

    expect(Object.keys(parsedCookies).length).toBeGreaterThan(0);
  }, 30000);

  test("Step 6: Render Dashboard (wp-admin/index.php)", async () => {
    let adminOutput = "";
    const adminCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { adminOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/index.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: path.join(wpDir, "wp-admin", "index.php"),
          HTTP_HOST: "127.0.0.1",
        },
        cookie: parsedCookies,
      },
    });

    adminCtx.setInternalVar("hasServerResponseHandler", true);
    const adminIndexPhpPath = path.join(wpDir, "wp-admin", "index.php");

    try {
      await adminCtx.require(adminIndexPhpPath);
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    const $admin = cheerio.load(adminOutput);
    const adminTitle = $admin("title, h1").text();
    expect(adminTitle.length).toBeGreaterThan(0);
    expect(adminTitle.toLowerCase()).toContain("dashboard");
  }, 30000);

  test("Step 7: Create and Enable Stack Trace Plugin from Admin Panel", async () => {
    const pluginDir = path.join(wpDir, "wp-content", "plugins", "stacktrace-plugin");
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, "stacktrace-plugin.php"),
      `<?php
/**
 * Plugin Name: Stack Trace Verification Plugin
 * Description: Dumps a PHP stack trace and outputs layer information.
 */

function stacktrace_plugin_layer_3() {
    $trace = debug_backtrace();
    echo "--- PLUGIN STACK TRACE ---\\n";
    foreach ($trace as $i => $frame) {
        $file = isset($frame['file']) ? basename($frame['file']) : '[INTERNAL]';
        $line = isset($frame['line']) ? $frame['line'] : 0;
        $func = isset($frame['function']) ? $frame['function'] : '{main}';
        echo "#{$i} {$file}:{$line} {$func}()\\n";
    }
    echo "--- END PLUGIN STACK TRACE ---\\n";
}

function stacktrace_plugin_layer_2() {
    stacktrace_plugin_layer_3();
}

function stacktrace_plugin_layer_1() {
    stacktrace_plugin_layer_2();
}

if (function_exists('add_action')) {
    add_action('wp_footer', 'stacktrace_plugin_layer_1');
}
`
    );

    // Fetch plugins page to get the nonces for activation
    let pluginsOutput = "";
    const pluginsCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { pluginsOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/plugins.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: path.join(wpDir, "wp-admin", "plugins.php"),
          HTTP_HOST: "127.0.0.1",
        },
        cookie: parsedCookies,
      },
    });

    pluginsCtx.setInternalVar("hasServerResponseHandler", true);

    try {
      await pluginsCtx.require(path.join(wpDir, "wp-admin", "plugins.php"));
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    const $plugins = cheerio.load(pluginsOutput);
    const activateLink = $plugins("a[href*='action=activate'][href*='stacktrace-plugin']").attr("href");

    if (!activateLink) {
      console.log("Plugins page HTML snippet:", pluginsOutput.substring(0, 1000));
      throw new Error("Could not find activation link for stacktrace-plugin in plugins.php");
    }

    // Activate the plugin via a GET request to the activation link
    let activateOutput = "";
    const activateCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { activateOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/" + activateLink,
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: path.join(wpDir, "wp-admin", "plugins.php"),
          HTTP_HOST: "127.0.0.1",
        },
        cookie: parsedCookies,
        get: Object.fromEntries(new URLSearchParams(activateLink.split("?")[1] || "")),
      },
    });

    activateCtx.setInternalVar("hasServerResponseHandler", true);

    try {
      await activateCtx.require(path.join(wpDir, "wp-admin", "plugins.php"));
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    expect(activateCtx.response.statusCode).toBe(302);
  }, 60000);

  test("Step 8: Renders Main Home Page (index.php) and verifies plugin executed", async () => {
    let homeOutput = "";
    const homeCtx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { homeOutput += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/index.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: path.join(wpDir, "index.php"),
          HTTP_HOST: "127.0.0.1",
        },
      },
    });

    homeCtx.setInternalVar("hasServerResponseHandler", true);
    const indexPhpPath = path.join(wpDir, "index.php");

    try {
      await homeCtx.require(indexPhpPath);
    } catch (e: any) {
      if (e.name !== "PHPExit") throw e;
    }

    expect(homeOutput).toContain("--- PLUGIN STACK TRACE ---");
    expect(homeOutput).toContain("stacktrace-plugin.php");
    expect(homeOutput).toContain("stacktrace_plugin_layer_3()");
    expect(homeOutput).toContain("stacktrace_plugin_layer_2()");
    expect(homeOutput).toContain("stacktrace_plugin_layer_1()");
  }, 30000);
});
