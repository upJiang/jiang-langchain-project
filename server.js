const express = require('express');
const cors = require('cors');
const path = require('path');

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
    // 创建LLM
    llm = LLMFactory.createGPT3_5();
    
    // 创建对话链
    conversationChain = createConversationChain(llm);
    
    // 创建工具
    const tools = [
      createWeatherQueryTool(),
      createWeatherComparisonTool(),
      createSqlQueryTool(),
      createTableInfoTool(),
    ];
    
    // 创建代理执行器
    agentExecutor = await createAgentExecutor(tools, llm);
    
    // 创建向量存储
    const langchainDocsDir = path.join(DATA_DIR, 'langchain');
    vectorStore = await loadOrCreateVectorStore(langchainDocsDir, 'langchain-docs');
    
    // 创建RAG链
    ragChain = await createRAGChain(vectorStore, llm);
    
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
    
    const response = await runAgent(agentExecutor, input);
    res.json({ response });
  } catch (error) {
    console.error('代理请求失败:', error);
    res.status(500).json({ error: '代理请求处理失败' });
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