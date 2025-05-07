"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const pg_1 = require("pg");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const file_utils_1 = require("../utils/file-utils");
const config_1 = require("../config/config");
// JSON数据库路径
const JSON_DB_PATH = path_1.default.join(process.cwd(), 'data', 'database', 'langchain.json');
/**
 * 数据库服务类
 */
class DatabaseService {
    /**
     * 构造函数
     * @param dbType 数据库类型
     */
    constructor(dbType = 'memory') {
        this.pgClient = null;
        this.memoryDb = {};
        this.dbType = dbType;
    }
    /**
     * 初始化数据库连接
     */
    async init() {
        if (this.dbType === 'postgres') {
            await this.initPostgres();
        }
        else if (this.dbType === 'json') {
            await this.initJsonDb();
        }
        else {
            // 内存数据库不需要初始化
            console.log('内存数据库已准备好');
        }
    }
    /**
     * 初始化PostgreSQL连接
     */
    async initPostgres() {
        try {
            this.pgClient = new pg_1.Client({
                host: config_1.env.DB_HOST,
                port: config_1.env.DB_PORT,
                user: config_1.env.DB_USER,
                password: config_1.env.DB_PASSWORD,
                database: config_1.env.DB_NAME,
            });
            await this.pgClient.connect();
            console.log('PostgreSQL数据库连接成功');
        }
        catch (error) {
            console.error('PostgreSQL数据库连接失败:', error);
            throw error;
        }
    }
    /**
     * 初始化JSON文件数据库
     */
    async initJsonDb() {
        try {
            // 确保数据库目录存在
            const dbDir = path_1.default.dirname(JSON_DB_PATH);
            (0, file_utils_1.ensureDirectoryExists)(dbDir);
            // 如果JSON文件存在则读取
            if (fs_1.default.existsSync(JSON_DB_PATH)) {
                const content = fs_1.default.readFileSync(JSON_DB_PATH, 'utf-8');
                this.memoryDb = JSON.parse(content);
            }
            else {
                // 创建新的JSON文件
                fs_1.default.writeFileSync(JSON_DB_PATH, JSON.stringify(this.memoryDb, null, 2));
            }
            console.log('JSON数据库初始化成功');
        }
        catch (error) {
            console.error('JSON数据库初始化失败:', error);
            throw error;
        }
    }
    /**
     * 执行SQL查询 (简化版，仅支持基本查询)
     * @param query SQL查询语句
     * @param params 查询参数
     * @returns 查询结果
     */
    async query(query, params = []) {
        if (this.dbType === 'postgres') {
            if (!this.pgClient) {
                throw new Error('PostgreSQL客户端未初始化');
            }
            const result = await this.pgClient.query(query, params);
            return result.rows;
        }
        else {
            // 简化版内存/JSON数据库查询处理
            // 仅支持基本操作，实际应用中需要一个SQL解析器
            const selectMatch = query.match(/SELECT\s+(.*?)\s+FROM\s+(.*?)(?:\s+WHERE\s+(.*?))?(?:\s+ORDER BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?(?:\s*;)?$/i);
            if (selectMatch) {
                const [, columns, table, whereClause] = selectMatch;
                const tableName = table.trim();
                // 确保表存在
                if (!this.memoryDb[tableName]) {
                    this.memoryDb[tableName] = [];
                }
                let result = [...this.memoryDb[tableName]];
                // 简单的WHERE子句处理 (非常基础的实现)
                if (whereClause) {
                    result = result.filter(row => {
                        // 这里只是一个极其简单的示例，实际应该使用SQL解析器
                        // 假设格式为: column = value
                        const conditions = whereClause.split(/\s+AND\s+/i);
                        return conditions.every(condition => {
                            const [colName, operator, value] = condition.split(/\s*(=|>|<|>=|<=|!=)\s*/);
                            const paramValue = value.startsWith('$') ? params[parseInt(value.substring(1)) - 1] : value.replace(/'/g, '');
                            switch (operator) {
                                case '=': return row[colName] == paramValue;
                                case '>': return row[colName] > paramValue;
                                case '<': return row[colName] < paramValue;
                                case '>=': return row[colName] >= paramValue;
                                case '<=': return row[colName] <= paramValue;
                                case '!=': return row[colName] != paramValue;
                                default: return true;
                            }
                        });
                    });
                }
                // 保存JSON数据库的更改
                if (this.dbType === 'json') {
                    this.saveJsonDb();
                }
                return result;
            }
            // INSERT处理
            const insertMatch = query.match(/INSERT\s+INTO\s+(.*?)\s+\((.*?)\)\s+VALUES\s+\((.*?)\)(?:\s*;)?$/i);
            if (insertMatch) {
                const [, table, columnsStr, valuesStr] = insertMatch;
                const tableName = table.trim();
                const columns = columnsStr.split(',').map(col => col.trim());
                // 处理值，替换参数
                let values = valuesStr.split(',').map(val => {
                    val = val.trim();
                    if (val.startsWith('$')) {
                        const paramIndex = parseInt(val.substring(1)) - 1;
                        return params[paramIndex];
                    }
                    return val.replace(/^'|'$/g, ''); // 去掉单引号
                });
                // 确保表存在
                if (!this.memoryDb[tableName]) {
                    this.memoryDb[tableName] = [];
                }
                // 创建新记录
                const newRecord = {};
                columns.forEach((col, index) => {
                    newRecord[col] = values[index];
                });
                // 添加到表
                this.memoryDb[tableName].push(newRecord);
                // 保存JSON数据库的更改
                if (this.dbType === 'json') {
                    this.saveJsonDb();
                }
                return [newRecord];
            }
            // 其他查询类型...
            console.warn('不支持的查询类型:', query);
            return [];
        }
    }
    /**
     * 保存JSON数据库到文件
     */
    saveJsonDb() {
        try {
            fs_1.default.writeFileSync(JSON_DB_PATH, JSON.stringify(this.memoryDb, null, 2));
        }
        catch (error) {
            console.error('保存JSON数据库失败:', error);
        }
    }
    /**
     * 执行SQL文件
     * @param filePath SQL文件路径
     */
    async executeSqlFile(filePath) {
        try {
            // 读取SQL文件
            const sqlContent = fs_1.default.readFileSync(filePath, 'utf-8');
            // 将SQL语句分割为单独的查询
            const queries = sqlContent
                .split(';')
                .map(query => query.trim())
                .filter(query => query.length > 0);
            // 执行每个查询
            for (const query of queries) {
                await this.query(`${query};`);
            }
            console.log(`SQL文件执行成功: ${filePath}`);
        }
        catch (error) {
            console.error(`SQL文件执行失败: ${filePath}`, error);
            throw error;
        }
    }
    /**
     * 关闭数据库连接
     */
    async close() {
        if (this.dbType === 'postgres' && this.pgClient) {
            await this.pgClient.end();
            this.pgClient = null;
            console.log('PostgreSQL数据库连接已关闭');
        }
        else if (this.dbType === 'json') {
            // 保存JSON数据库的更改
            this.saveJsonDb();
            console.log('JSON数据库已保存并关闭');
        }
        else {
            // 内存数据库不需要关闭
            console.log('内存数据库会话已结束');
        }
    }
}
exports.DatabaseService = DatabaseService;
