"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySQLiExtension = exports.MySQLiConnection = exports.MySQLiResult = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const PHPExtension_1 = require("../../PHPExtension");
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
class MySQLiConnection {
    connection;
    connect_error = null;
    connect_errno = 0;
    insert_id = 0;
    affected_rows = 0;
    error = "";
    async connect(host = "127.0.0.1", user = "root", password = "", database = "", port = 3306) {
        try {
            this.connection = await promise_1.default.createConnection({ host, user, password, database, port });
            return true;
        }
        catch (err) {
            this.connect_error = err.message;
            this.connect_errno = err.errno || 1045;
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
            return false;
        }
    }
    escape_string(str) {
        if (!this.connection)
            return str.replace(/'/g, "\\'");
        return this.connection.escape(str).slice(1, -1);
    }
    async close() {
        if (this.connection) {
            await this.connection.end();
        }
        return true;
    }
}
exports.MySQLiConnection = MySQLiConnection;
class MySQLiExtension extends PHPExtension_1.PHPExtension {
    name = "mysqli";
    onInit(engine) {
        this.constants = {
            MYSQLI_ASSOC: 1,
            MYSQLI_NUM: 2,
            MYSQLI_BOTH: 3,
        };
        this.functions = {
            mysqli_connect: async (ctx, host, user, pass, db, port) => {
                const conn = new MySQLiConnection();
                await conn.connect(host, user, pass, db, port);
                return conn;
            },
            mysqli_query: async (ctx, conn, sql) => {
                return await conn.query(sql);
            },
            mysqli_fetch_assoc: (ctx, result) => {
                return result ? result.fetch_assoc() : null;
            },
            mysqli_real_escape_string: (ctx, conn, str) => {
                return conn ? conn.escape_string(str) : str;
            },
            mysqli_error: (ctx, conn) => {
                return conn ? conn.error : "";
            },
            mysqli_insert_id: (ctx, conn) => {
                return conn ? conn.insert_id : 0;
            },
            mysqli_close: async (ctx, conn) => {
                return conn ? await conn.close() : true;
            },
        };
    }
}
exports.MySQLiExtension = MySQLiExtension;
//# sourceMappingURL=mysqli.js.map