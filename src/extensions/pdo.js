import mysql from "mysql2/promise";
import { PHPExtension } from "../PHPExtension.js";
export class PDOConnection {
    connection;
    async connect(dsn, username = "", password = "") {
        const hostMatch = dsn.match(/host=([^;]+)/);
        const dbMatch = dsn.match(/dbname=([^;]+)/);
        const portMatch = dsn.match(/port=([^;]+)/);
        const host = hostMatch ? hostMatch[1] : "127.0.0.1";
        const database = dbMatch ? dbMatch[1] : "";
        const port = portMatch ? parseInt(portMatch[1], 10) : 3306;
        this.connection = await mysql.createConnection({ host, user: username, password, database, port });
        return true;
    }
    async exec(sql) {
        if (!this.connection)
            return 0;
        const [res] = await this.connection.query(sql);
        return res.affectedRows || 0;
    }
    async query(sql) {
        if (!this.connection)
            return [];
        const [rows] = await this.connection.query(sql);
        return rows;
    }
}
export class PDOExtension extends PHPExtension {
    name = "pdo";
    onInit(engine) {
        this.constants = {
            pdo_attr_errmode: 3,
            pdo_errmode_exception: 2,
            pdo_fetch_assoc: 2,
        };
    }
}
//# sourceMappingURL=pdo.js.map