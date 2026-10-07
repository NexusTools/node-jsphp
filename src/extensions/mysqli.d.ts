import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";
export declare class MySQLiResult {
    rows: any[];
    index: number;
    $num_rows: PHPReference;
    constructor(rows: any[]);
    get num_rows(): number;
    fetch_assoc(ctx?: any): any | null;
    fetch_row(ctx?: any): any[] | null;
    fetch_array(ctx?: any, resulttypeArg?: any): any;
    fetch_object(ctx?: any, classArg?: any, paramsArg?: any): any;
    fetch_all(ctx?: any, resulttypeArg?: any): any[];
    free(): void;
    free_result(): void;
    close(): void;
    data_seek(ctx?: any, offsetArg?: any): boolean;
}
export declare class MySQLiObject {
    connection?: mysql.Connection;
    $connect_error: PHPReference;
    $connect_errno: PHPReference;
    $insert_id: PHPReference;
    $affected_rows: PHPReference;
    $error: PHPReference;
    $errno: PHPReference;
    static __$$__new(ctx: PHPContext, hostArg?: PHPReference, userArg?: PHPReference, passwordArg?: PHPReference, databaseArg?: PHPReference, portArg?: PHPReference, socketArg?: PHPReference): Promise<MySQLiObject>;
    __construct(ctx: PHPContext, hostArg?: PHPReference, userArg?: PHPReference, passwordArg?: PHPReference, databaseArg?: PHPReference, portArg?: PHPReference, socketArg?: PHPReference): Promise<void>;
    real_connect(ctx: PHPContext, hostArg?: PHPReference, userArg?: PHPReference, passwordArg?: PHPReference, databaseArg?: PHPReference, portArg?: PHPReference, socketArg?: PHPReference, flagsArg?: PHPReference): Promise<boolean>;
    query(ctx: PHPContext, sqlArg?: PHPReference): Promise<MySQLiResult | boolean>;
    escape_string(ctx: PHPContext, strArg?: PHPReference): string;
    real_escape_string(ctx: PHPContext, strArg?: PHPReference): string;
    select_db(ctx: PHPContext, dbArg?: PHPReference): Promise<boolean>;
    set_charset(ctx: PHPContext, charsetArg?: PHPReference): Promise<boolean>;
    close(ctx?: PHPContext): Promise<boolean>;
}
export declare class MySQLiExtension extends PHPExtension {
    readonly name = "mysqli";
    onInit(engine: PHPEngine): void;
}
