"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySQLiExtension = exports.MySQLiObject = exports.MySQLiResult = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const PHPExtension_1 = require("../PHPExtension");
const PHPObject_1 = require("../runtime/PHPObject");
class MySQLiResult {
    rows;
    index = 0;
    num_rows;
    constructor(rows) {
        this.rows = rows || [];
        this.num_rows = this.rows.length;
    }
    fetch_assoc() {
        if (this.index >= this.rows.length)
            return null;
        return this.rows[this.index++];
    }
    fetch_row() {
        if (this.index >= this.rows.length)
            return null;
        const row = this.rows[this.index++];
        return Object.values(row);
    }
}
exports.MySQLiResult = MySQLiResult;
class MySQLiObject extends PHPObject_1.PHPObject {
    connection;
    connect_error = null;
    connect_errno = 0;
    insert_id = 0;
    affected_rows = 0;
    error = "";
    errno = 0;
    constructor() {
        super(new PHPObject_1.PHPClass("mysqli"));
    }
    async real_connect(host = "127.0.0.1", user = "root", password = "", database = "", port = 3306, socket = "", flags = 0) {
        let actualHost = host || "127.0.0.1";
        let actualPort = port || 3306;
        if (actualHost.includes(":")) {
            const [h, p] = actualHost.split(":");
            actualHost = h || "127.0.0.1";
            const parsedPort = parseInt(p, 10);
            if (!isNaN(parsedPort)) {
                actualPort = parsedPort;
            }
        }
        if (actualHost === "localhost") {
            actualHost = "127.0.0.1";
        }
        try {
            this.connection = await promise_1.default.createConnection({
                host: actualHost,
                user: user || "root",
                password: password || "",
                database: database || undefined,
                port: actualPort,
                connectTimeout: 1000,
            });
            this.connect_error = null;
            this.connect_errno = 0;
            this.error = "";
            this.errno = 0;
            return true;
        }
        catch (err) {
            this.connect_error = err.message;
            this.connect_errno = err.errno || 1045;
            this.error = err.message;
            this.errno = err.errno || 1045;
            return false;
        }
    }
    async query(sql) {
        if (!this.connection)
            return false;
        try {
            const [results] = await this.connection.query(sql);
            if (Array.isArray(results)) {
                return new MySQLiResult(results);
            }
            else {
                this.insert_id = results.insertId || 0;
                this.affected_rows = results.affectedRows || 0;
                return true;
            }
        }
        catch (err) {
            this.error = err.message;
            this.errno = err.errno || 1064;
            return false;
        }
    }
    escape_string(str) {
        if (!this.connection)
            return String(str ?? "").replace(/'/g, "\\'");
        return this.connection.escape(str).slice(1, -1);
    }
    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = undefined;
        }
        return true;
    }
}
exports.MySQLiObject = MySQLiObject;
class MySQLiExtension extends PHPExtension_1.PHPExtension {
    name = "mysqli";
    onInit(engine) {
        this.constants = {
            MYSQLI_ASSOC: 1,
            MYSQLI_NUM: 2,
            MYSQLI_BOTH: 3,
            MYSQLI_REPORT_OFF: 0,
            MYSQLI_REPORT_ERROR: 1,
            MYSQLI_REPORT_STRICT: 2,
            MYSQLI_REPORT_INDEX: 4,
            MYSQLI_REPORT_ALL: 255,
            MYSQLI_OPT_CONNECT_TIMEOUT: 0,
        };
        this.classes = {
            mysqli: MySQLiObject,
        };
        this.functions = {
            mysqli_init: (ctx) => new MySQLiObject(),
            mysqli_report: (ctx, flags = 0) => true,
            mysqli_connect: async (ctx, host, user, pass, db, port) => {
                const conn = new MySQLiObject();
                await conn.real_connect(host, user, pass, db, port);
                return conn;
            },
            mysqli_real_connect: async (ctx, conn, host, user, pass, db, port, socket, flags) => {
                if (!conn)
                    return false;
                return await conn.real_connect(host, user, pass, db, port, socket, flags);
            },
            mysqli_options: (ctx, conn, option, value) => true,
            mysqli_select_db: async (ctx, conn, dbname) => {
                if (!conn || !conn.connection)
                    return false;
                try {
                    await conn.connection.query(`USE \`${dbname}\``);
                    return true;
                }
                catch {
                    return false;
                }
            },
            mysqli_set_charset: async (ctx, conn, charset) => {
                if (!conn || !conn.connection)
                    return false;
                try {
                    await conn.connection.query(`SET NAMES '${charset}'`);
                    return true;
                }
                catch {
                    return false;
                }
            },
            mysqli_query: async (ctx, conn, sql) => {
                return conn ? await conn.query(sql) : false;
            },
            mysqli_fetch_assoc: (ctx, result) => {
                return result ? result.fetch_assoc() : null;
            },
            mysqli_real_escape_string: (ctx, conn, str) => {
                return conn ? conn.escape_string(str) : str;
            },
            mysqli_close: async (ctx, conn) => {
                return conn ? await conn.close() : true;
            },
            mysqli_error: (ctx, conn) => {
                return conn ? conn.error : "";
            },
            mysqli_connect_errno: (ctx) => 0,
            mysqli_connect_error: (ctx) => "",
            mysqli_errno: (ctx, conn) => conn ? conn.connect_errno : 0,
            mysqli_sqlstate: (ctx, conn) => conn ? (conn.connect_errno ? "HY000" : "00000") : "00000",
            mysqli_free_result: (ctx, res) => true,
            mysqli_more_results: (ctx, conn) => false,
            mysqli_next_result: (ctx, conn) => false,
        };
    }
}
exports.MySQLiExtension = MySQLiExtension;
//# sourceMappingURL=mysqli.js.map