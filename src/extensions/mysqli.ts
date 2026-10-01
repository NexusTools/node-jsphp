import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";
import { PHPObject, PHPClass } from "../runtime/PHPObject";

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
    host = "127.0.0.1",
    user = "root",
    password = "",
    database = "",
    port = 3306,
    socket = "",
    flags = 0
  ): Promise<boolean> {
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
      this.connection = await mysql.createConnection({
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
    } catch (err: any) {
      this.connect_error = err.message;
      this.connect_errno = err.errno || 1045;
      this.error = err.message;
      this.errno = err.errno || 1045;
      return false;
    }
  }

  public async query(sql: string): Promise<MySQLiResult | boolean> {
    if (!this.connection) return false;
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

  public escape_string(str: string): string {
    if (!this.connection) return String(str ?? "").replace(/'/g, "\\'");
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
      mysqli: MySQLiObject as any,
    };

    this.functions = {
      mysqli_init: (ctx: PHPContext) => new MySQLiObject(),
      mysqli_report: (ctx: PHPContext, flags = 0) => true,
      mysqli_connect: async (ctx: PHPContext, host?: string, user?: string, pass?: string, db?: string, port?: number) => {
        const conn = new MySQLiObject();
        await conn.real_connect(host, user, pass, db, port);
        return conn;
      },
      mysqli_real_connect: async (
        ctx: PHPContext,
        conn: MySQLiObject,
        host?: string,
        user?: string,
        pass?: string,
        db?: string,
        port?: number,
        socket?: string,
        flags?: number
      ) => {
        if (!conn) return false;
        return await conn.real_connect(host, user, pass, db, port, socket, flags);
      },
      mysqli_options: (ctx: PHPContext, conn: MySQLiObject, option: number, value: any) => true,
      mysqli_select_db: async (ctx: PHPContext, conn: MySQLiObject, dbname: string) => {
        if (!conn || !conn.connection) return false;
        try {
          await conn.connection.query(`USE \`${dbname}\``);
          return true;
        } catch {
          return false;
        }
      },
      mysqli_set_charset: async (ctx: PHPContext, conn: MySQLiObject, charset: string) => {
        if (!conn || !conn.connection) return false;
        try {
          await conn.connection.query(`SET NAMES '${charset}'`);
          return true;
        } catch {
          return false;
        }
      },
      mysqli_query: async (ctx: PHPContext, conn: MySQLiObject, sql: string) => {
        return conn ? await conn.query(sql) : false;
      },
      mysqli_fetch_assoc: (ctx: PHPContext, result: MySQLiResult) => {
        return result ? result.fetch_assoc() : null;
      },
      mysqli_real_escape_string: (ctx: PHPContext, conn: MySQLiObject, str: string) => {
        return conn ? conn.escape_string(str) : str;
      },
      mysqli_close: async (ctx: PHPContext, conn: MySQLiObject) => {
        return conn ? await conn.close() : true;
      },
      mysqli_error: (ctx: PHPContext, conn: MySQLiObject) => {
        return conn ? conn.error : "";
      },
      mysqli_connect_errno: (ctx: PHPContext) => 0,
      mysqli_connect_error: (ctx: PHPContext) => "",
      mysqli_errno: (ctx: PHPContext, conn: MySQLiObject) => conn ? conn.connect_errno : 0,
      mysqli_sqlstate: (ctx: PHPContext, conn: MySQLiObject) => conn ? (conn.connect_errno ? "HY000" : "00000") : "00000",
      mysqli_free_result: (ctx: PHPContext, res: any) => true,
      mysqli_more_results: (ctx: PHPContext, conn: any) => false,
      mysqli_next_result: (ctx: PHPContext, conn: any) => false,
    };
  }
}
