import mysql from "mysql2/promise";
import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
export declare class PDOConnection {
    connection?: mysql.Connection;
    connect(dsn: string, username?: string, password?: string): Promise<boolean>;
    exec(sql: string): Promise<number>;
    query(sql: string): Promise<any[]>;
}
export declare class PDOExtension extends PHPExtension {
    readonly name = "pdo";
    onInit(engine: PHPEngine): void;
}
