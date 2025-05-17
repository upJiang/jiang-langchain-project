import dotenv from "dotenv";
import express from "express";
import { executeAgentQuery } from "../services/agentService.js";
import { clearMemory } from "../services/memoryService.js";
import { executeQuery, searchSimilarDocs } from "../services/queryService.js";

// 加载环境变量
dotenv.config();

// 创建路由
const router = express.Router();

// 查询API
router.post("/query", async (req, res) => {
  try {
    const {
      query,
      vectorStorePath,
      similarityThreshold,
      useGeneralModelFallback,
      useWebSearch,
      sessionId,
      useAgent = false, // 新增参数，决定是否使用Agent进行查询
    } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "未提供查询内容",
      });
    }

    if (!vectorStorePath) {
      return res.status(400).json({
        success: false,
        message: "未提供向量存储路径",
      });
    }

    const options = {
      vectorStorePath,
      // 所有配置从环境变量中读取
      apiKey: process.env.OPENAI_API_KEY,
      apiEndpoint: process.env.OPENAI_API_ENDPOINT,
      modelName: process.env.MODEL_NAME,
      // 处理新增参数
      similarityThreshold:
        similarityThreshold !== undefined ? similarityThreshold : 0.6,
      useGeneralModelFallback:
        useGeneralModelFallback !== undefined ? useGeneralModelFallback : true,
      useWebSearch: useWebSearch !== undefined ? useWebSearch : false,
      // 添加会话ID支持
      sessionId: sessionId || null,
    };

    let result;

    // 根据参数决定使用Agent还是普通查询
    if (useAgent) {
      console.log("使用Agent执行智能查询");
      result = await executeAgentQuery(query, options);
    } else {
      result = await executeQuery(query, options);
    }

    return res.json({
      success: true,
      answer: result.answer,
      sources: result.sources || [],
      usedGeneralModel: result.usedGeneralModel || false,
      usedWebSearch: result.usedWebSearch || false,
      usedAgent: useAgent,
      searchResults: result.searchResults || [],
      sessionId: sessionId || null,
    });
  } catch (error) {
    console.error("查询接口错误:", error);
    return res.status(500).json({
      success: false,
      message: "查询处理失败",
      error: error.message,
    });
  }
});

// Agent查询API - 专门的Agent路由
router.post("/agent-query", async (req, res) => {
  try {
    const {
      query,
      vectorStorePath,
      similarityThreshold,
      sessionId,
      verbose = false,
    } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "未提供查询内容",
      });
    }

    if (!vectorStorePath) {
      return res.status(400).json({
        success: false,
        message: "未提供向量存储路径",
      });
    }

    const options = {
      vectorStorePath,
      apiKey: process.env.OPENAI_API_KEY,
      apiEndpoint: process.env.OPENAI_API_ENDPOINT,
      modelName: process.env.MODEL_NAME,
      similarityThreshold:
        similarityThreshold !== undefined ? similarityThreshold : 0.6,
      sessionId: sessionId || null,
      verbose,
    };

    const result = await executeAgentQuery(query, options);

    return res.json({
      success: true,
      answer: result.answer,
      source: result.source,
      usedAgent: true,
      sessionId: sessionId || null,
    });
  } catch (error) {
    console.error("Agent查询接口错误:", error);
    return res.status(500).json({
      success: false,
      message: "Agent查询处理失败",
      error: error.message,
    });
  }
});

// 清除会话记忆API
router.post("/clearMemory", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "未提供会话ID",
      });
    }

    clearMemory(sessionId);

    return res.json({
      success: true,
      message: "会话记忆已清除",
    });
  } catch (error) {
    console.error("清除会话记忆错误:", error);
    return res.status(500).json({
      success: false,
      message: "清除会话记忆失败",
      error: error.message,
    });
  }
});

// 相似度搜索API
router.post("/search", async (req, res) => {
  try {
    const { query, vectorStorePath, numResults, similarityThreshold } =
      req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "未提供搜索内容",
      });
    }

    if (!vectorStorePath) {
      return res.status(400).json({
        success: false,
        message: "未提供向量存储路径",
      });
    }

    const options = {
      vectorStorePath,
      numResults: numResults || 4,
      similarityThreshold:
        similarityThreshold !== undefined ? similarityThreshold : 0,
    };

    const results = await searchSimilarDocs(query, options);

    return res.json({
      success: true,
      results: results,
      count: results.length,
    });
  } catch (error) {
    console.error("相似度搜索接口错误:", error);
    return res.status(500).json({
      success: false,
      message: "相似度搜索失败",
      error: error.message,
    });
  }
});

export default router;
