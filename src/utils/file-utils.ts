import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config/config';

/**
 * 确保目录存在，如果不存在则创建它
 * @param dirPath 目录路径
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 保存示例文本数据到文件
 * @param content 文本内容
 * @param filename 文件名
 * @param subfolder 子文件夹名称（可选）
 * @returns 保存的文件路径
 */
export function saveTextToFile(
  content: string,
  filename: string,
  subfolder?: string
): string {
  // 确定保存路径
  const savePath = subfolder
    ? path.join(DATA_DIR, subfolder)
    : DATA_DIR;
  
  // 确保目录存在
  ensureDirectoryExists(savePath);
  
  // 完整文件路径
  const filePath = path.join(savePath, filename);
  
  // 写入文件
  fs.writeFileSync(filePath, content, 'utf-8');
  
  console.log(`文件已保存: ${filePath}`);
  return filePath;
}

/**
 * 读取文本文件内容
 * @param filePath 文件路径
 * @returns 文件内容
 */
export function readTextFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 创建LangChain.js示例数据
 * 创建包含关于LangChain概念的示例文本文件，用于RAG测试
 */
export function createLangChainExampleData(): string[] {
  // 确保数据目录存在
  ensureDirectoryExists(path.join(DATA_DIR, 'langchain'));
  
  const files: string[] = [];
  
  // 示例1: LangChain基本介绍
  const intro = `
# LangChain.js 简介

LangChain是一个强大的框架，旨在简化使用大语言模型(LLMs)构建应用程序的过程。LangChain.js是其JavaScript/TypeScript版本。

## 核心概念

LangChain.js提供以下核心功能:

1. **模型集成**: 与各种LLM提供商(如OpenAI, Anthropic等)进行交互的标准接口
2. **链**: 将多个组件连接成端到端应用的序列
3. **提示管理**: 创建、优化和重用提示模板
4. **内存**: 在链的执行中保持对话历史和状态
5. **工具和代理**: 赋予LLM使用外部工具和APIs的能力

LangChain.js使得构建各种AI应用变得简单，从聊天机器人到文档分析，再到自动化代理。
`;
  files.push(saveTextToFile(intro, 'intro.md', 'langchain'));
  
  // 示例2: RAG（检索增强生成）介绍
  const rag = `
# 检索增强生成 (RAG)

检索增强生成(RAG)是一种结合检索系统和生成AI的强大技术。

## RAG的工作原理

1. **知识索引**: 首先，将文档、知识库或其他数据源转换为向量嵌入并存储在向量数据库中。
2. **用户查询**: 当用户提出问题时，查询也被转换为向量表示。
3. **相关文档检索**: 系统搜索向量数据库，找出与用户查询最相似的文档或文本片段。
4. **上下文增强**: 检索到的相关文档被添加到发送给LLM的提示中，作为其回答问题的上下文。
5. **生成回答**: LLM使用检索到的上下文和用户问题生成准确、相关的回答。

## RAG的优势

- 使LLM能够访问其训练数据之外的信息
- 减少"幻觉"(捏造事实)
- 增强特定领域知识
- 提供最新信息(克服训练数据截止问题)
- 提高透明度(可以引用信息来源)
`;
  files.push(saveTextToFile(rag, 'rag.md', 'langchain'));
  
  // 示例3: LangChain中的链和代理
  const chains = `
# LangChain中的链和代理

## 链 (Chains)

链是LangChain的核心概念，允许将多个组件组合成一个单一的应用流程。

### 常见链类型

1. **LLM链**: 最简单的链，将提示模板连接到LLM。
2. **序列链**: 将多个链连接在一起，一个链的输出成为下一个链的输入。
3. **提示链**: 专注于构造和优化提示的链。
4. **检索QA链**: 结合检索器和LLM的链，用于问答系统。
5. **提取链**: 从文档中提取结构化信息的链。

## 代理 (Agents)

代理赋予LLM使用工具的能力，使其能够根据用户指令执行操作。

### 代理如何工作

1. 接收用户输入
2. 决定要使用哪个工具(如果有的话)
3. 使用该工具
4. 观察结果
5. 重复直到找到最终答案

### 代理类型

1. **ReAct**: 基于推理和行动交替的代理
2. **自反思代理**: 能够回顾和改进其过去行动的代理
3. **OpenAI函数代理**: 使用OpenAI函数调用功能的代理
4. **计划与执行代理**: 先规划步骤然后执行的代理

代理能够执行复杂任务，如搜索信息、执行计算、调用API等。
`;
  files.push(saveTextToFile(chains, 'chains-and-agents.md', 'langchain'));
  
  return files;
}

/**
 * 创建示例数据库文件
 */
export function createExampleDatabase(): string {
  // SQLite示例数据库内容
  const dbContent = `
-- 创建用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建天气记录表
CREATE TABLE weather_records (
  id INTEGER PRIMARY KEY,
  city_name TEXT NOT NULL,
  city_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  weather_condition TEXT NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入示例数据
INSERT INTO users (username, email) VALUES
  ('user1', 'user1@example.com'),
  ('user2', 'user2@example.com'),
  ('user3', 'user3@example.com');

INSERT INTO weather_records (city_name, city_id, temperature, weather_condition) VALUES
  ('北京', '101010100', 25.5, '晴'),
  ('上海', '101020100', 28.2, '多云'),
  ('广州', '101280101', 30.1, '阵雨');
`;

  // 保存到文件
  return saveTextToFile(dbContent, 'example.sql', 'database');
} 