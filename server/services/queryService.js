import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import { createEmbeddingModel } from "./embeddings.js";
import { addToMemory, getFormattedHistory } from "./memoryService.js";
import { loadVectorStore, similaritySearch } from "./vectorStore.js";
import { getAnswerFromWebSearch } from "./webSearchService.js";

// 加载环境变量
dotenv.config();

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

  const actualEndpoint = endpoint || process.env.OPENAI_API_ENDPOINT;
  console.log(`使用OpenAI API端点: ${actualEndpoint || "默认官方API"}`);

  const options = {
    openAIApiKey: apiKey,
    modelName: modelName || process.env.MODEL_NAME || "gpt-3.5-turbo",
    temperature: 0.3,
    maxTokens: 800,
    timeout: 60000, // 60秒超时
    maxRetries: 3, // 最大重试次数
  };

  if (actualEndpoint) {
    options.configuration = {
      baseURL: actualEndpoint, // 使用baseURL而不是basePath
    };
  }

  return new ChatOpenAI(options);
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

      // 获取历史记录文本 - 修复异步调用
      const historyText = await getFormattedHistory(sessionId);

      // 构建提示模板
      const template = historyText
        ? `以下是之前的对话历史:
${historyText}

基于以上历史，回答用户的问题: {question}
请用中文简明扼要地回答:`
        : `请回答以下问题，如果你不确定答案，请直接说不知道，不要编造信息。

问题: {question}

请用中文简明扼要地回答:`;

      const prompt = PromptTemplate.fromTemplate(template);
      const formattedPrompt = await prompt.format({ question: query });

      // 使用LLM直接调用
      const response = await llm.invoke(formattedPrompt);
      const answer = typeof response === "string" ? response : response.content;

      // 更新会话历史
      await addToMemory(sessionId, query, answer);

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
 * @returns {Promise<RetrievalQAChain>} 问答链
 */
export async function createQAChain(
  llm,
  vectorStore,
  promptTemplate,
  sessionId
) {
  if (!llm) {
    throw new Error("未提供语言模型");
  }

  if (!vectorStore) {
    throw new Error("未提供向量存储");
  }

  // 获取历史记录
  let historyText = "";
  if (sessionId) {
    try {
      // 使用新的方法获取格式化的历史记录 - 修复异步调用
      historyText = await getFormattedHistory(sessionId);
    } catch (error) {
      console.error("获取历史记录失败:", error);
    }
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
    useWebSearch = false,
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
    console.log(`使用网络搜索: ${useWebSearch ? "是" : "否"}`);

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

    // 如果没有找到相似度足够高的文档
    if (searchResults.length === 0) {
      console.log("未找到相似度足够高的文档");

      // 如果开启了网络搜索
      if (useWebSearch) {
        console.log("使用网络搜索获取答案");
        const webSearchResult = await getAnswerFromWebSearch(truncatedQuery);

        // 如果有会话ID，将对话保存到记忆中
        if (sessionId) {
          const answer = webSearchResult.output || webSearchResult.answer;
          if (answer) {
            await addToMemory(sessionId, truncatedQuery, answer);
          } else {
            console.log("网络搜索未返回有效答案，跳过记忆保存");
          }
        }

        return {
          answer: webSearchResult.output || webSearchResult.answer,
          sources: [],
          searchResults: webSearchResult.searchResults,
          usedGeneralModel: false,
          usedWebSearch: true,
        };
      }
      // 如果开启了通用模型回退但没开启网络搜索
      else if (useGeneralModelFallback) {
        console.log("使用通用模型回答问题");
        const generalAnswer = await queryGeneralModel(
          truncatedQuery,
          llm,
          sessionId
        );

        return {
          answer: generalAnswer,
          sources: [],
          searchResults: [],
          usedGeneralModel: true,
          usedWebSearch: false,
        };
      }
      // 如果既不使用网络搜索也不使用通用模型
      else {
        return {
          answer: "抱歉，我在知识库中没有找到与您问题相关的信息。",
          sources: [],
          searchResults: [],
          usedGeneralModel: false,
          usedWebSearch: false,
        };
      }
    }

    // 有结果，使用问答链
    console.log(
      `找到 ${searchResults.length} 个相关文档，执行LangChain问答链...`
    );
    const chain = await createQAChain(llm, vectorStore, null, sessionId);

    // 使用invoke代替call
    const result = await chain.invoke({
      query: truncatedQuery,
    });

    console.log("LangChain查询完成");

    // 从结果中获取text和sourceDocuments，兼容不同版本的返回格式
    const answerText = result.text || result.answer || result.output || result;
    const sourceDocuments = result.sourceDocuments || [];

    console.log(`找到的源文档数量: ${sourceDocuments.length || 0}`);

    // 去重相同源文件的文档，只保留相似度最高的
    const uniqueSources = new Map();

    searchResults.forEach(([doc, score]) => {
      const source = doc.metadata.source;
      // 如果是首次出现这个源，或者比之前的相似度更高，则保存
      if (
        !uniqueSources.has(source) ||
        score > uniqueSources.get(source).score
      ) {
        uniqueSources.set(source, {
          content: doc.pageContent.substring(0, 150) + "...",
          similarity: score,
        });
      }
    });

    // 转换为数组格式返回给前端
    const sources = Array.from(uniqueSources.entries()).map(
      ([source, data]) => {
        // 这里直接使用metadata中保存的原始文件名作为source
        // documentRoutes.js中存储文档时，已将原始文件名保存到metadata
        return {
          content: data.content,
          source: source, // 这是原始文件名
          similarity: data.similarity.toFixed(2),
        };
      }
    );

    // 按相似度降序排序
    sources.sort((a, b) => b.similarity - a.similarity);

    // 更新会话历史
    if (sessionId) {
      // 确保answerText是一个有效的字符串
      const validAnswer =
        typeof answerText === "string"
          ? answerText
          : answerText?.text ||
            answerText?.content ||
            answerText?.answer ||
            answerText?.output ||
            JSON.stringify(answerText) ||
            "无有效回答";
      try {
        await addToMemory(sessionId, truncatedQuery, validAnswer);
        console.log("成功更新会话历史");
      } catch (memoryError) {
        console.error("更新会话历史失败:", memoryError);
        // 继续执行，不影响主流程
      }
    }

    return {
      answer: answerText,
      sources: sources,
      usedGeneralModel: false,
      usedWebSearch: false,
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

/**
 * 确定查询类型
 * @param {string} query 用户查询
 * @returns {string} 查询类型 (general|web_search)
 */
export function determineQueryType(query) {
  // 如果查询包含特定关键词，更可能需要最新的互联网信息
  const webSearchKeywords = [
    "最新",
    "新闻",
    "近期",
    "目前",
    "现状",
    "最近",
    "今天",
    "昨天",
    "本周",
    "本月",
    "今年",
  ];

  // 如果查询是问题形式并包含特定领域词汇，可能需要最新信息
  const questionPatterns = [
    /最近.+?吗/,
    /现在.+?如何/,
    /目前.+?情况/,
    /最新.+?消息/,
    /有没有.+?新/,
  ];

  // 检查是否包含与时间相关的关键词
  const containsWebSearchKeyword = webSearchKeywords.some((keyword) =>
    query.includes(keyword)
  );

  // 检查是否匹配特定问题模式
  const matchesQuestionPattern = questionPatterns.some((pattern) =>
    pattern.test(query)
  );

  // 如果满足任一条件，使用网络搜索
  if (containsWebSearchKeyword || matchesQuestionPattern) {
    console.log(`查询 "${query}" 被判断为需要网络搜索`);
    return "web_search";
  }

  console.log(`查询 "${query}" 被判断为一般查询`);
  return "general";
}
