import { Serper } from "@langchain/community/tools/serper";
import { Tool } from "@langchain/core/tools";
import dotenv from "dotenv";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { createEmbeddingModel } from "./embeddings.js";
import { addToMemory } from "./memoryService.js";
import { createChatModel } from "./queryService.js";
import { loadVectorStore, similaritySearch } from "./vectorStore.js";

// 加载环境变量
dotenv.config();

/**
 * 创建一个自定义的知识库工具
 * @param {string} vectorStorePath 向量存储路径
 * @param {number} similarityThreshold 相似度阈值
 * @returns {Tool} 知识库工具
 */
export function createKnowledgeBaseTool(
  vectorStorePath,
  similarityThreshold = 0.6
) {
  class KnowledgeBaseTool extends Tool {
    name = "knowledge_base";
    description = "用于在知识库中搜索相关内容。输入是用户查询文本。";
    vectorStorePath;
    threshold;

    constructor(vectorStorePath, threshold) {
      super();
      this.vectorStorePath = vectorStorePath;
      this.threshold = threshold;
    }

    async _call(query) {
      try {
        const embeddings = createEmbeddingModel();
        const vectorStore = await loadVectorStore(
          this.vectorStorePath,
          embeddings
        );

        // 执行相似度搜索
        const results = await similaritySearch(
          vectorStore,
          query,
          4,
          this.threshold
        );

        if (results.length === 0) {
          return "在知识库中未找到相关信息。";
        }

        // 提取结果内容并格式化
        const formattedResults = results
          .map(([doc, score], index) => {
            return `[${index + 1}] 相关度: ${score.toFixed(2)}\n${
              doc.pageContent
            }\n来源: ${doc.metadata.source || "未知"}\n`;
          })
          .join("\n");

        return `在知识库中找到以下相关内容:\n${formattedResults}`;
      } catch (error) {
        console.error("知识库搜索失败:", error);
        return `知识库搜索出错: ${error.message}`;
      }
    }
  }

  return new KnowledgeBaseTool(vectorStorePath, similarityThreshold);
}

/**
 * 使用Agent执行智能查询
 * @param {string} query 用户查询
 * @param {Object} options 选项
 * @returns {Promise<object>} 查询结果
 */
export async function executeAgentQuery(query, options) {
  const {
    vectorStorePath,
    apiKey,
    apiEndpoint,
    modelName = "gpt-3.5-turbo",
    similarityThreshold = 0.6,
    sessionId = null,
    verbose = false,
  } = options;

  if (!query || query.trim().length === 0) {
    throw new Error("未提供查询内容");
  }

  try {
    console.log(
      `使用Agent执行智能查询: "${query.substring(0, 100)}${
        query.length > 100 ? "..." : ""
      }"`
    );

    // 创建LLM模型
    const llm = createChatModel(apiKey, modelName, apiEndpoint);

    // 创建工具集合
    const tools = [
      // 网络搜索工具
      new Serper({
        apiKey: process.env.SERPER_API_KEY,
        gl: "cn", // 地区设置为中国
        hl: "zh-cn", // 语言设置为中文
      }),
      // 知识库搜索工具
      createKnowledgeBaseTool(vectorStorePath, similarityThreshold),
    ];

    // 初始化Agent
    const executor = await initializeAgentExecutorWithOptions(tools, llm, {
      agentType: "openai-functions",
      verbose: verbose || process.env.DEBUG === "true",
      handleParsingErrors: true, // 处理解析错误
      maxIterations: 5, // 最大迭代次数，防止无限循环
    });

    console.log("Agent已初始化，开始执行查询...");

    // 执行查询
    const result = await executor.invoke({
      input: `${query} 请根据问题内容，判断应该使用网络搜索还是知识库搜索，或者两者都使用。请用中文回答，保持回答简洁明了。`,
    });

    const answer = result.output;

    // 如果有会话ID，将对话添加到记忆中
    if (sessionId) {
      await addToMemory(sessionId, query, answer);
    }

    console.log("Agent查询完成");

    return {
      answer,
      source: "agent",
      usedGeneralModel: false,
      usedWebSearch: true,
      usedKnowledgeBase: true,
    };
  } catch (error) {
    console.error("Agent执行查询失败:", error);
    throw error;
  }
}
