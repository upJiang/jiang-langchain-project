const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// 确保.env文件存在
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error(`❌ 未找到.env文件: ${envPath}`);
  console.log('当前目录文件列表:');
  console.log(fs.readdirSync(__dirname));
} else {
  console.log(`✅ 找到.env文件: ${envPath}`);
}

// 手动加载环境变量
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
  
  envLines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
  
  console.log('✅ 手动加载了.env环境变量');
} catch (error) {
  console.error('❌ 手动加载.env文件失败:', error);
}

// 使用dotenv加载环境变量作为备份
dotenv.config();

// 打印OPENAI API KEY (只显示前6位和后6位，中间部分隐藏)
const apiKey = process.env.OPENAI_API_KEY || '';
const maskedApiKey = apiKey.length > 12 
  ? `${apiKey.slice(0, 6)}...${apiKey.slice(-6)}`
  : '未设置';
  
console.log('OPENAI API 密钥:', maskedApiKey);
console.log('OPENAI BASE URL:', process.env.OPENAI_BASE_URL || '未设置');

// 导入LangChain相关功能
const { LLMFactory } = require('./dist/models/llm');
const { createConversationChain, runConversation } = require('./dist/chains/conversation');
const { createAgentExecutor, runAgent } = require('./dist/chains/agent');
const { createRAGChain, runRAG } = require('./dist/chains/rag');
const { loadOrCreateVectorStore } = require('./dist/embeddings/vector-store');
const { createWeatherQueryTool, createWeatherComparisonTool } = require('./dist/tools/weather-tools');
const { createSqlQueryTool, createTableInfoTool, closeDbConnection } = require('./dist/tools/database-tools');
const { runWeatherReportNow, scheduleDailyWeatherReport } = require('./dist/services/scheduler');
const { DATA_DIR } = require('./dist/config/config');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// LLM实例和链
let llm;
let conversationChain;
let agentExecutor;
let ragChain;
let vectorStore;

// 初始化LangChain组件
async function initLangChain() {
  try {
    // 确保OpenAI Base URL末尾正确
    if (process.env.OPENAI_BASE_URL && !process.env.OPENAI_BASE_URL.endsWith('/v1')) {
      process.env.OPENAI_BASE_URL = `${process.env.OPENAI_BASE_URL}/v1`;
      console.log('已添加/v1到OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL);
    }
    
    // 验证API密钥是否存在
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ 未设置OpenAI API密钥，请在.env文件中设置OPENAI_API_KEY');
      throw new Error('未设置OpenAI API密钥');
    }
    
    // 绕过TLS验证，对某些API端点可能需要
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 
    
    // 直接使用LLMFactory创建LLM实例 
    llm = LLMFactory.createGPT3_5();
    console.log('✅ 成功创建LLM实例');
    
    // 创建对话链
    conversationChain = createConversationChain(llm);
    console.log('✅ 成功创建对话链');
    
    // 创建工具
    const tools = [
      createWeatherQueryTool(),
      createWeatherComparisonTool(),
      createSqlQueryTool(),
      createTableInfoTool(),
    ];
    
    // 为每个工具添加更明确的使用指南
    tools.forEach(tool => {
      // 增强工具描述，帮助LLM理解如何使用
      if (tool.name === 'get_weather') {
        tool.description = `获取指定城市的天气预报信息。使用方式: {"city": "城市名称"}。例如: {"city": "北京"}`;
      }
      else if (tool.name === 'compare_weather') {
        tool.description = `对比多个城市的天气情况。使用方式: {"cities": ["城市1", "城市2", ...]}。例如: {"cities": ["北京", "上海"]}`;
      }
      else if (tool.name === 'run_sql_query') {
        tool.description = `在数据库中执行SQL查询。使用方式: {"query": "SQL语句"}。例如: {"query": "SELECT * FROM users LIMIT 5"}`;
      }
      else if (tool.name === 'get_table_info') {
        tool.description = `获取数据库表的结构信息。使用方式: {"table": "表名"}。例如: {"table": "users"}`;
      }
      
      console.log(`注册工具: ${tool.name} - ${tool.description.substring(0, 50)}...`);
    });
    
    // 创建代理执行器
    agentExecutor = await createAgentExecutor(tools, llm);
    console.log('✅ 成功创建代理执行器');
    
    // 创建向量存储
    const langchainDocsDir = path.join(DATA_DIR, 'langchain');
    vectorStore = await loadOrCreateVectorStore(langchainDocsDir, 'langchain-docs');
    console.log('✅ 成功创建向量存储');
    
    // 创建RAG链
    ragChain = await createRAGChain(vectorStore, llm);
    console.log('✅ 成功创建RAG链');
    
    console.log('LangChain组件初始化完成');
  } catch (error) {
    console.error('LangChain组件初始化失败:', error);
  }
}

// API路由

// 基本对话
app.post('/api/conversation', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: '缺少输入参数' });
    }
    
    const response = await runConversation(conversationChain, input);
    res.json({ response });
  } catch (error) {
    console.error('对话请求失败:', error);
    res.status(500).json({ error: '对话请求处理失败' });
  }
});

// 代理执行
app.post('/api/agent', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: '缺少输入参数' });
    }
    
    console.log(`收到代理请求，输入: "${input}"`);
    
    // 验证代理执行器是否正确初始化
    if (!agentExecutor) {
      console.error('代理执行器未初始化');
      return res.status(500).json({ 
        error: '代理服务未准备好',
        response: '抱歉，代理服务尚未准备好，请稍后再试。'
      });
    }
    
    // 运行代理执行器 - 现在runAgent可以处理自己的错误并返回适当的消息
    const response = await runAgent(agentExecutor, input);
    console.log(`代理请求处理完成，响应:`, response.substring(0, 100) + (response.length > 100 ? '...' : ''));
    
    // 发送响应
    res.json({ response });
  } catch (error) {
    console.error('代理请求处理失败:', error);
    
    // 返回友好的错误消息
    res.status(500).json({ 
      error: '代理请求处理失败', 
      message: error.message || '未知错误',
      response: '抱歉，处理您的请求时出现了问题。请尝试简化您的问题或使用不同的指令。'
    });
  }
});

// RAG查询
app.post('/api/rag', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: '缺少查询参数' });
    }
    
    const answer = await runRAG(ragChain, query);
    res.json({ answer });
  } catch (error) {
    console.error('RAG查询失败:', error);
    res.status(500).json({ error: 'RAG查询处理失败' });
  }
});

// 数据库查询
app.post('/api/database', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: '缺少查询参数' });
    }
    
    // 使用代理执行器处理数据库查询
    const response = await runAgent(agentExecutor, query);
    res.json({ result: response });
  } catch (error) {
    console.error('数据库查询失败:', error);
    res.status(500).json({ error: '数据库查询处理失败' });
  }
});

// 获取天气
app.get('/api/weather', async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) {
      return res.status(400).json({ error: '缺少城市参数' });
    }
    
    const weatherData = await runWeatherReportNow(city);
    res.json(weatherData);
  } catch (error) {
    console.error('天气查询失败:', error);
    res.status(500).json({ error: '天气查询处理失败' });
  }
});

// 设置天气推送
app.post('/api/weather/schedule', async (req, res) => {
  try {
    const { city, time, frequency } = req.body;
    if (!city || !time) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 解析时间为cron表达式
    const [hours, minutes] = time.split(':');
    let cronExpression;
    
    switch(frequency) {
      case 'weekday':
        cronExpression = `${minutes} ${hours} * * 1-5`; // 周一至周五
        break;
      case 'weekend':
        cronExpression = `${minutes} ${hours} * * 0,6`; // 周六和周日
        break;
      case 'daily':
      default:
        cronExpression = `${minutes} ${hours} * * *`; // 每天
    }
    
    const jobId = scheduleDailyWeatherReport(city, cronExpression);
    res.json({ jobId, city, time, frequency });
  } catch (error) {
    console.error('设置天气推送失败:', error);
    res.status(500).json({ error: '设置天气推送失败' });
  }
});

// 取消天气推送
app.delete('/api/weather/schedule/:id', (req, res) => {
  try {
    const { id } = req.params;
    // 这里应该有取消定时任务的逻辑
    // 由于是演示，这里只返回成功
    res.json({ success: true, id });
  } catch (error) {
    console.error('取消天气推送失败:', error);
    res.status(500).json({ error: '取消天气推送失败' });
  }
});

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  
  // 初始化LangChain组件
  await initLangChain();
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('关闭服务器中...');
  
  // 关闭数据库连接
  await closeDbConnection();
  
  process.exit(0);
}); 