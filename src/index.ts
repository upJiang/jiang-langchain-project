import dotenv from 'dotenv';
import path from 'path';
import { LLMFactory } from './models/llm';
import { createConversationChain, runConversation } from './chains/conversation';
import { createAgentExecutor, runAgent } from './chains/agent';
import { createRAGChain, runRAG } from './chains/rag';
import { createEmbeddings, loadOrCreateVectorStore } from './embeddings/vector-store';
import { 
  createLangChainExampleData, 
  createExampleDatabase,
  ensureDirectoryExists 
} from './utils/file-utils';
import { createWeatherQueryTool, createWeatherComparisonTool } from './tools/weather-tools';
import { createSqlQueryTool, createTableInfoTool, closeDbConnection } from './tools/database-tools';
import { scheduleDailyWeatherReport, runWeatherReportNow } from './services/scheduler';
import readline from 'readline';
import { DATA_DIR } from './config/config';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Tool } from 'langchain/tools';

// 加载环境变量
dotenv.config();

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 函数：等待用户输入
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * 演示基本对话链
 */
async function demoConversationChain(): Promise<void> {
  console.log('\n===== 演示基本对话链 =====');
  
  // 创建LLM实例
  const llm = LLMFactory.createGPT3_5();
  
  // 创建对话链
  const chain = createConversationChain(llm);
  
  // 开始交互式对话
  console.log('开始与AI助手对话。输入 "退出" 结束对话。');
  
  let input = await prompt('您: ');
  
  while (input.toLowerCase() !== '退出') {
    // 运行对话链
    const response = await runConversation(chain, input);
    console.log(`AI助手: ${response}`);
    
    // 获取下一个输入
    input = await prompt('您: ');
  }
  
  console.log('对话已结束');
}

/**
 * 演示代理执行器
 */
async function demoAgentExecutor(): Promise<void> {
  console.log('\n===== 演示代理执行器与工具使用 =====');
  
  // 创建LLM实例
  const llm = LLMFactory.createGPT3_5();
  
  // 创建工具
  const tools = [
    createWeatherQueryTool(),
    createWeatherComparisonTool(),
    createSqlQueryTool(),
    createTableInfoTool(),
  ] as unknown as Tool[];
  
  // 创建代理执行器
  const executor = await createAgentExecutor(tools, llm);
  
  // 开始交互式对话
  console.log('开始与Agent交互。Agent可以使用工具帮助回答问题。输入 "退出" 结束对话。');
  
  let input = await prompt('您: ');
  
  while (input.toLowerCase() !== '退出') {
    try {
      // 运行代理执行器
      const response = await runAgent(executor, input);
      console.log(`Agent: ${response}`);
    } catch (error) {
      console.error('代理执行失败:', error);
      console.log('Agent: 抱歉，我遇到了一些问题。请尝试其他问题。');
    }
    
    // 获取下一个输入
    input = await prompt('您: ');
  }
  
  console.log('交互已结束');
}

/**
 * 演示RAG（检索增强生成）
 */
async function demoRAG(): Promise<void> {
  console.log('\n===== 演示RAG（检索增强生成）=====');
  
  // 创建示例数据
  console.log('正在准备示例数据...');
  const files = createLangChainExampleData();
  console.log(`已创建 ${files.length} 个示例文件`);
  
  // 创建LLM实例
  const llm = LLMFactory.createGPT3_5();
  
  // 创建或加载向量存储
  console.log('正在创建向量存储...');
  const langchainDocsDir = path.join(DATA_DIR, 'langchain');
  const vectorStore = await loadOrCreateVectorStore(langchainDocsDir, 'langchain-docs');
  
  // 创建RAG链
  console.log('正在创建RAG链...');
  const ragChain = await createRAGChain(vectorStore, llm);
  
  // 开始交互式问答
  console.log('RAG系统已准备就绪。您可以询问关于LangChain的问题。输入 "退出" 结束对话。');
  
  let question = await prompt('您的问题: ');
  
  while (question.toLowerCase() !== '退出') {
    try {
      // 运行RAG链
      const answer = await runRAG(ragChain, question);
      console.log(`回答: ${answer}`);
    } catch (error) {
      console.error('RAG查询失败:', error);
      console.log('回答: 抱歉，我无法处理您的问题。请尝试其他问题。');
    }
    
    // 获取下一个问题
    question = await prompt('您的问题: ');
  }
  
  console.log('RAG对话已结束');
}

/**
 * 演示数据库集成
 */
async function demoDatabaseIntegration(): Promise<void> {
  console.log('\n===== 演示数据库集成 =====');
  
  // 创建示例数据库
  console.log('正在准备示例数据库...');
  const sqlFile = createExampleDatabase();
  console.log(`已创建示例SQL文件: ${sqlFile}`);
  
  // 创建LLM实例
  const llm = LLMFactory.createGPT3_5();
  
  // 创建工具
  const tools = [
    createSqlQueryTool(),
    createTableInfoTool(),
  ] as unknown as Tool[];
  
  // 创建代理执行器
  const executor = await createAgentExecutor(tools, llm);
  
  // 提示用户可以问的问题
  console.log('\n您可以尝试以下问题:');
  console.log('1. 数据库中有哪些表？');
  console.log('2. users表的结构是什么样的？');
  console.log('3. 获取所有用户的信息');
  console.log('4. 获取所有天气记录');
  console.log('5. 查找温度高于28度的城市');
  
  // 开始交互式对话
  console.log('\n开始与数据库Agent交互。输入 "退出" 结束对话。');
  
  let input = await prompt('您: ');
  
  while (input.toLowerCase() !== '退出') {
    try {
      // 运行代理执行器
      const response = await runAgent(executor, input);
      console.log(`Agent: ${response}`);
    } catch (error) {
      console.error('数据库查询失败:', error);
      console.log('Agent: 抱歉，我在处理数据库查询时遇到了问题。');
    }
    
    // 获取下一个输入
    input = await prompt('您: ');
  }
  
  console.log('数据库交互已结束');
  
  // 关闭数据库连接
  await closeDbConnection();
}

/**
 * 演示天气预报推送
 */
async function demoWeatherForecast(): Promise<void> {
  console.log('\n===== 演示天气预报推送 =====');
  
  // 提示用户选择功能
  console.log('请选择功能:');
  console.log('1. 立即获取城市天气预报');
  console.log('2. 设置定时天气预报推送');
  console.log('3. 返回主菜单');
  
  const choice = await prompt('请输入选项 (1-3): ');
  
  switch (choice) {
    case '1':
      // 立即获取天气预报
      const city = await prompt('请输入城市名称: ');
      console.log(`正在获取 ${city} 的天气预报...`);
      
      try {
        await runWeatherReportNow(city);
        console.log(`已获取 ${city} 的天气预报`);
      } catch (error) {
        console.error(`获取天气预报失败: ${city}`, error);
      }
      break;
      
    case '2':
      // 设置定时天气预报推送
      const scheduleCity = await prompt('请输入城市名称: ');
      const scheduleTime = await prompt('请输入定时发送时间 (cron格式，例如 "0 8 * * *" 表示每天上午8点): ');
      
      try {
        const jobId = scheduleDailyWeatherReport(scheduleCity, scheduleTime);
        console.log(`已设置定时天气预报推送，任务ID: ${jobId}`);
        console.log('定时任务已设置，程序将持续运行以执行定时任务。输入任意键返回主菜单...');
        await prompt('');
      } catch (error) {
        console.error(`设置定时任务失败`, error);
      }
      break;
      
    case '3':
    default:
      // 返回主菜单
      return;
  }
}

/**
 * 主菜单
 */
async function mainMenu(): Promise<void> {
  // 确保数据目录存在
  ensureDirectoryExists(DATA_DIR);
  
  while (true) {
    console.log('\n===== LangChain.js 演示项目 =====');
    console.log('请选择要演示的功能:');
    console.log('1. 基本对话链');
    console.log('2. 代理执行器与工具使用');
    console.log('3. RAG（检索增强生成）');
    console.log('4. 数据库集成');
    console.log('5. 天气预报推送');
    console.log('0. 退出程序');
    
    const choice = await prompt('请输入选项 (0-5): ');
    
    switch (choice) {
      case '1':
        await demoConversationChain();
        break;
      case '2':
        await demoAgentExecutor();
        break;
      case '3':
        await demoRAG();
        break;
      case '4':
        await demoDatabaseIntegration();
        break;
      case '5':
        await demoWeatherForecast();
        break;
      case '0':
        console.log('感谢使用，再见！');
        rl.close();
        return;
      default:
        console.log('无效的选项，请重新输入。');
    }
  }
}

// 启动程序
mainMenu().catch(error => {
  console.error('程序执行出错:', error);
  rl.close();
}); 