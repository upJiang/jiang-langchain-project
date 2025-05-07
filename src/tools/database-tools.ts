import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DatabaseService } from '../services/database';

// 创建并初始化数据库服务
let dbService: DatabaseService | null = null;

/**
 * 获取数据库服务实例
 * @returns 数据库服务实例
 */
async function getDbService(): Promise<DatabaseService> {
  if (!dbService) {
    dbService = new DatabaseService('memory'); // 使用内存数据库
    await dbService.init();
  }
  return dbService;
}

/**
 * 创建SQL查询工具
 * @returns SQL查询工具实例
 */
export function createSqlQueryTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'run_sql_query',
    description: '在数据库中执行SQL查询，用于获取或操作数据',
    schema: z.object({
      query: z.string().describe('SQL查询语句，例如"SELECT * FROM users"'),
      params: z.array(z.any()).optional().describe('查询参数（可选）'),
    }),
    func: async ({ query, params = [] }) => {
      try {
        console.log(`执行SQL查询: ${query}`);
        const db = await getDbService();
        const results = await db.query(query, params);
        
        // 将结果转换为字符串
        if (Array.isArray(results) && results.length > 0) {
          return JSON.stringify(results, null, 2);
        } else {
          return '查询执行成功，但没有返回结果。';
        }
      } catch (error) {
        console.error(`SQL查询失败`, error);
        return `SQL查询执行失败: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * 创建数据库表信息工具
 * @returns 数据库表信息工具实例
 */
export function createTableInfoTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_table_info',
    description: '获取指定数据库表的结构信息',
    schema: z.object({
      table: z.string().describe('要查询的表名'),
    }),
    func: async ({ table }) => {
      try {
        console.log(`获取表信息: ${table}`);
        const db = await getDbService();
        
        // 获取内存数据库中的表结构
        let tableInfo = '';
        let sampleInfo = '';
        
        try {
          // 尝试查询表数据
          const sampleData = await db.query(`SELECT * FROM ${table} LIMIT 5;`);
          
          // 如果有数据，从中提取表结构
          if (Array.isArray(sampleData) && sampleData.length > 0) {
            const firstRow = sampleData[0];
            tableInfo = `表 ${table} 的结构:\n\n` +
              Object.keys(firstRow).map(col => `${col} (推断类型: ${typeof firstRow[col]})`).join('\n');
              
            sampleInfo = `\n\n示例数据:\n${JSON.stringify(sampleData, null, 2)}`;
          } else {
            // 表存在但没有数据
            tableInfo = `表 ${table} 存在但没有数据。`;
          }
        } catch (error) {
          // 表可能不存在
          return `表 ${table} 不存在或没有列信息。`;
        }
        
        return tableInfo + sampleInfo;
      } catch (error) {
        console.error(`获取表信息失败: ${table}`, error);
        return `无法获取表 ${table} 的信息: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

/**
 * 关闭数据库连接
 */
export async function closeDbConnection(): Promise<void> {
  if (dbService) {
    await dbService.close();
    dbService = null;
    console.log('数据库连接已关闭');
  }
} 