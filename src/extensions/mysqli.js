import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_NEW } from "../runtime/Reflection.js";
export class MySQLiResult {
    static [SYMBOL_PHP_NAME] = "mysqli_result";
    rows;
    index = 0;
    $num_rows;
    static async [SYMBOL_PHP_NEW](ctx, rowsArg) {
        const obj = Object.create(this.prototype);
        obj.rows = [];
        obj.index = 0;
        obj.$num_rows = new PHPVariable(0);
        await obj.__construct(ctx, rowsArg);
        return obj;
    }
    async __construct(ctx, rowsArg) {
        this.rows = (await rowsArg?.get()) || [];
        await this.$num_rows.set(this.rows.length);
    }
    get num_rows() {
        return this.rows.length;
    }
    async fetch_assoc(ctx) {
        if (this.index >= this.rows.length)
            return null;
        return this.rows[this.index++];
    }
    async fetch_row(ctx) {
        if (this.index >= this.rows.length)
            return null;
        const row = this.rows[this.index++];
        return Object.values(row);
    }
    async fetch_array(ctx, resulttypeArg) {
        if (this.index >= this.rows.length)
            return null;
        let resulttype = 3;
        if (resulttypeArg !== undefined) {
            const val = resulttypeArg instanceof PHPReference ? await resulttypeArg.get() : resulttypeArg;
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
    async fetch_object(ctx, classArg, paramsArg) {
        if (this.index >= this.rows.length)
            return null;
        const row = this.rows[this.index++];
        const obj = {};
        for (const [k, v] of Object.entries(row)) {
            obj[k] = v;
        }
        return obj;
    }
    async fetch_all(ctx, resulttypeArg) {
        const type = resulttypeArg ? (resulttypeArg instanceof PHPReference ? await resulttypeArg.get() : resulttypeArg) : 1;
        const all = [];
        while (this.index < this.rows.length) {
            if (type === 1)
                all.push(await this.fetch_assoc(ctx));
            else if (type === 2)
                all.push(await this.fetch_row(ctx));
            else
                all.push(await this.fetch_array(ctx, new PHPLiteral(type)));
        }
        return all;
    }
    free() { }
    free_result() { }
    close() { }
    async data_seek(ctx, offsetArg) {
        const offset = Number(offsetArg instanceof PHPReference ? await offsetArg.get() : offsetArg) || 0;
        if (offset >= 0 && offset < this.rows.length) {
            this.index = offset;
            return true;
        }
        return false;
    }
}
export class MySQLiObject {
    static [SYMBOL_PHP_NAME] = "mysqli";
    connection;
    $connect_error = new PHPVariable(null);
    $connect_errno = new PHPVariable(0);
    $insert_id = new PHPVariable(0);
    $affected_rows = new PHPVariable(0);
    $error = new PHPVariable("");
    $errno = new PHPVariable(0);
    static async [SYMBOL_PHP_NEW](ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg) {
        const obj = Object.create(this.prototype);
        MySQLiExtension.activeObjects.add(obj);
        obj.$connect_error = new PHPVariable(null);
        obj.$connect_errno = new PHPVariable(0);
        obj.$insert_id = new PHPVariable(0);
        obj.$affected_rows = new PHPVariable(0);
        obj.$error = new PHPVariable("");
        obj.$errno = new PHPVariable(0);
        await obj.__construct(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg);
        return obj;
    }
    async __construct(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg) {
        if (hostArg || userArg || passwordArg || databaseArg) {
            await this.real_connect(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg);
        }
    }
    async real_connect(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg, flagsArg) {
        let actualHost = String(await hostArg?.get() ?? "127.0.0.1") || "127.0.0.1";
        let user = String(await userArg?.get() ?? "root") || "root";
        let password = String(await passwordArg?.get() ?? "");
        let database = String(await databaseArg?.get() ?? "");
        let actualPort = Number(await portArg?.get()) || 3306;
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
            await this.$connect_error.set(null);
            await this.$connect_errno.set(0);
            await this.$error.set("");
            await this.$errno.set(0);
            return true;
        }
        catch (err) {
            await this.$connect_error.set(err.message);
            await this.$connect_errno.set(err.errno || 1045);
            await this.$error.set(err.message);
            await this.$errno.set(err.errno || 1045);
            return false;
        }
    }
    async query(ctx, sqlArg) {
        if (!this.connection)
            return false;
        const sql = String(await sqlArg?.get() ?? "");
        try {
            const [results] = await this.connection.query(sql);
            await this.$error.set("");
            await this.$errno.set(0);
            if (Array.isArray(results)) {
                const isSelectQuery = /^\s*(select|show|describe|desc|explain)\s/i.test(sql);
                if (!isSelectQuery) {
                    const lastHeader = Array.isArray(results[0]) ? results[0][results[0].length - 1] : results[results.length - 1];
                    if (lastHeader && typeof lastHeader === "object") {
                        await this.$insert_id.set(lastHeader.insertId || 0);
                        await this.$affected_rows.set(lastHeader.affectedRows || 0);
                    }
                    return true;
                }
                return await MySQLiResult[SYMBOL_PHP_NEW](ctx, new PHPVariable(results));
            }
            else {
                await this.$insert_id.set(results.insertId || 0);
                await this.$affected_rows.set(results.affectedRows || 0);
                return true;
            }
        }
        catch (err) {
            await this.$error.set(err.message);
            await this.$errno.set(err.errno || 1064);
            return false;
        }
    }
    async escape_string(ctx, strArg) {
        const str = await ctx.str(await strArg?.get());
        if (!this.connection)
            return str.replace(/'/g, "\\'");
        return this.connection.escape(str).slice(1, -1);
    }
    async real_escape_string(ctx, strArg) {
        return this.escape_string(ctx, strArg);
    }
    async select_db(ctx, dbArg) {
        if (!this.connection)
            return false;
        const db = String(await dbArg?.get() ?? "");
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
        const charset = String(await charsetArg?.get() ?? "");
        try {
            await this.connection.query(`SET NAMES '${charset}'`);
            return true;
        }
        catch {
            return false;
        }
    }
    async close(ctx) {
        MySQLiExtension.activeObjects.delete(this);
        if (this.connection) {
            try {
                if (this.connection.stream) {
                    this.connection.stream.destroy();
                }
                await this.connection.end();
            }
            catch {
                try {
                    this.connection.destroy();
                }
                catch { }
            }
            this.connection = undefined;
        }
        return true;
    }
}
export class MySQLiExtension extends PHPExtension {
    name = "mysqli";
    static activeObjects = new Set();
    async onClose(engine) {
        for (const obj of Array.from(MySQLiExtension.activeObjects)) {
            try {
                await obj.close();
            }
            catch { }
        }
        MySQLiExtension.activeObjects.clear();
    }
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
            mysqli_init: async (ctx) => await MySQLiObject[SYMBOL_PHP_NEW](ctx),
            mysqli_connect: async (ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg) => {
                const conn = await MySQLiObject[SYMBOL_PHP_NEW](ctx);
                const res = await conn.real_connect(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg);
                return res ? conn : false;
            },
            mysqli_real_connect: async (ctx, connArg, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg, flagsArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.real_connect(ctx, hostArg, userArg, passwordArg, databaseArg, portArg, socketArg, flagsArg) : false;
            },
            mysqli_select_db: async (ctx, connArg, dbArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.select_db(ctx, dbArg) : false;
            },
            mysqli_set_charset: async (ctx, connArg, charsetArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.set_charset(ctx, charsetArg) : false;
            },
            mysqli_query: async (ctx, connArg, sqlArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.query(ctx, sqlArg) : false;
            },
            mysqli_report: async (ctx, flagsArg) => true,
            mysqli_character_set_name: async (ctx, connArg) => "utf8mb4",
            mysqli_fetch_assoc: async (ctx, resultArg) => {
                const result = await resultArg?.get();
                return result && typeof result.fetch_assoc === "function" ? await result.fetch_assoc(ctx) : null;
            },
            mysqli_fetch_object: async (ctx, resultArg, classArg, paramsArg) => {
                const result = await resultArg?.get();
                return result && typeof result.fetch_object === "function" ? await result.fetch_object(ctx, classArg, paramsArg) : null;
            },
            mysqli_fetch_field: async (ctx, resultArg) => {
                const result = await resultArg?.get();
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
            mysqli_fetch_array: async (ctx, resultArg, resulttypeArg) => {
                const result = await resultArg?.get();
                return result && typeof result.fetch_array === "function" ? await result.fetch_array(ctx, resulttypeArg) : null;
            },
            mysqli_fetch_row: async (ctx, resultArg) => {
                const result = await resultArg?.get();
                return result && typeof result.fetch_row === "function" ? await result.fetch_row(ctx) : null;
            },
            mysqli_real_escape_string: async (ctx, connArg, strArg) => {
                const conn = await connArg?.get();
                return conn ? conn.escape_string(ctx, strArg) : String(await strArg?.get() ?? "");
            },
            mysqli_close: async (ctx, connArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.close(ctx) : true;
            },
            mysqli_error: async (ctx, connArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.$error.get() : "";
            },
            mysqli_connect_errno: async (ctx) => 0,
            mysqli_connect_error: async (ctx) => "",
            mysqli_errno: async (ctx, connArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.$errno.get() : 0;
            },
            mysqli_sqlstate: async (ctx, connArg) => {
                const conn = await connArg?.get();
                return conn ? (await conn.$errno.get() ? "HY000" : "00000") : "00000";
            },
            mysqli_free_result: async (ctx, res) => true,
            mysqli_more_results: async (ctx, conn) => false,
            mysqli_next_result: async (ctx, conn) => false,
            mysqli_get_server_info: async (ctx, connArg) => "8.0.35-MySQL",
            mysqli_get_server_version: async (ctx, connArg) => 80035,
            mysqli_get_client_info: async (ctx) => "mysqlnd 8.0.35",
            mysqli_get_client_version: async (ctx) => 80035,
            mysqli_num_rows: async (ctx, resultArg) => {
                const result = await resultArg?.get();
                return result ? result.num_rows || 0 : 0;
            },
            mysqli_num_fields: async (ctx, resultArg) => {
                const result = await resultArg?.get();
                return (result && result.rows && result.rows.length > 0) ? Object.keys(result.rows[0]).length : 0;
            },
            mysqli_insert_id: async (ctx, connArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.$insert_id.get() : 0;
            },
            mysqli_affected_rows: async (ctx, connArg) => {
                const conn = await connArg?.get();
                return conn ? await conn.$affected_rows.get() : 0;
            },
            mysqli_ping: async (ctx, connArg) => true,
            mysqli_autocommit: async (ctx, connArg, modeArg) => true,
            mysqli_commit: async (ctx, connArg) => true,
            mysqli_rollback: async (ctx, connArg) => true,
        };
    }
}
//# sourceMappingURL=mysqli.js.map