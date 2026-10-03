import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";

export class PDOConnection {
  public connection?: mysql.Connection;

  public async connect(dsn: string, username = "", password = ""): Promise<boolean> {
    const hostMatch = dsn.match(/host=([^;]+)/);
    const dbMatch = dsn.match(/dbname=([^;]+)/);
    const portMatch = dsn.match(/port=([^;]+)/);

    const host = hostMatch ? hostMatch[1] : "127.0.0.1";
    const database = dbMatch ? dbMatch[1] : "";
    const port = portMatch ? parseInt(portMatch[1], 10) : 3306;

    this.connection = await mysql.createConnection({ host, user: username, password, database, port });
    return true;
  }

  public async exec(sql: string): Promise<number> {
    if (!this.connection) return 0;
    const [res] = await this.connection.query(sql);
    return (res as any).affectedRows || 0;
  }

  public async query(sql: string): Promise<any[]> {
    if (!this.connection) return [];
    const [rows] = await this.connection.query(sql);
    return rows as any[];
  }
}

export class PDOExtension extends PHPExtension {
  public readonly name = "pdo";

  public onInit(engine: PHPEngine): void {
    this.constants = {
      pdo_attr_errmode: 3,
      pdo_errmode_exception: 2,
      pdo_fetch_assoc: 2,
    };
  }
}
