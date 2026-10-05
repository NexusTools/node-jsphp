import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension.js";
import { PHPVariable } from "../runtime/PHPVariable.js";
export class MySQLiResult {
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
    fetch_array(resulttype = 3) {
        if (this.index >= this.rows.length)
            return null;
        const row = this.rows[this.index++];
        if (resulttype === 1) {
            return Object.values(row);
        }
        if (resulttype === 2) {
            return { ...row };
        }
        const res = { ...row };
        Object.values(row).forEach((v, i) => { res[i] = v; });
        return res;
    }
}
export class MySQLiObject {
    connection;
    connect_error = new PHPVariable(null);
    connect_errno = new PHPVariable(0);
    insert_id = new PHPVariable(0);
    affected_rows = new PHPVariable(0);
    error = new PHPVariable("");
    errno = new PHPVariable(0);
    static async __$$__new(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg) {
        const obj = Object.create(this.prototype);
        obj.connect_error = new PHPVariable(null);
        obj.connect_errno = new PHPVariable(0);
        obj.insert_id = new PHPVariable(0);
        obj.affected_rows = new PHPVariable(0);
        obj.error = new PHPVariable("");
        obj.errno = new PHPVariable(0);
        if (typeof obj.__construct === "function")
            await obj.__construct(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg);
        return obj;
    }
    async __construct(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg) {
        if (hostArg || userArg || passwordArg || databaseArg) {
            await this.real_connect(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg);
        }
    }
    async real_connect(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg, flagsArg) {
        let actualHost = String(hostArg?.get() ?? "127.0.0.1") || "127.0.0.1";
        let user = String(userArg?.get() ?? "root") || "root";
        let password = String(passwordArg?.get() ?? "");
        let database = String(databaseArg?.get() ?? "");
        let actualPort = Number(portArg?.get()) || 3306;
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
            this.connection = await mysql.createConnection({
                host: actualHost,
                user: user,
                password: password,
                database: database || undefined,
                port: actualPort,
                connectTimeout: 1000,
            });
            this.connect_error.set(null);
            this.connect_errno.set(0);
            this.error.set("");
            this.errno.set(0);
            return true;
        }
        catch (err) {
            console.error("MYSQL CONNECT ERR:", err);
            this.connect_error.set(err.message);
            this.connect_errno.set(err.errno || 1045);
            this.error.set(err.message);
            this.errno.set(err.errno || 1045);
            return false;
        }
    }
    async query(ctx, sqlArg) {
        if (!this.connection)
            return false;
        const sql = String(sqlArg?.get() ?? "");
        try {
            const [results] = await this.connection.query(sql);
            if (Array.isArray(results)) {
                return new MySQLiResult(results);
            }
            else {
                this.insert_id.set(results.insertId || 0);
                this.affected_rows.set(results.affectedRows || 0);
                return true;
            }
        }
        catch (err) {
            this.error.set(err.message);
            this.errno.set(err.errno || 1064);
            return false;
        }
    }
    escape_string(ctx, strArg) {
        const str = String(strArg?.get() ?? "");
        if (!this.connection)
            return str.replace(/'/g, "\\'");
        return this.connection.escape(str).slice(1, -1);
    }
    async close(ctx) {
        if (this.connection) {
            await this.connection.end();
            this.connection = undefined;
        }
        return true;
    }
}
export class MySQLiExtension extends PHPExtension {
    name = "mysqli";
    onInit(engine) {
        this.constants = {
            mysqli_assoc: 1,
            mysqli_num: 2,
            mysqli_both: 3,
            mysqli_report_off: 0,
            mysqli_report_error: 1,
            mysqli_report_strict: 2,
            mysqli_report_index: 4,
            mysqli_report_all: 255,
            mysqli_opt_connect_timeout: 0,
        };
        this.classes = {
            mysqli: MySQLiObject,
        };
        this.functions = {
            mysqli_init: async (ctx) => await MySQLiObject.__$$__new(ctx),
            mysqli_report: (ctx, flags) => true,
            mysqli_connect: async (ctx, host, user, pass, db, port) => {
                const conn = await MySQLiObject.__$$__new(ctx);
                await conn.real_connect(ctx, host, user, pass, db, port);
                return conn;
            },
            mysqli_real_connect: async (ctx, connArg, host, user, pass, db, port, socket, flags) => {
                const conn = connArg?.get();
                if (!conn)
                    return false;
                return await conn.real_connect(ctx, host, user, pass, db, port, socket, flags);
            },
            mysqli_options: (ctx, connArg, option, value) => true,
            mysqli_select_db: async (ctx, connArg, dbnameArg) => {
                const conn = connArg?.get();
                const dbname = String(dbnameArg?.get() ?? "");
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
            mysqli_set_charset: async (ctx, connArg, charsetArg) => {
                const conn = connArg?.get();
                const charset = String(charsetArg?.get() ?? "");
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
            mysqli_query: async (ctx, connArg, sqlArg) => {
                const conn = connArg?.get();
                return conn ? await conn.query(ctx, sqlArg) : false;
            },
            mysqli_fetch_assoc: (ctx, resultArg) => {
                const result = resultArg?.get();
                return result && typeof result.fetch_assoc === "function" ? result.fetch_assoc() : null;
            },
            mysqli_fetch_array: (ctx, resultArg, resulttypeArg) => {
                const result = resultArg?.get();
                const type = Number(resulttypeArg?.get()) || 3;
                return result && typeof result.fetch_array === "function" ? result.fetch_array(type) : null;
            },
            mysqli_fetch_row: (ctx, resultArg) => {
                const result = resultArg?.get();
                return result && typeof result.fetch_row === "function" ? result.fetch_row() : null;
            },
            mysqli_real_escape_string: (ctx, connArg, strArg) => {
                const conn = connArg?.get();
                return conn ? conn.escape_string(ctx, strArg) : String(strArg?.get() ?? "");
            },
            mysqli_close: async (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? await conn.close(ctx) : true;
            },
            mysqli_error: (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? conn.error.get() : "";
            },
            mysqli_connect_errno: (ctx) => 0,
            mysqli_connect_error: (ctx) => "",
            mysqli_errno: (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? conn.connect_errno.get() : 0;
            },
            mysqli_sqlstate: (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? (conn.connect_errno.get() ? "HY000" : "00000") : "00000";
            },
            mysqli_free_result: (ctx, res) => true,
            mysqli_more_results: (ctx, conn) => false,
            mysqli_next_result: (ctx, conn) => false,
            mysqli_get_server_info: (ctx, connArg) => "8.0.35-MySQL",
            mysqli_get_server_version: (ctx, connArg) => 80035,
            mysqli_get_client_info: (ctx) => "mysqlnd 8.0.35",
            mysqli_get_client_version: (ctx) => 80035,
            mysqli_num_rows: (ctx, resultArg) => {
                const result = resultArg?.get();
                return result ? result.num_rows || 0 : 0;
            },
            mysqli_num_fields: (ctx, resultArg) => {
                const result = resultArg?.get();
                return (result && result.rows && result.rows.length > 0) ? Object.keys(result.rows[0]).length : 0;
            },
            mysqli_insert_id: (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? conn.insert_id || 0 : 0;
            },
            mysqli_affected_rows: (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? conn.affected_rows || 0 : 0;
            },
            mysqli_ping: (ctx, connArg) => true,
            mysqli_autocommit: (ctx, connArg, modeArg) => true,
            mysqli_commit: (ctx, connArg) => true,
            mysqli_rollback: (ctx, connArg) => true,
        };
    }
}
//# sourceMappingURL=mysqli.js.map