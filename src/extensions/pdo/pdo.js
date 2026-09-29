"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDOExtension = exports.PDOConnection = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const PHPExtension_1 = require("../../PHPExtension");
class PDOConnection {
    connection;
    async connect(dsn, username = "", password = "") {
        // Parse MySQL DSN format: mysql:host=localhost;dbname=test;port=3306
        const hostMatch = dsn.match(/host=([^;]+)/);
        const dbMatch = dsn.match(/dbname=([^;]+)/);
        const portMatch = dsn.match(/port=([^;]+)/);
        const host = hostMatch ? hostMatch[1] : "127.0.0.1";
        const database = dbMatch ? dbMatch[1] : "";
        const port = portMatch ? parseInt(portMatch[1], 10) : 3306;
        this.connection = await promise_1.default.createConnection({ host, user: username, password, database, port });
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
exports.PDOConnection = PDOConnection;
class PDOExtension extends PHPExtension_1.PHPExtension {
    name = "pdo";
    onInit(engine) {
        this.constants = {
            PDO_ATTR_ERRMODE: 3,
            PDO_ERRMODE_EXCEPTION: 2,
            PDO_FETCH_ASSOC: 2,
        };
    }
}
exports.PDOExtension = PDOExtension;
//# sourceMappingURL=pdo.js.map