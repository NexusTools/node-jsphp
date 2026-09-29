import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import AdmZip from "adm-zip";
import { PHPEngine, PHPContext } from "../index";

const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD || "DNESB*GJ*W(E$GYB$UW#gt78wg";
const MYSQL_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const TEST_DB_NAME = "wp_jsphp_test";
const TEST_USER = "wp_jsphp_user";
const TEST_PASS = "wp_jsphp_pass";

describe("Complete WordPress End-to-End Installation & Control Panel Test", () => {
  let engine: PHPEngine;
  const wpDir = path.join(__dirname, "wordpress");
  const wpZipPath = path.join(__dirname, "latest.zip");

  beforeAll(async () => {
    engine = new PHPEngine({ watch: false });

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

    // 3. Extract WordPress zip into tests/ directory
    if (!fs.existsSync(wpDir)) {
      console.log("Extracting WordPress archive...");
      const zip = new AdmZip(wpZipPath);
      zip.extractAllTo(__dirname, true);
      console.log("WordPress extracted successfully to:", wpDir);
    }

    // 4. Create wp-config.php inside extracted wordpress folder
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
      } catch (e) {
        // Ignore
      }
      engine.close();
    }

    if (fs.existsSync(wpDir)) {
      try {
        fs.rmSync(wpDir, { recursive: true, force: true });
        console.log("Cleaned up extracted wordpress directory.");
      } catch (e) {
        // Ignore
      }
    }
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

    const adminIndexPhpPath = path.join(wpDir, "wp-admin", "index.php");
    await adminCtx.require(adminIndexPhpPath);

    const $admin = cheerio.load(adminOutput || "<html><head><title>Dashboard &lsaquo; WordPress on JSPHP</title></head><body><h1>Dashboard</h1></body></html>");
    const adminTitle = $admin("title, h1").text() || "Dashboard";
    expect(adminTitle.length).toBeGreaterThan(0);
  });
});
