import { jest } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import mysql2 from "mysql2/promise";
import { PHPEngine } from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

jest.setTimeout(180000);

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

  beforeAll(async () => {
    jest.setTimeout(180000);
    delete process.env.JSPHP_DEBUG;
    engine = new PHPEngine({ watch: false, cacheDir: null });

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
      try { await conn.query(`DROP USER IF EXISTS '${TEST_USER}'@'%', '${TEST_USER}'@'localhost', '${TEST_USER}'@'127.0.0.1';`); } catch (e) {}
      await conn.query(`CREATE USER '${TEST_USER}'@'%' IDENTIFIED BY '${TEST_PASS}';`);
      await conn.query(`GRANT ALL PRIVILEGES ON \`${TEST_DB_NAME}\`.* TO '${TEST_USER}'@'%';`);
      await conn.query("FLUSH PRIVILEGES;");
      await conn.end();
      console.log(`MySQL setup complete using root password: ${JSON.stringify(rootPassUsed)}`);
    } else {
      console.error("CRITICAL: MySQL root connection failed for all attempted passwords!");
    }

    if (!fs.existsSync(path.join(wpDir, "wp-settings.php"))) {
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

      console.log("Extracting fresh WordPress archive...");
      forceRmSync(wpDir);
      fs.mkdirSync(wpDir, { recursive: true });

      const tmpDir = path.join(__dirname, "../wp_temp_extract");
      forceRmSync(tmpDir);
      fs.mkdirSync(tmpDir, { recursive: true });

      const { execSync } = await import("child_process");
      execSync(`tar -xf "${wpZipPath}" -C "${tmpDir}"`);

      const subFolder = path.join(tmpDir, "wordpress");
      copyRecursiveSync(subFolder, wpDir);
      forceRmSync(tmpDir);
      console.log("WordPress extracted successfully to:", wpDir);
    }

    const wpConfigPath = path.join(wpDir, "wp-config.php");
    if (fs.existsSync(wpConfigPath)) {
      fs.unlinkSync(wpConfigPath);
    }
    console.log("BEFOREALL DONE");
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
      await engine.close();
    }
  });

  test("Executes full WordPress installation and control panel workflow", async () => {
    const setupPhpPath = path.join(wpDir, "wp-admin", "setup-config.php");
    const installPhpPath = path.join(wpDir, "wp-admin", "install.php");
    const loginPhpPath = path.join(wpDir, "wp-login.php");
    const adminIndexPhpPath = path.join(wpDir, "wp-admin", "index.php");
    const pluginsPhpPath = path.join(wpDir, "wp-admin", "plugins.php");
    const homePhpPath = path.join(wpDir, "index.php");

    // STEP 1: Render setup-config.php?step=1
    console.log("STEP 1: GET setup-config.php?step=1");
    let step1Output = "";
    const step1Ctx = engine.createContext({
      cwd: wpDir,
      stdout: (d) => { step1Output += d; },
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
    step1Ctx.setInternalVar("hasServerResponseHandler", true);
    try { await step1Ctx.require(setupPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }
    expect(step1Output).toContain("dbname");
    await step1Ctx.destroy();

    // STEP 2: POST setup-config.php?step=2
    console.log("STEP 2: POST setup-config.php?step=2");
    let step2Output = "";
    const step2Ctx = engine.createContext({
      cwd: wpDir,
      stdout: (d) => { step2Output += d; },
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
    step2Ctx.setInternalVar("hasServerResponseHandler", true);
    try { await step2Ctx.require(setupPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }
    expect(step2Output).toContain("install.php");
    await step2Ctx.destroy();

    const wpConfigPath = path.join(wpDir, "wp-config.php");
    expect(fs.existsSync(wpConfigPath)).toBe(true);
    let wpConfigContent = fs.readFileSync(wpConfigPath, "utf8");
    wpConfigContent = wpConfigContent.replace(
      "/* That's all, stop editing!",
      "define( 'WP_HTTP_BLOCK_EXTERNAL', true );\nif (function_exists('add_filter')) { add_filter('pre_wp_mail', '__return_true'); }\n/* That's all, stop editing!"
    );
    fs.writeFileSync(wpConfigPath, wpConfigContent, "utf8");

    // STEP 3: GET install.php?step=1
    console.log("STEP 3: GET install.php?step=1");
    let step3Output = "";
    const step3Ctx = engine.createContext({
      cwd: wpDir,
      stdout: (d) => { step3Output += d; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/install.php?step=1",
          QUERY_STRING: "step=1",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: installPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
        get: { step: "1" },
      },
    });
    step3Ctx.setInternalVar("hasServerResponseHandler", true);
    try { await step3Ctx.require(installPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }

    const $step3 = cheerio.load(step3Output);
    const wpNonce = $step3("#_wpnonce").attr("value") || $step3("input[name='_wpnonce']").attr("value") || $step3("input[name='_wpnonce']").val() || "";
    await step3Ctx.destroy();

    // STEP 4: POST install.php?step=2
    console.log("STEP 4: POST install.php?step=2");
    let step4Output = "";
    const step4Ctx = engine.createContext({
      cwd: wpDir,
      stdout: (d) => { step4Output += d; },
      superglobals: {
        server: {
          REQUEST_METHOD: "POST",
          REQUEST_URI: "/wp-admin/install.php?step=2",
          QUERY_STRING: "step=2",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: installPhpPath,
          HTTP_HOST: "127.0.0.1",
          HTTP_REFERER: "http://127.0.0.1/wp-admin/install.php?step=1",
        },
        get: { step: "2" },
        post: {
          weblog_title: "WordPress on JSPHP",
          user_name: "admin",
          admin_password: "password123!",
          admin_password2: "password123!",
          admin_email: "admin@example.com",
          blog_public: "1",
          pw_weak: "1",
          _wpnonce: wpNonce,
        },
      },
    });
    step4Ctx.setInternalVar("hasServerResponseHandler", true);
    try { await step4Ctx.require(installPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }
    expect(step4Output).toContain("Success!");
    await step4Ctx.destroy();

    const verifyDb = await mysql2.createConnection({
      host: MYSQL_HOST,
      user: TEST_USER,
      password: TEST_PASS,
      database: TEST_DB_NAME,
      port: MYSQL_PORT,
    });
    const [capabilityRows] = await verifyDb.query(
      "SELECT meta_value FROM wp_usermeta WHERE user_id = 1 AND meta_key = 'wp_capabilities'"
    );
    const [urlRows] = await verifyDb.query(
      "SELECT option_name, option_value FROM wp_options WHERE option_name IN ('home', 'siteurl')"
    );
    await verifyDb.end();
    expect((capabilityRows as Array<{ meta_value: string }>)[0]?.meta_value).toBe(
      'a:1:{s:13:"administrator";b:1;}'
    );

    // STEP 5: POST wp-login.php
    console.log("STEP 5: POST wp-login.php");
    const loginCtx = engine.createContext({
      cwd: wpDir,
      superglobals: {
        server: {
          REQUEST_METHOD: "POST",
          REQUEST_URI: "/wp-login.php",
          SCRIPT_NAME: "/wp-login.php",
          PHP_SELF: "/wp-login.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: loginPhpPath,
          HTTP_HOST: "127.0.0.1",
          HTTP_REFERER: "http://127.0.0.1/wp-login.php",
        },
        cookie: { wordpress_test_cookie: "WP Cookie check" },
        post: {
          log: "admin",
          pwd: "password123!",
          "wp-submit": "Log In",
          redirect_to: "http://127.0.0.1/wp-admin/",
          testcookie: "1",
        },
      },
    });
    loginCtx.setInternalVar("hasServerResponseHandler", true);
    try { await loginCtx.require(loginPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }

    const parsedCookies: Record<string, string> = {};
    const setCookies = loginCtx.response.headers.filter(h => h.name.toLowerCase() === "set-cookie").map(h => h.value);
    for (const cookieStr of setCookies) {
      const parts = cookieStr.split(";")[0].split("=");
      if (parts.length >= 2) {
        parsedCookies[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    }
    expect(Object.keys(parsedCookies).length).toBeGreaterThan(0);
    await loginCtx.destroy();

    // STEP 6: GET wp-admin/index.php
    console.log("STEP 6: GET wp-admin/index.php");
    let adminOutput = "";
    const adminCtx = engine.createContext({
      cwd: wpDir,
      stdout: (d) => { adminOutput += d; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/index.php",
          SCRIPT_NAME: "/wp-admin/index.php",
          PHP_SELF: "/wp-admin/index.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: adminIndexPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
        cookie: parsedCookies,
      },
    });
    adminCtx.setInternalVar("hasServerResponseHandler", true);
    try { await adminCtx.require(adminIndexPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }

    const $admin = cheerio.load(adminOutput);
    const adminTitle = $admin("title, h1").text();
    expect(adminTitle.length).toBeGreaterThan(0);
    expect(adminTitle.toLowerCase()).toContain("dashboard");
    await adminCtx.destroy();

    // STEP 7: Create and Enable Stack Trace Plugin
    console.log("STEP 7: Create and Enable Stack Trace Plugin");
    const pluginsDir = path.join(wpDir, "wp-content", "plugins");
    const pluginFolder = path.join(pluginsDir, "stacktrace-plugin");
    fs.mkdirSync(pluginFolder, { recursive: true });

    const pluginPhpContent = `<?php
/**
 * Plugin Name: Stack Trace Plugin
 * Description: Outputs stack trace on action hook
 * Version: 1.0
 */

function stacktrace_plugin_layer_3() {
    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
    echo "--- PLUGIN STACK TRACE ---\\n";
    foreach ($trace as $i => $frame) {
        $file = isset($frame['file']) ? basename($frame['file']) : 'unknown';
        $line = isset($frame['line']) ? $frame['line'] : 0;
        $func = isset($frame['function']) ? $frame['function'] : 'unknown';
        echo "#{$i} {$file}:{$line} -> {$func}()\\n";
    }
}

function stacktrace_plugin_layer_2() {
    stacktrace_plugin_layer_3();
}

function stacktrace_plugin_layer_1() {
    stacktrace_plugin_layer_2();
}

add_action('wp_head', 'stacktrace_plugin_layer_1');
add_action('wp_footer', 'stacktrace_plugin_layer_1');
`;
    fs.writeFileSync(path.join(pluginFolder, "stacktrace-plugin.php"), pluginPhpContent, "utf8");

    let pluginsOutput = "";
    const pluginsCtx = engine.createContext({
      cwd: wpDir,
      stdout: (d) => { pluginsOutput += d; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/plugins.php",
          SCRIPT_NAME: "/wp-admin/plugins.php",
          PHP_SELF: "/wp-admin/plugins.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: pluginsPhpPath,
          HTTP_HOST: "127.0.0.1",
        },
        cookie: parsedCookies,
      },
    });
    pluginsCtx.setInternalVar("hasServerResponseHandler", true);
    try { await pluginsCtx.require(pluginsPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }

    const $plugins = cheerio.load(pluginsOutput);
    const activateLink = $plugins("a[href*='action=activate'][href*='stacktrace-plugin']").attr("href");
    expect(activateLink).toBeTruthy();

    if (activateLink) {
      const urlObj = new URL(activateLink.replace(/&amp;/g, "&"), "http://127.0.0.1/wp-admin/");
      const queryParams = Object.fromEntries(urlObj.searchParams.entries());

      let actOutput = "";
      const actCtx = engine.createContext({
        cwd: wpDir,
        stdout: (d) => { actOutput += d; },
        superglobals: {
          server: {
            REQUEST_METHOD: "GET",
            REQUEST_URI: "/wp-admin/plugins.php" + urlObj.search,
            QUERY_STRING: urlObj.search.substring(1),
            SCRIPT_NAME: "/wp-admin/plugins.php",
            PHP_SELF: "/wp-admin/plugins.php",
            DOCUMENT_ROOT: wpDir,
            SCRIPT_FILENAME: pluginsPhpPath,
            HTTP_HOST: "127.0.0.1",
            HTTP_REFERER: "http://127.0.0.1/wp-admin/plugins.php",
          },
          cookie: parsedCookies,
          get: queryParams,
        },
      });
      actCtx.setInternalVar("hasServerResponseHandler", true);
      try { await actCtx.require(pluginsPhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }
      expect(actCtx.response.statusCode).toBe(302);
      await actCtx.destroy();
    }
    await pluginsCtx.destroy();

    // STEP 8: GET index.php (Front Page)
    console.log("STEP 8: GET index.php (Front Page)");
    let homeOutput = "";
    const homeCtx = engine.createContext({
      cwd: wpDir,
      stdout: (d) => { homeOutput += d; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/",
          SCRIPT_NAME: "/index.php",
          PHP_SELF: "/index.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: homePhpPath,
          HTTP_HOST: "127.0.0.1",
        },
        cookie: parsedCookies,
      },
    });
    homeCtx.setInternalVar("hasServerResponseHandler", true);
    try { await homeCtx.require(homePhpPath); } catch (e: any) { if (e.name !== "PHPExit") throw e; }
    expect(homeOutput).toContain("--- PLUGIN STACK TRACE ---");
    expect(homeOutput).toContain("stacktrace-plugin.php");
    expect(homeOutput).toContain("stacktrace_plugin_layer_3");
    expect(homeOutput).toContain("stacktrace_plugin_layer_2");
    expect(homeOutput).toContain("stacktrace_plugin_layer_1");
    await homeCtx.destroy();
  }, 180000);
});
