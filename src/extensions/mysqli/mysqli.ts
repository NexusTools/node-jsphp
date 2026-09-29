import mysql from "mysql2/promise";
import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
import { PHPContext } from "../../PHPContext";

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

export class MySQLiConnection {
  public connection?: mysql.Connection;
  public connect_error: string | null = null;
  public connect_errno: number = 0;
  public insert_id: number = 0;
  public affected_rows: number = 0;
  public error: string = "";

  public async connect(host = "127.0.0.1", user = "root", password = "", database = "", port = 3306): Promise<boolean> {
    try {
      this.connection = await mysql.createConnection({ host, user, password, database, port });
      return true;
    } catch (err: any) {
      this.connect_error = err.message;
      this.connect_errno = err.errno || 1045;
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
      return false;
    }
  }

  public escape_string(str: string): string {
    if (!this.connection) return str.replace(/'/g, "\\'");
    return this.connection.escape(str).slice(1, -1);
  }

  public async close(): Promise<boolean> {
    if (this.connection) {
      await this.connection.end();
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
    };

    this.functions = {
      mysqli_connect: async (ctx: PHPContext, host?: string, user?: string, pass?: string, db?: string, port?: number) => {
        const conn = new MySQLiConnection();
        await conn.connect(host, user, pass, db, port);
        return conn;
      },
      mysqli_query: async (ctx: PHPContext, conn: MySQLiConnection, sql: string) => {
        return await conn.query(sql);
      },
      mysqli_fetch_assoc: (ctx: PHPContext, result: MySQLiResult) => {
        return result ? result.fetch_assoc() : null;
      },
      mysqli_real_escape_string: (ctx: PHPContext, conn: MySQLiConnection, str: string) => {
        return conn ? conn.escape_string(str) : str;
      },
      mysqli_error: (ctx: PHPContext, conn: MySQLiConnection) => {
        return conn ? conn.error : "";
      },
      mysqli_insert_id: (ctx: PHPContext, conn: MySQLiConnection) => {
        return conn ? conn.insert_id : 0;
      },
      mysqli_close: async (ctx: PHPContext, conn: MySQLiConnection) => {
        return conn ? await conn.close() : true;
      },
    };
  }
}
