import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
export class MySQLiResult {
    rows;
    index = 0;
    $num_rows;
    constructor(rows) {
        this.rows = rows || [];
        this.$num_rows = new PHPVariable(this.rows.length);
    }
    get num_rows() {
        return this.$num_rows.get();
    }
    fetch_assoc(ctx) {
        if (this.index >= this.rows.length)
            return null;
        return this.rows[this.index++];
    }
    fetch_row(ctx) {
        if (this.index >= this.rows.length)
            return null;
        const row = this.rows[this.index++];
        return Object.values(row);
    }
    fetch_array(ctx, resulttypeArg) {
        if (this.index >= this.rows.length)
            return null;
        let resulttype = 3;
        if (resulttypeArg !== undefined) {
            const val = resulttypeArg instanceof PHPReference ? resulttypeArg.get() : resulttypeArg;
            if (val !== undefined && val !== null)
                resulttype = Number(val);
        }
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
    fetch_object(ctx, classArg, paramsArg) {
        if (this.index >= this.rows.length)
            return null;
        const row = this.rows[this.index++];
        const obj = {};
        for (const [k, v] of Object.entries(row)) {
            obj[k] = v;
        }
        return obj;
    }
    fetch_all(ctx, resulttypeArg) {
        const type = resulttypeArg ? (resulttypeArg instanceof PHPReference ? resulttypeArg.get() : resulttypeArg) : 1;
        const all = [];
        while (this.index < this.rows.length) {
            if (type === 1)
                all.push(this.fetch_assoc(ctx));
            else if (type === 2)
                all.push(this.fetch_row(ctx));
            else
                all.push(this.fetch_array(ctx, new PHPLiteral(type)));
        }
        return all;
    }
    free() { }
    free_result() { }
    close() { }
    data_seek(ctx, offsetArg) {
        const offset = Number(offsetArg?.get ? offsetArg.get() : offsetArg) || 0;
        if (offset >= 0 && offset < this.rows.length) {
            this.index = offset;
            return true;
        }
        return false;
    }
}
export class MySQLiObject {
    connection;
    $connect_error = new PHPVariable(null);
    $connect_errno = new PHPVariable(0);
    $insert_id = new PHPVariable(0);
    $affected_rows = new PHPVariable(0);
    $error = new PHPVariable("");
    $errno = new PHPVariable(0);
    static async __$$__new(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg) {
        const obj = Object.create(this.prototype);
        obj.$connect_error = new PHPVariable(null);
        obj.$connect_errno = new PHPVariable(0);
        obj.$insert_id = new PHPVariable(0);
        obj.$affected_rows = new PHPVariable(0);
        obj.$error = new PHPVariable("");
        obj.$errno = new PHPVariable(0);
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
                connectTimeout: 5000,
                multipleStatements: true,
            });
            if (ctx && typeof ctx.registerCleanup === "function") {
                ctx.registerCleanup(async () => {
                    await this.close(ctx);
                });
            }
            this.$connect_error.set(null);
            this.$connect_errno.set(0);
            this.$error.set("");
            this.$errno.set(0);
            return true;
        }
        catch (err) {
            this.$connect_error.set(err.message);
            this.$connect_errno.set(err.errno || 1045);
            this.$error.set(err.message);
            this.$errno.set(err.errno || 1045);
            return false;
        }
    }
    async query(ctx, sqlArg) {
        if (!this.connection)
            return false;
        const sql = String(sqlArg?.get() ?? "");
        try {
            const [results] = await this.connection.query(sql);
            this.$error.set("");
            this.$errno.set(0);
            if (Array.isArray(results)) {
                if (results.length > 0 && !Array.isArray(results[0]) && typeof results[0] === "object" && results[0] !== null && "affectedRows" in results[0]) {
                    const lastHeader = results[results.length - 1];
                    this.$insert_id.set(lastHeader.insertId || 0);
                    this.$affected_rows.set(lastHeader.affectedRows || 0);
                    return true;
                }
                return new MySQLiResult(results);
            }
            else {
                this.$insert_id.set(results.insertId || 0);
                this.$affected_rows.set(results.affectedRows || 0);
                return true;
            }
        }
        catch (err) {
            this.$error.set(err.message);
            this.$errno.set(err.errno || 1064);
            return false;
        }
    }
    escape_string(ctx, strArg) {
        const str = String(strArg?.get() ?? "");
        if (!this.connection)
            return str.replace(/'/g, "\\'");
        return this.connection.escape(str).slice(1, -1);
    }
    real_escape_string(ctx, strArg) {
        return this.escape_string(ctx, strArg);
    }
    async select_db(ctx, dbArg) {
        if (!this.connection)
            return false;
        const db = String(dbArg?.get() ?? "");
        try {
            await this.connection.query(`USE \`${db}\``);
            return true;
        }
        catch {
            return false;
        }
    }
    async set_charset(ctx, charsetArg) {
        if (!this.connection)
            return false;
        const charset = String(charsetArg?.get() ?? "");
        try {
            await this.connection.query(`SET NAMES '${charset}'`);
            return true;
        }
        catch {
            return false;
        }
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
            mysqli_result: MySQLiResult,
        };
        this.functions = {
            mysqli_init: async (ctx) => await MySQLiObject.__$$__new(ctx),
            mysqli_connect: async (ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg) => {
                const conn = await MySQLiObject.__$$__new(ctx);
                const res = await conn.real_connect(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg);
                return res ? conn : false;
            },
            mysqli_real_connect: async (ctx, connArg, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg, flagsArg) => {
                const conn = connArg?.get();
                return conn ? await conn.real_connect(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg, flagsArg) : false;
            },
            mysqli_select_db: async (ctx, connArg, dbArg) => {
                const conn = connArg?.get();
                return conn ? await conn.select_db(ctx, dbArg) : false;
            },
            mysqli_set_charset: async (ctx, connArg, charsetArg) => {
                const conn = connArg?.get();
                return conn ? await conn.set_charset(ctx, charsetArg) : false;
            },
            mysqli_query: async (ctx, connArg, sqlArg) => {
                const conn = connArg?.get();
                return conn ? await conn.query(ctx, sqlArg) : false;
            },
            mysqli_report: (ctx, flagsArg) => true,
            mysqli_character_set_name: (ctx, connArg) => "utf8mb4",
            mysqli_fetch_assoc: (ctx, resultArg) => {
                const result = resultArg?.get();
                return result && typeof result.fetch_assoc === "function" ? result.fetch_assoc(ctx) : null;
            },
            mysqli_fetch_object: (ctx, resultArg, classArg, paramsArg) => {
                const result = resultArg?.get();
                return result && typeof result.fetch_object === "function" ? result.fetch_object(ctx, classArg, paramsArg) : null;
            },
            mysqli_fetch_field: (ctx, resultArg) => {
                const result = resultArg?.get();
                if (!result || !result.rows || result.rows.length === 0)
                    return false;
                const keys = Object.keys(result.rows[0]);
                if (result._fieldIndex === undefined)
                    result._fieldIndex = 0;
                if (result._fieldIndex >= keys.length)
                    return false;
                const colName = keys[result._fieldIndex++];
                return {
                    name: colName,
                    orgname: colName,
                    table: "",
                    orgtable: "",
                    def: "",
                    db: "",
                    catalog: "def",
                    max_length: 0,
                    length: 255,
                    charsetnr: 33,
                    flags: 0,
                    type: 253,
                    decimals: 0,
                };
            },
            mysqli_fetch_array: (ctx, resultArg, resulttypeArg) => {
                const result = resultArg?.get();
                return result && typeof result.fetch_array === "function" ? result.fetch_array(ctx, resulttypeArg) : null;
            },
            mysqli_fetch_row: (ctx, resultArg) => {
                const result = resultArg?.get();
                return result && typeof result.fetch_row === "function" ? result.fetch_row(ctx) : null;
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
                return conn ? conn.$error.get() : "";
            },
            mysqli_connect_errno: (ctx) => 0,
            mysqli_connect_error: (ctx) => "",
            mysqli_errno: (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? conn.$errno.get() : 0;
            },
            mysqli_sqlstate: (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? (conn.$errno.get() ? "HY000" : "00000") : "00000";
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
                return conn ? conn.$insert_id.get() : 0;
            },
            mysqli_affected_rows: (ctx, connArg) => {
                const conn = connArg?.get();
                return conn ? conn.$affected_rows.get() : 0;
            },
            mysqli_ping: (ctx, connArg) => true,
            mysqli_autocommit: (ctx, connArg, modeArg) => true,
            mysqli_commit: (ctx, connArg) => true,
            mysqli_rollback: (ctx, connArg) => true,
        };
    }
}
//# sourceMappingURL=mysqli.js.map