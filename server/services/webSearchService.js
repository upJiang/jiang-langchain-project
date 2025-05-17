import dotenv from "dotenv";
import { createChatModel } from "./queryService.js";

// 加载环境变量
dotenv.config();

// 缓存机制，避免重复请求相同的查询
const searchCache = new Map();
// 缓存有效期 - 1小时（毫秒）
const CACHE_TTL = 60 * 60 * 1000;

/**
 * 使用网络搜索回答问题
 * @param {string} query 用户查询
 * @param {Object} options 选项
 * @returns {Promise<Object>} 包含答案和搜索结果的对象
 */
export async function getAnswerFromWebSearch(query, options = {}) {
  // 确保有API密钥
  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey) {
    console.error("缺少SERPER_API_KEY环境变量");
    return {
      answer: "无法执行网络搜索，未配置SERPER_API_KEY环境变量。",
      output: "无法执行网络搜索，未配置SERPER_API_KEY环境变量。",
      searchResults: [],
    };
  }

  // 缓存键 - 使用查询文本作为键
  const cacheKey = query.trim().toLowerCase();

  // 检查缓存
  if (searchCache.has(cacheKey)) {
    const cachedResult = searchCache.get(cacheKey);
    // 检查缓存是否过期
    if (Date.now() - cachedResult.timestamp < CACHE_TTL) {
      console.log(`从缓存获取结果: "${query}"`);
      return cachedResult.data;
    } else {
      // 缓存过期，删除
      searchCache.delete(cacheKey);
    }
  }

  try {
    console.log(`执行网络搜索: "${query}"`);
    const startTime = Date.now();

    // 1. 获取搜索结果
    let searchResults = [];
    try {
      // 直接调用serper.dev API
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          gl: "cn",
          hl: "zh-cn",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP错误! 状态码: ${response.status}`);
      }

      const data = await response.json();

      // 提取有用的搜索结果
      if (data.organic) {
        searchResults = data.organic.slice(0, 3).map((item) => ({
          title: item.title || "",
          link: item.link || "",
          snippet: item.snippet || "",
          displayLink: item.displayedLink || item.link || "",
        }));
      }

      console.log(
        `找到 ${searchResults.length} 个搜索结果 (${Date.now() - startTime}ms)`
      );
    } catch (searchError) {
      console.error("获取搜索结果失败:", searchError);
    }

    // 2. 直接使用语言模型总结搜索结果，而不是使用Agent
    if (searchResults.length > 0) {
      // 准备搜索结果上下文
      const searchContext = formatSearchResultsAsContext(searchResults);

      // 使用语言模型直接总结
      const model = createChatModel(
        null,
        process.env.MODEL_NAME || "gpt-3.5-turbo"
      );
      model.temperature = 0;

      const prompt = `根据以下搜索结果，请简明扼要地回答问题: "${query}"
      
搜索结果:
${searchContext}

请用中文回答，清晰准确，避免重复内容。如果搜索结果不足以回答问题，请说明无法给出确切答案。`;

      const response = await model.invoke(prompt);
      const answer = typeof response === "string" ? response : response.content;

      // 保存到缓存
      const result = {
        answer,
        output: answer,
        searchResults: searchResults,
      };

      // 添加到缓存
      searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result,
      });

      console.log(`生成答案完成，总耗时: ${Date.now() - startTime}ms`);
      return result;
    } else {
      const noResultsAnswer = "抱歉，我没有找到与您问题相关的搜索结果。";
      return {
        answer: noResultsAnswer,
        output: noResultsAnswer,
        searchResults: [],
      };
    }
  } catch (error) {
    console.error("网络搜索回答问题失败:", error);
    return {
      answer: `我无法通过搜索回答此问题。错误: ${error.message}`,
      output: `我无法通过搜索回答此问题。错误: ${error.message}`,
      searchResults: [],
    };
  }
}

/**
 * 使用Serper API执行网络搜索
 * @param {string} query 查询文本
 * @param {number} maxResults 最大结果数
 * @returns {Promise<Array>} 搜索结果数组
 */
export async function searchWeb(query, maxResults = 3) {
  if (!query || query.trim().length === 0) {
    throw new Error("查询内容为空");
  }

  // 使用环境变量中的API密钥
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("未设置SERPER_API_KEY环境变量");
  }

  try {
    console.log(`使用Serper执行网络搜索: "${query}"`);

    // 直接调用serper.dev API
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "cn",
        hl: "zh-cn",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const searchData = await response.json();

    // 兼容不同的结果结构
    const organic = searchData?.organic || [];

    if (!organic || organic.length === 0) {
      console.log("未找到搜索结果");
      return [];
    }

    // 格式化返回结果
    const results = organic.slice(0, maxResults).map((item) => ({
      title: item.title || "",
      link: item.link || "",
      snippet: item.snippet || "",
      displayLink: item.displayedLink || item.link || "",
    }));

    console.log(`找到 ${results.length} 个搜索结果`);
    return results;
  } catch (error) {
    console.error("网络搜索失败:", error);
    throw error;
  }
}

/**
 * 使用Agent判断问题是否需要搜索知识或使用通用模型
 * @param {string} query 用户查询
 * @param {object} llm 语言模型
 * @returns {Promise<{needsSearch: boolean, reasoningResult: string}>} 判断结果
 */
export async function determineQueryType(query, llm) {
  try {
    // 创建专用于判断的LLM实例
    const determineModel = createChatModel(null, "gpt-3.5-turbo");
    determineModel.temperature = 0;
    determineModel.maxTokens = 200;

    // 判断问题类型的提示
    const prompt = `分析以下用户问题，判断它是否需要最新信息或事实查询（如新闻、天气、日期、时间等实时信息）。
问题: "${query}"

请只返回 "SEARCH" 或 "GENERAL" 其中之一，不要返回其他内容:
- "SEARCH": 如果问题询问的是时事、新闻、当前日期/时间、天气、最新发布、实时状态等需要实时或网络搜索的信息
- "GENERAL": 如果问题是通用知识、概念解释、编程帮助、个人建议等不需要最新信息的内容`;

    const response = await determineModel.invoke(prompt);
    const result =
      typeof response === "string" ? response.trim() : response.content.trim();

    console.log(`问题类型判断结果: ${result} (查询: "${query}")`);

    return {
      needsSearch: result.includes("SEARCH"),
      reasoningResult: result,
    };
  } catch (error) {
    console.error("判断查询类型失败:", error);
    // 默认返回需要搜索，作为回退策略
    return { needsSearch: true, reasoningResult: "SEARCH (默认回退)" };
  }
}

/**
 * 将搜索结果格式化为上下文字符串
 * @param {Array} searchResults 搜索结果数组
 * @returns {string} 格式化后的上下文
 */
export function formatSearchResultsAsContext(searchResults) {
  if (!searchResults || searchResults.length === 0) {
    return "";
  }

  return searchResults
    .map(
      (result, index) => `[${index + 1}] ${result.title}
来源: ${result.displayLink}
链接: ${result.link}
摘要: ${result.snippet}
`
    )
    .join("\n");
}
