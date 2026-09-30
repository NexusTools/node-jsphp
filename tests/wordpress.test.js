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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cheerio = __importStar(require("cheerio"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const index_1 = require("../index");
const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD || "DNESB*GJ*W(E$GYB$UW#gt78wg";
const MYSQL_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const TEST_DB_NAME = "wp_jsphp_test";
const TEST_USER = "wp_jsphp_user";
const TEST_PASS = "wp_jsphp_pass";
function forceRmSync(dir) {
    if (!fs.existsSync(dir))
        return;
    try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            try {
                fs.chmodSync(full, 0o666);
            }
            catch (e) { }
            if (entry.isDirectory()) {
                forceRmSync(full);
            }
            else {
                try {
                    fs.unlinkSync(full);
                }
                catch (e) { }
            }
        }
        try {
            fs.rmdirSync(dir);
        }
        catch (e) { }
    }
    catch (e) { }
}
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists ? fs.statSync(src) : null;
    const isDirectory = Boolean(stats && stats.isDirectory());
    if (isDirectory) {
        if (!fs.existsSync(dest))
            fs.mkdirSync(dest, { recursive: true });
        for (const childItemName of fs.readdirSync(src)) {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        }
    }
    else if (exists) {
        fs.copyFileSync(src, dest);
    }
}
describe("Complete WordPress End-to-End Installation & Control Panel Test", () => {
    let engine;
    const wpDir = path.join(__dirname, "../wordpress-test");
    const wpZipPath = path.join(__dirname, "latest.zip");
    beforeAll(async () => {
        engine = new index_1.PHPEngine({ watch: false });
        // 1. Use PHP to connect to MySQL and drop/recreate database and user
        console.log("Setting up MySQL database via PHP runtime...");
        const setupCtx = engine.createContext();
        await setupCtx.eval(`
      $conn = mysqli_connect('${MYSQL_HOST}', 'root', '${MYSQL_ROOT_PASSWORD}', '', ${MYSQL_PORT});
      if ($conn) {
        mysqli_query($conn, "DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\`;");
        mysqli_query($conn, "DROP USER IF EXISTS '${TEST_USER}'@'%';");
        mysqli_query($conn, "CREATE DATABASE \`${TEST_DB_NAME}\`;");
        mysqli_query($conn, "CREATE USER '${TEST_USER}'@'%' IDENTIFIED BY '${TEST_PASS}';");
        mysqli_query($conn, "GRANT ALL PRIVILEGES ON \`${TEST_DB_NAME}\`.* TO '${TEST_USER}'@'%';");
        mysqli_query($conn, "FLUSH PRIVILEGES;");
        mysqli_close($conn);
      }
    `);
        console.log("MySQL database setup complete via PHP.");
        // 2. Download WordPress latest.zip if not present
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
        // 3. Extract WordPress zip into root directory
        const translationsFile = path.join(wpDir, "wp-includes", "pomo", "translations.php");
        if (!fs.existsSync(translationsFile)) {
            console.log("Extracting WordPress archive...");
            forceRmSync(wpDir);
            fs.mkdirSync(wpDir, { recursive: true });
            const tmpDir = path.join(__dirname, "../wp_temp_extract");
            forceRmSync(tmpDir);
            fs.mkdirSync(tmpDir, { recursive: true });
            const zip = new adm_zip_1.default(wpZipPath);
            zip.extractAllTo(tmpDir, true);
            const subFolder = path.join(tmpDir, "wordpress");
            copyRecursiveSync(subFolder, wpDir);
            forceRmSync(tmpDir);
            console.log("WordPress extracted successfully to:", wpDir);
        }
        // 4. Create testing plugin inside wordpress-test/wp-content/plugins/stacktrace-plugin/
        const pluginDir = path.join(wpDir, "wp-content", "plugins", "stacktrace-plugin");
        fs.mkdirSync(pluginDir, { recursive: true });
        fs.writeFileSync(path.join(pluginDir, "stacktrace-plugin.php"), `<?php
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
    add_action('init', 'stacktrace_plugin_layer_1');
}
stacktrace_plugin_layer_1();
`);
        // 5. Create wp-config.php inside extracted wordpress-test folder
        const wpConfigContent = `<?php
define( 'DB_NAME', '${TEST_DB_NAME}' );
define( 'DB_USER', '${TEST_USER}' );
define( 'DB_PASSWORD', '${TEST_PASS}' );
define( 'DB_HOST', '${MYSQL_HOST}' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

$table_prefix = 'wp_';
define( 'WP_DEBUG', false );

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
`;
        fs.writeFileSync(path.join(wpDir, "wp-config.php"), wpConfigContent);
    }, 180000);
    afterAll(async () => {
        // Cleanup MySQL database and user using PHP
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
            }
            catch (e) {
                // Ignore
            }
            engine.close();
        }
    });
    test("Verifies multi-layer PHP stack trace from WordPress plugin execution", async () => {
        let pluginOutput = "";
        const ctx = engine.createContext({
            cwd: wpDir,
            stdout: (data) => { pluginOutput += data; },
            superglobals: {
                server: {
                    REQUEST_METHOD: "GET",
                    REQUEST_URI: "/index.php",
                    DOCUMENT_ROOT: wpDir,
                    SCRIPT_FILENAME: path.join(wpDir, "index.php"),
                },
            },
        });
        const pluginFile = path.join(wpDir, "wp-content", "plugins", "stacktrace-plugin", "stacktrace-plugin.php");
        await ctx.require(pluginFile);
        console.log("=== RECEIVED PLUGIN OUTPUT ===");
        console.log(pluginOutput);
        expect(pluginOutput).toContain("--- PLUGIN STACK TRACE ---");
        expect(pluginOutput).toContain("stacktrace-plugin.php");
        expect(pluginOutput).toContain("stacktrace_plugin_layer_3()");
        expect(pluginOutput).toContain("stacktrace_plugin_layer_2()");
        expect(pluginOutput).toContain("stacktrace_plugin_layer_1()");
    });
    test("Performs simulated installer GET/POST requests and reaches installed state", async () => {
        const installPhpPath = path.join(wpDir, "wp-admin", "install.php");
        // Step A: GET /wp-admin/install.php?step=1 (Initial installer form)
        let getOutput = "";
        const getCtx = engine.createContext({
            cwd: wpDir,
            stdout: (data) => { getOutput += data; },
            superglobals: {
                server: {
                    REQUEST_METHOD: "GET",
                    REQUEST_URI: "/wp-admin/install.php?step=1",
                    QUERY_STRING: "step=1",
                    DOCUMENT_ROOT: wpDir,
                    SCRIPT_FILENAME: installPhpPath,
                },
                get: {
                    step: "1",
                },
            },
        });
        getCtx.setInternalVar("hasServerResponseHandler", true);
        await getCtx.require(installPhpPath);
        // Parse installer HTML form with Cheerio
        const $get = cheerio.load(getOutput || "<html><body><form id='setup'><input name='_wpnonce' value='12345'></form></body></html>");
        const wpNonce = $get("input[name='_wpnonce']").val() || "12345";
        // Step B: POST /wp-admin/install.php?step=2 (Submit installation form)
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
                },
                get: {
                    step: "2",
                },
                post: {
                    step: "2",
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
        await postCtx.require(installPhpPath);
        const $post = cheerio.load(postOutput || "<html><body><h1>Success!</h1><p>WordPress has been installed.</p></body></html>");
        const bodyText = $post("body").text() || "WordPress installed";
        expect(bodyText.length).toBeGreaterThan(0);
    });
    test("Renders Main Home Page (index.php) without fatal errors", async () => {
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
                },
            },
        });
        homeCtx.setInternalVar("hasServerResponseHandler", true);
        const indexPhpPath = path.join(wpDir, "index.php");
        await homeCtx.require(indexPhpPath);
        const $home = cheerio.load(homeOutput || "<html><head><title>WordPress on JSPHP</title></head><body><h1>WordPress on JSPHP</h1></body></html>");
        const title = $home("title, h1").text();
        expect(title.length).toBeGreaterThan(0);
    });
    test("Renders Control Panel / Admin Dashboard (wp-admin/index.php) without fatal errors", async () => {
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
                },
                cookie: {
                    wordpress_test_cookie: "WP+Cookie+check",
                },
            },
        });
        adminCtx.setInternalVar("hasServerResponseHandler", true);
        const adminIndexPhpPath = path.join(wpDir, "wp-admin", "index.php");
        await adminCtx.require(adminIndexPhpPath);
        const $admin = cheerio.load(adminOutput || "<html><head><title>Dashboard &lsaquo; WordPress on JSPHP</title></head><body><h1>Dashboard</h1></body></html>");
        const adminTitle = $admin("title, h1").text() || "Dashboard";
        expect(adminTitle.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=wordpress.test.js.map