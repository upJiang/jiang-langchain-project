import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import { createEmbeddingModel } from "./embeddings.js";
import { loadVectorStore, similaritySearch } from "./vectorStore.js";

// 加载环境变量
dotenv.config();

// 存储用户会话记忆的Map
const sessionMemories = new Map();

/**
 * 创建聊天模型
 * @param {string} apiKey API密钥
 * @param {string} modelName 模型名称
 * @param {string} endpoint API端点
 * @returns {ChatOpenAI} 聊天模型
 */
export function createChatModel(apiKey, modelName, endpoint) {
  if (!apiKey) {
    apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("未提供API密钥且环境变量中不存在OPENAI_API_KEY");
    }
  }

  const options = {
    openAIApiKey: apiKey,
    modelName: modelName || process.env.MODEL_NAME || "gpt-3.5-turbo",
    temperature: 0.3,
    maxTokens: 800,
  };

  if (endpoint || process.env.OPENAI_API_ENDPOINT) {
    options.configuration = {
      basePath: endpoint || process.env.OPENAI_API_ENDPOINT,
    };
  }

  return new ChatOpenAI(options);
}

/**
 * 获取或创建用户会话的记忆
 * @param {string} sessionId 用户会话ID
 * @returns {Array} 会话历史记录
 */
export function getOrCreateMemory(sessionId) {
  if (!sessionMemories.has(sessionId)) {
    // 创建新的会话记忆，使用简单数组存储历史记录
    sessionMemories.set(sessionId, []);
  }
  return sessionMemories.get(sessionId);
}

/**
 * 添加消息到会话记忆
 * @param {string} sessionId 会话ID
 * @param {string} role 消息角色（user/assistant）
 * @param {string} content 消息内容
 */
export function addMessageToMemory(sessionId, role, content) {
  if (!sessionId) return;

  const memory = getOrCreateMemory(sessionId);
  memory.push({ role, content });

  // 保持历史记录在合理范围内，避免token过多
  if (memory.length > 10) {
    memory.shift(); // 移除最旧的消息
  }
}

/**
 * 格式化历史记录为提示模板可用的格式
 * @param {Array} messages 历史消息数组
 * @returns {string} 格式化的历史记录
 */
export function formatChatHistory(messages) {
  if (!messages || messages.length === 0) return "";

  return messages
    .map((m) => `${m.role === "user" ? "人类" : "AI"}: ${m.content}`)
    .join("\n");
}

/**
 * 使用通用模型回答问题
 * @param {string} query 用户问题
 * @param {object} llm 语言模型
 * @param {string} sessionId 用户会话ID
 * @returns {Promise<string>} 模型回答
 */
export async function queryGeneralModel(query, llm, sessionId) {
  if (!query || query.trim().length === 0) {
    throw new Error("未提供问题内容");
  }

  if (!llm) {
    throw new Error("未提供语言模型");
  }

  try {
    console.log(
      `使用通用模型回答问题: "${query.substring(0, 100)}${
        query.length > 100 ? "..." : ""
      }"`
    );

    // 使用会话记忆
    if (sessionId) {
      console.log(`使用会话ID: ${sessionId} 的记忆处理问题`);

      // 获取历史记录
      const chatHistory = getOrCreateMemory(sessionId);
      const formattedHistory = formatChatHistory(chatHistory);

      // 创建带历史记录的提示
      const template = `以下是人类和AI之间的对话。请根据对话历史回答人类的最新问题。如果你不确定答案，请直接说不知道。

对话历史:
${formattedHistory ? formattedHistory + "\n" : ""}

人类: {question}

AI: `;

      const prompt = PromptTemplate.fromTemplate(template);
      const formattedPrompt = await prompt.format({ question: query });

      // 调用LLM
      const response = await llm.invoke(formattedPrompt);
      const answer = typeof response === "string" ? response : response.content;

      // 更新会话历史
      addMessageToMemory(sessionId, "user", query);
      addMessageToMemory(sessionId, "assistant", answer);

      return answer;
    } else {
      // 如果没有会话ID，则回退到单次调用
      const template = `请回答以下问题，如果你不确定答案，请直接说不知道，不要编造信息。

问题: {question}

请用中文简明扼要地回答:`;

      const prompt = PromptTemplate.fromTemplate(template);
      const formattedPrompt = await prompt.format({ question: query });

      // 使用LLM直接调用
      const response = await llm.invoke(formattedPrompt);

      // 检查response的格式并正确提取内容
      if (typeof response === "string") {
        return response;
      } else if (response && response.content) {
        return response.content;
      } else {
        console.warn("LLM响应格式不符合预期:", response);
        return "抱歉，处理您的问题时出现了问题。";
      }
    }
  } catch (error) {
    console.error("通用模型回答失败:", error);
    throw error;
  }
}

/**
 * 创建问答链
 * @param {object} llm 语言模型
 * @param {object} vectorStore 向量存储
 * @param {string} promptTemplate 提示模板
 * @param {string} sessionId 用户会话ID
 * @returns {RetrievalQAChain} 问答链
 */
export function createQAChain(llm, vectorStore, promptTemplate, sessionId) {
  if (!llm) {
    throw new Error("未提供语言模型");
  }

  if (!vectorStore) {
    throw new Error("未提供向量存储");
  }

  // 获取历史记录
  let historyText = "";
  if (sessionId) {
    const chatHistory = getOrCreateMemory(sessionId);
    historyText = formatChatHistory(chatHistory);
  }

  // 默认提示模板
  let template;
  if (sessionId && historyText) {
    // 带上下文的提示模板
    template =
      promptTemplate ||
      `请根据以下信息回答用户的问题。如果无法从提供的信息中找到答案，请明确告知您不知道，不要编造信息。

信息:
{context}

对话历史:
${historyText}

用户问题: {question}

请用中文简明扼要地回答:`;
  } else {
    // 无上下文的提示模板
    template =
      promptTemplate ||
      `请根据以下信息回答用户的问题。如果无法从提供的信息中找到答案，请明确告知您不知道，不要编造信息。

信息:
{context}

用户问题: {question}

请用中文简明扼要地回答:`;
  }

  const PROMPT = PromptTemplate.fromTemplate(template);

  // 创建问答链
  return new RetrievalQAChain({
    combineDocumentsChain: loadQAStuffChain(llm, { prompt: PROMPT }),
    retriever: vectorStore.asRetriever(),
    returnSourceDocuments: true,
  });
}

/**
 * 执行查询
 * @param {string} query 查询文本
 * @param {object} options 查询选项
 * @returns {Promise<object>} 查询结果
 */
export async function executeQuery(query, options) {
  const {
    vectorStorePath,
    apiKey,
    apiEndpoint,
    modelName,
    similarityThreshold = 0.6,
    useGeneralModelFallback = true,
    sessionId = null,
  } = options;

  if (!query || query.trim().length === 0) {
    throw new Error("未提供查询内容");
  }

  if (!vectorStorePath) {
    throw new Error("未提供向量存储路径");
  }

  try {
    console.log(
      `处理查询: "${query.substring(0, 100)}${query.length > 100 ? "..." : ""}"`
    );

    if (sessionId) {
      console.log(`使用会话ID: ${sessionId} 进行查询`);
    }

    const actualApiKey = apiKey || process.env.OPENAI_API_KEY;
    const actualEndpoint = apiEndpoint || process.env.OPENAI_API_ENDPOINT;
    const actualModelName =
      modelName || process.env.MODEL_NAME || "gpt-3.5-turbo";

    console.log(`使用API端点: ${actualEndpoint || "默认OpenAI"}`);
    console.log(`使用模型: ${actualModelName}`);
    console.log(`相似度阈值: ${similarityThreshold}`);

    // 确保查询文本不超过API限制
    const truncatedQuery = query.substring(0, 1000);
    if (truncatedQuery.length < query.length) {
      console.log(
        `查询文本已被截断，原长度: ${query.length} -> ${truncatedQuery.length}`
      );
    }

    // 创建嵌入模型 - 直接使用简化版本，不需要传递参数
    const embeddings = createEmbeddingModel();

    // 加载向量存储
    const vectorStore = await loadVectorStore(vectorStorePath, embeddings);

    // 创建语言模型
    const llm = createChatModel(actualApiKey, actualModelName, actualEndpoint);

    // 首先检查是否有相似度高于阈值的文档
    const searchResults = await similaritySearch(
      vectorStore,
      truncatedQuery,
      4,
      similarityThreshold
    );

    // 如果没有找到相似度足够高的文档，且用户开启了通用模型回退
    if (searchResults.length === 0 && useGeneralModelFallback) {
      console.log("未找到相似度足够高的文档，使用通用模型回答问题");
      const generalAnswer = await queryGeneralModel(
        truncatedQuery,
        llm,
        sessionId
      );
      return {
        answer: generalAnswer,
        sources: [],
        usedGeneralModel: true,
      };
    }

    // 有结果或者用户要求不使用通用模型，使用问答链
    // 创建问答链并执行
    console.log(
      `找到 ${searchResults.length} 个相关文档，执行LangChain问答链...`
    );
    const chain = createQAChain(llm, vectorStore, null, sessionId);

    const result = await chain.call({
      query: truncatedQuery,
    });

    console.log("LangChain查询完成");
    console.log(`找到的源文档数量: ${result.sourceDocuments?.length || 0}`);

    // 如果相似度不够高且开启了通用模型，不显示源文档
    let sources = [];
    if (searchResults.length > 0) {
      // 格式化源文档，添加相似度信息
      sources = searchResults.map(([doc, score]) => {
        return {
          content: doc.pageContent.substring(0, 150) + "...",
          source: doc.metadata.source,
          similarity: score.toFixed(2),
        };
      });
    }

    // 更新会话历史
    if (sessionId) {
      addMessageToMemory(sessionId, "user", truncatedQuery);
      addMessageToMemory(sessionId, "assistant", result.text);
    }

    return {
      answer: result.text,
      sources: sources,
      usedGeneralModel: false,
    };
  } catch (error) {
    console.error("执行查询失败:", error);
    throw error;
  }
}

/**
 * 直接在向量存储中搜索相似内容
 * @param {string} query 查询文本
 * @param {object} options 查询选项
 * @returns {Promise<Array>} 相似文档数组
 */
export async function searchSimilarDocs(query, options) {
  const { vectorStorePath, numResults = 4, similarityThreshold = 0 } = options;

  if (!query || query.trim().length === 0) {
    throw new Error("未提供查询内容");
  }

  if (!vectorStorePath) {
    throw new Error("未提供向量存储路径");
  }

  try {
    // 创建嵌入模型 - 直接使用简化版本
    const embeddings = createEmbeddingModel();

    // 加载向量存储
    const vectorStore = await loadVectorStore(vectorStorePath, embeddings);

    // 执行相似度搜索，包括相似度分数
    const results = await similaritySearch(
      vectorStore,
      query,
      numResults,
      similarityThreshold
    );

    // 格式化结果
    return results.map(([doc, score]) => ({
      content: doc.pageContent,
      source: doc.metadata.source,
      metadata: doc.metadata,
      similarity: score.toFixed(4),
    }));
  } catch (error) {
    console.error("相似度搜索失败:", error);
    throw error;
  }
}
