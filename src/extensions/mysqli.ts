import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPObject, PHPClass } from "../runtime/PHPObject.js";
import { PHPVariable, PHPReference } from "../runtime/PHPVariable.js";

export class MySQLiResult {
  public rows: any[];
  public index: number = 0;
  public num_rows: number;

  constructor(rows: any[]) {
    this.rows = rows || [];
    this.num_rows = this.rows.length;
  }

  public fetch_assoc(): any | null {
    if (this.index >= this.rows.length) return null;
    return this.rows[this.index++];
  }

  public fetch_row(): any[] | null {
    if (this.index >= this.rows.length) return null;
    const row = this.rows[this.index++];
    return Object.values(row);
  }

  public fetch_array(resulttype = 3): any {
    if (this.index >= this.rows.length) return null;
    const row = this.rows[this.index++];
    if (resulttype === 1) {
      return Object.values(row);
    }
    if (resulttype === 2) {
      return { ...row };
    }
    const res: any = { ...row };
    Object.values(row).forEach((v, i) => { res[i] = v; });
    return res;
  }
}

export class MySQLiObject extends PHPObject {
  public connection?: mysql.Connection;
  public connect_error: string | null = null;
  public connect_errno: number = 0;
  public insert_id: number = 0;
  public affected_rows: number = 0;
  public error: string = "";
  public errno: number = 0;

  constructor() {
    super(new PHPClass("mysqli"));
  }

  public async real_connect(
    hostArg?: PHPReference,
    userArg?: PHPReference,
    passwordArg?: PHPReference,
    databaseArg?: PHPReference,
    portArg?: PHPReference,
    socketArg?: PHPReference,
    flagsArg?: PHPReference
  ): Promise<boolean> {
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
      this.connect_error = null;
      this.connect_errno = 0;
      this.error = "";
      this.errno = 0;
      return true;
    } catch (err: any) {
      console.error("MYSQL CONNECT ERR:", err);
      this.connect_error = err.message;
      this.connect_errno = err.errno || 1045;
      this.error = err.message;
      this.errno = err.errno || 1045;
      return false;
    }
  }

  public async query(sqlArg?: PHPReference): Promise<MySQLiResult | boolean> {
    if (!this.connection) return false;
    const sql = String(sqlArg?.get() ?? "");
    try {
      const [results] = await this.connection.query(sql);
      if (Array.isArray(results)) {
        return new MySQLiResult(results);
      } else {
        this.insert_id = (results as any).insertId || 0;
        this.affected_rows = (results as any).affectedRows || 0;
        return true;
      }
    } catch (err: any) {
      this.error = err.message;
      this.errno = err.errno || 1064;
      return false;
    }
  }

  public escape_string(strArg?: PHPReference): string {
    const str = String(strArg?.get() ?? "");
    if (!this.connection) return str.replace(/'/g, "\\'");
    return this.connection.escape(str).slice(1, -1);
  }

  public async close(): Promise<boolean> {
    if (this.connection) {
      await this.connection.end();
      this.connection = undefined;
    }
    return true;
  }
}

export class MySQLiExtension extends PHPExtension {
  public readonly name = "mysqli";

  public onInit(engine: PHPEngine): void {
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
      mysqli: MySQLiObject as any,
    };

    this.functions = {
      mysqli_init: (ctx: PHPContext) => new MySQLiObject(),
      mysqli_report: (ctx: PHPContext, flags?: PHPReference) => true,
      mysqli_connect: async (ctx: PHPContext, host?: PHPReference, user?: PHPReference, pass?: PHPReference, db?: PHPReference, port?: PHPReference) => {
        const conn = new MySQLiObject();
        await conn.real_connect(host, user, pass, db, port);
        return conn;
      },
      mysqli_real_connect: async (
        ctx: PHPContext,
        connArg?: PHPReference,
        host?: PHPReference,
        user?: PHPReference,
        pass?: PHPReference,
        db?: PHPReference,
        port?: PHPReference,
        socket?: PHPReference,
        flags?: PHPReference
      ) => {
        const conn = connArg?.get();
        if (!conn) return false;
        return await conn.real_connect(host, user, pass, db, port, socket, flags);
      },
      mysqli_options: (ctx: PHPContext, connArg?: PHPReference, option?: PHPReference, value?: PHPReference) => true,
      mysqli_select_db: async (ctx: PHPContext, connArg?: PHPReference, dbnameArg?: PHPReference) => {
        const conn = connArg?.get();
        const dbname = String(dbnameArg?.get() ?? "");
        if (!conn || !conn.connection) return false;
        try {
          await conn.connection.query(`USE \`${dbname}\``);
          return true;
        } catch {
          return false;
        }
      },
      mysqli_set_charset: async (ctx: PHPContext, connArg?: PHPReference, charsetArg?: PHPReference) => {
        const conn = connArg?.get();
        const charset = String(charsetArg?.get() ?? "");
        if (!conn || !conn.connection) return false;
        try {
          await conn.connection.query(`SET NAMES '${charset}'`);
          return true;
        } catch {
          return false;
        }
      },
      mysqli_query: async (ctx: PHPContext, connArg?: PHPReference, sqlArg?: PHPReference) => {
        const conn = connArg?.get();
        return conn ? await conn.query(sqlArg) : false;
      },
      mysqli_fetch_assoc: (ctx: PHPContext, resultArg?: PHPReference) => {
        const result = resultArg?.get();
        return result && typeof result.fetch_assoc === "function" ? result.fetch_assoc() : null;
      },
      mysqli_fetch_array: (ctx: PHPContext, resultArg?: PHPReference, resulttypeArg?: PHPReference) => {
        const result = resultArg?.get();
        const type = Number(resulttypeArg?.get()) || 3;
        return result && typeof result.fetch_array === "function" ? result.fetch_array(type) : null;
      },
      mysqli_fetch_row: (ctx: PHPContext, resultArg?: PHPReference) => {
        const result = resultArg?.get();
        return result && typeof result.fetch_row === "function" ? result.fetch_row() : null;
      },
      mysqli_real_escape_string: (ctx: PHPContext, connArg?: PHPReference, strArg?: PHPReference) => {
        const conn = connArg?.get();
        return conn ? conn.escape_string(strArg) : String(strArg?.get() ?? "");
      },
      mysqli_close: async (ctx: PHPContext, connArg?: PHPReference) => {
        const conn = connArg?.get();
        return conn ? await conn.close() : true;
      },
      mysqli_error: (ctx: PHPContext, connArg?: PHPReference) => {
        const conn = connArg?.get();
        return conn ? conn.error : "";
      },
      mysqli_connect_errno: (ctx: PHPContext) => 0,
      mysqli_connect_error: (ctx: PHPContext) => "",
      mysqli_errno: (ctx: PHPContext, connArg?: PHPReference) => {
        const conn = connArg?.get();
        return conn ? conn.connect_errno : 0;
      },
      mysqli_sqlstate: (ctx: PHPContext, connArg?: PHPReference) => {
        const conn = connArg?.get();
        return conn ? (conn.connect_errno ? "HY000" : "00000") : "00000";
      },
      mysqli_free_result: (ctx: PHPContext, res?: PHPReference) => true,
      mysqli_more_results: (ctx: PHPContext, conn?: PHPReference) => false,
      mysqli_next_result: (ctx: PHPContext, conn?: PHPReference) => false,
      mysqli_get_server_info: (ctx: PHPContext, connArg?: PHPReference) => "8.0.35-MySQL",
      mysqli_get_server_version: (ctx: PHPContext, connArg?: PHPReference) => 80035,
      mysqli_get_client_info: (ctx: PHPContext) => "mysqlnd 8.0.35",
      mysqli_get_client_version: (ctx: PHPContext) => 80035,
      mysqli_num_rows: (ctx: PHPContext, resultArg?: PHPReference) => {
        const result = resultArg?.get();
        return result ? result.num_rows || 0 : 0;
      },
      mysqli_num_fields: (ctx: PHPContext, resultArg?: PHPReference) => {
        const result = resultArg?.get();
        return (result && result.rows && result.rows.length > 0) ? Object.keys(result.rows[0]).length : 0;
      },
      mysqli_insert_id: (ctx: PHPContext, connArg?: PHPReference) => {
        const conn = connArg?.get();
        return conn ? conn.insert_id || 0 : 0;
      },
      mysqli_affected_rows: (ctx: PHPContext, connArg?: PHPReference) => {
        const conn = connArg?.get();
        return conn ? conn.affected_rows || 0 : 0;
      },
      mysqli_ping: (ctx: PHPContext, connArg?: PHPReference) => true,
      mysqli_autocommit: (ctx: PHPContext, connArg?: PHPReference, modeArg?: PHPReference) => true,
      mysqli_commit: (ctx: PHPContext, connArg?: PHPReference) => true,
      mysqli_rollback: (ctx: PHPContext, connArg?: PHPReference) => true,
    };
  }
}
