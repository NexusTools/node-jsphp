import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPObject } from "../runtime/PHPObject.js";
import { PHPReference } from "../runtime/PHPVariable.js";
export declare class MySQLiResult {
    rows: any[];
    index: number;
    num_rows: number;
    constructor(rows: any[]);
    fetch_assoc(): any | null;
    fetch_row(): any[] | null;
    fetch_array(resulttype?: number): any;
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
    real_connect(hostArg?: PHPReference, userArg?: PHPReference, passwordArg?: PHPReference, databaseArg?: PHPReference, portArg?: PHPReference, socketArg?: PHPReference, flagsArg?: PHPReference): Promise<boolean>;
    query(sqlArg?: PHPReference): Promise<MySQLiResult | boolean>;
    escape_string(strArg?: PHPReference): string;
    close(): Promise<boolean>;
}
export declare class MySQLiExtension extends PHPExtension {
    readonly name = "mysqli";
    onInit(engine: PHPEngine): void;
}
