"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL = exports.MODEL_LIST = exports.VECTOR_STORE_DIR = exports.DATA_DIR = exports.DEFAULT_TEMPERATURE = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
// 加载环境变量
dotenv_1.default.config();
// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV !== 'production';
// 使用Zod定义环境变量验证schema
const envSchema = zod_1.z.object({
    // OpenAI API Key - 开发模式下可选
    OPENAI_API_KEY: isDevelopment
        ? zod_1.z.string().default('fake-api-key-for-dev')
        : zod_1.z.string(),
    // 和风天气API Key - 开发模式下可选
    QWEATHER_KEY: isDevelopment
        ? zod_1.z.string().default('fake-weather-key-for-dev')
        : zod_1.z.string(),
    // 数据库配置
    DB_HOST: zod_1.z.string().default('localhost'),
    DB_PORT: zod_1.z.string().transform(val => parseInt(val, 10)).default('5432'),
    DB_USER: zod_1.z.string().default('postgres'),
    DB_PASSWORD: zod_1.z.string().default('postgres'),
    DB_NAME: zod_1.z.string().default('langchain_demo'),
    // 邮件配置
    EMAIL_HOST: zod_1.z.string().optional(),
    EMAIL_PORT: zod_1.z.string().transform(val => parseInt(val, 10)).optional(),
    EMAIL_USER: zod_1.z.string().optional(),
    EMAIL_PASS: zod_1.z.string().optional(),
    EMAIL_TO: zod_1.z.string().optional(),
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
exports.env = _env.data;
// 默认温度
exports.DEFAULT_TEMPERATURE = 0.7;
// 数据目录
exports.DATA_DIR = path_1.default.join(process.cwd(), 'data');
// 向量存储目录
exports.VECTOR_STORE_DIR = path_1.default.join(exports.DATA_DIR, 'vector_db');
// LLM模型列表
exports.MODEL_LIST = {
    GPT3_5: 'gpt-3.5-turbo',
    GPT4: 'gpt-4',
    GPT4_TURBO: 'gpt-4-turbo-preview',
};
// 默认LLM模型
exports.DEFAULT_MODEL = exports.MODEL_LIST.GPT3_5;
