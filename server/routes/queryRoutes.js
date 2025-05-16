import dotenv from "dotenv";
import express from "express";
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
      sessionId,
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
      // 添加会话ID支持
      sessionId: sessionId || null,
    };

    const result = await executeQuery(query, options);

    return res.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      usedGeneralModel: result.usedGeneralModel || false,
      sessionId: sessionId || null, // 返回会话ID
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
