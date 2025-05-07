import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// 加载环境变量
dotenv.config();

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV !== 'production';

// 使用Zod定义环境变量验证schema
const envSchema = z.object({
  // OpenAI API Key - 开发模式下可选
  OPENAI_API_KEY: isDevelopment 
    ? z.string().default('fake-api-key-for-dev') 
    : z.string(),
  
  // 和风天气API Key - 开发模式下可选
  QWEATHER_KEY: isDevelopment 
    ? z.string().default('fake-weather-key-for-dev') 
    : z.string(),
  
  // 数据库配置
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(val => parseInt(val, 10)).default('5432'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('langchain_demo'),
  
  // 邮件配置
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().transform(val => parseInt(val, 10)).optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_TO: z.string().optional(),
});

// 设置为开发环境
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('⚠️ 未设置NODE_ENV，默认使用development环境');
}

// 解析和验证环境变量
const _env = envSchema.safeParse(process.env);

// 如果验证失败，打印错误并终止程序
if (!_env.success) {
  console.error('❌ 环境变量验证失败', _env.error.format());
  throw new Error('环境变量验证失败');
}

// 导出验证后的环境变量
export const env = _env.data;

// 默认温度
export const DEFAULT_TEMPERATURE = 0.7;

// 数据目录
export const DATA_DIR = path.join(process.cwd(), 'data');

// 向量存储目录
export const VECTOR_STORE_DIR = path.join(DATA_DIR, 'vector_db');

// LLM模型列表
export const MODEL_LIST = {
  GPT3_5: 'gpt-3.5-turbo',
  GPT4: 'gpt-4',
  GPT4_TURBO: 'gpt-4-turbo-preview',
} as const;

// 默认LLM模型
export const DEFAULT_MODEL = MODEL_LIST.GPT3_5; 