import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPObject } from "../runtime/PHPObject";
export declare class MySQLiResult {
    rows: any[];
    index: number;
    num_rows: number;
    constructor(rows: any[]);
    fetch_assoc(): any | null;
    fetch_row(): any[] | null;
}
export declare class MySQLiObject extends PHPObject {
    connection?: mysql.Connection;
    connect_error: string | null;
    connect_errno: number;
    insert_id: number;
    affected_rows: number;
    error: string;
    errno: number;
    constructor();
    real_connect(host?: string, user?: string, password?: string, database?: string, port?: number, socket?: string, flags?: number): Promise<boolean>;
    query(sql: string): Promise<MySQLiResult | boolean>;
    escape_string(str: string): string;
    close(): Promise<boolean>;
}
export declare class MySQLiExtension extends PHPExtension {
    readonly name = "mysqli";
    onInit(engine: PHPEngine): void;
}
