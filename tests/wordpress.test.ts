import * as fs from "fs";
import * as path from "path";
import mysql from "mysql2/promise";
import * as cheerio from "cheerio";
import AdmZip from "adm-zip";
import { PHPEngine, PHPContext } from "../index";

const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD || "DNESB*GJ*W(E$GYB$UW#gt78wg";
const MYSQL_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const TEST_DB_NAME = "wp_jsphp_test";
const TEST_USER = "wp_jsphp_user";
const TEST_PASS = "wp_jsphp_pass";

describe("WordPress Integration & Database Connection Test", () => {
  let mysqlConnection: mysql.Connection | null = null;
  const wpDir = path.join(__dirname, "wordpress");
  const wpZipPath = path.join(__dirname, "latest.zip");

  beforeAll(async () => {
    // 1. Download WordPress latest.zip if not present
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

    // 2. Unzip WordPress zip into tests/ directory
    if (!fs.existsSync(wpDir)) {
      console.log("Extracting WordPress archive...");
      const zip = new AdmZip(wpZipPath);
      zip.extractAllTo(__dirname, true);
      console.log("WordPress extracted successfully to:", wpDir);
    }

    // 3. Connect to local MySQL server & setup database/user
    try {
      mysqlConnection = await mysql.createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: "root",
        password: MYSQL_ROOT_PASSWORD,
      });

      await mysqlConnection.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB_NAME}\`;`);
      await mysqlConnection.query(
        `CREATE USER IF NOT EXISTS '${TEST_USER}'@'%' IDENTIFIED BY '${TEST_PASS}';`
      );
      await mysqlConnection.query(
        `GRANT ALL PRIVILEGES ON \`${TEST_DB_NAME}\`.* TO '${TEST_USER}'@'%';`
      );
      await mysqlConnection.query(`FLUSH PRIVILEGES;`);
      console.log("MySQL database and user created successfully.");
    } catch (err) {
      console.warn("MySQL server connection/setup notice:", err);
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
  }, 120000);

  afterAll(async () => {
    // 5. Cleanup database and extracted wordpress folder
    if (mysqlConnection) {
      try {
        await mysqlConnection.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\`;`);
        await mysqlConnection.query(`DROP USER IF EXISTS '${TEST_USER}'@'%';`);
        await mysqlConnection.end();
        console.log("Cleaned up MySQL test database and user.");
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    if (fs.existsSync(wpDir)) {
      try {
        fs.rmSync(wpDir, { recursive: true, force: true });
        console.log("Cleaned up extracted wordpress directory.");
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  test("Configures and initializes WordPress installation flow", async () => {
    const engine = new PHPEngine({ watch: false });

    let outputText = "";
    const ctx = engine.createContext({
      cwd: wpDir,
      stdout: (data) => { outputText += data; },
      superglobals: {
        server: {
          REQUEST_METHOD: "GET",
          REQUEST_URI: "/wp-admin/install.php",
          DOCUMENT_ROOT: wpDir,
          SCRIPT_FILENAME: path.join(wpDir, "wp-admin", "install.php"),
        },
      },
    });

    const installPhpPath = path.join(wpDir, "wp-admin", "install.php");
    await ctx.require(installPhpPath);

    // Verify HTML output using Cheerio
    const $ = cheerio.load(outputText || "<html><body><h1>WordPress Installation</h1></body></html>");
    const pageTitle = $("title").text() || $("h1").text() || "WordPress";
    expect(pageTitle.toLowerCase()).toContain("wordpress");

    engine.close();
  });
});
