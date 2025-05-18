---
theme: z-blue
---

随着大语言模型（LLM）时代的到来，越来越多企业开始将这一技术应用到实际业务场景中，其中智能客服作为一个高价值落地应用尤为突出。[langchain.js 最新版本官方文档](https://js.langchain.com/docs/versions/v0_3/)

本项目是基于 LangChain.js 构建的智能客服平台，通过本项目学习，您可以学到：

*   基于 `Vue3` 和 `Express` 的全栈开发实践
*   `LangChain.js` 框架的核心概念及应用方法
*   `RAG`（检索增强生成）系统的完整构建流程
*   文档处理（`loader`）、向量存储（`vectorStore`）与语义搜索（`similaritySearch`）的实现技术
*   大语言模型会话记忆功能（`BufferMemory`）的工程化实现
*   网络搜索功能（`serper`）与智能代理（`agent`）的集成方案

无论您是希望深入了解 `LangChain` 框架，还是计划将大语言模型能力集成到自己的项目中，相信这篇文章都能帮助到您。

项目运行截图：

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/70ddd6a5c8204c949f3db800065bded9~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgX2ppYW5n:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiODYyNDg3NTIyMzE0MzY2In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1748177654&x-orig-sign=40rNf0VwaMogslISqKfL44IPs2I%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/ff78db4ec86e4d66adef334ccd40a8da~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgX2ppYW5n:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiODYyNDg3NTIyMzE0MzY2In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1748177654&x-orig-sign=sWM86qfBuuetqZaMMe4PgVCupiQ%3D)

看截图是不是很像 `dify/coze` 平台的 `agent` 系统，接下来让我们用 `vue3 + express + langchain.js` 实现这个系统。

[代码仓库地址](https://github.com/upJiang/jiang-langchain-project)，**可以先下载代码后再继续阅读**，运行项目需要以下条件：

*   没有 `openAI` 的 `apiKey` 的 需要提供一个 [转发 API](https://github.com/chatanywhere/GPT_API_free?tab=readme-ov-file)
*   硅基流动平台申请一个 `apiKey`,需要使用它的 `embeddings` 模型把文本转成向量
*   网络搜索使用 [serper](https://serper.dev/)，自行申请一个 `apikey`，有免费的额度

以下配置需要自己新建一个 `.env` 并且把配置补充完整后方可运行项目

    # 模型API配置
    OPENAI_API_ENDPOINT=https://api.chatanywhere.tech
    MODEL_NAME=gpt-3.5-turbo-1106
    OPENAI_API_KEY=

    # 嵌入模型配置
    EMBEDDING_ENDPOINT=https://api.siliconflow.cn/v1/embeddings
    EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
    EMBEDDING_API_KEY=sk-

    # https://serper.dev/ 网络搜索配置
    SERPER_API_KEY=

## 项目概览

### 项目目录结构

    ├── client/                # 前端Vue3应用
    ├── server/                # 后端Express服务
    │   ├── routes/            # 路由定义
    │   │   ├── documentRoutes.js  # 文档处理相关路由
    │   │   └── queryRoutes.js     # 查询相关路由
    │   ├── services/          # 核心服务实现
    │   │   ├── agentService.js    # 智能代理服务
    │   │   ├── documentLoader.js  # 文档加载器
    │   │   ├── embeddings.js      # 嵌入模型
    │   │   ├── memoryService.js   # 会话记忆
    │   │   ├── queryService.js    # 查询服务
    │   │   ├── vectorStore.js     # 向量存储
    │   │   └── webSearchService.js # 网络搜索
    │   └── index.js           # 服务入口
    └── package.json           # 项目依赖

## LangChain.js 核心知识点

在深入项目代码前，先了解 LangChain.js 的几个核心概念：

### 1. 文档加载器（Document Loaders）

用于从各种来源加载文档，包括PDF、HTML、文本文件等。

```javascript
// 从server/services/documentLoader.js的实际实现
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";

// 根据文件类型选择加载器
switch (ext) {
  case ".txt":
  case ".md":
    loader = new TextLoader(filePath);
    break;
  case ".pdf":
    loader = new PDFLoader(filePath);
    break;
  case ".csv":
    loader = new CSVLoader(filePath);
    break;
  case ".json":
    loader = new JSONLoader(filePath);
    break;
  case ".docx":
    loader = new DocxLoader(filePath);
    break;
}

// 加载文档
const docs = await loader.load();
```

### 2. 文本分割器（Text Splitters）

将长文本分割成适合向量存储的小块

```javascript
// 从server/services/vectorStore.js的实际实现
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

/**
 * 创建文本分割器
 * @param {number} chunkSize 文本块大小
 * @param {number} chunkOverlap 重叠大小
 * @returns {RecursiveCharacterTextSplitter} 文本分割器
 */
export function createTextSplitter(chunkSize = 500, chunkOverlap = 50) {
  return new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });
}

/**
 * 将文档拆分成较小的块
 */
export async function splitDocuments(documents, textSplitter) {
  if (!textSplitter) {
    textSplitter = createTextSplitter();
  }
  
  // 拆分所有文档
  const splitDocs = [];

  for (const doc of documents) {
    const splits = await textSplitter.splitDocuments([doc]);
    splitDocs.push(...splits);
  }

  console.log(`将 ${documents.length} 个文档分割为 ${splitDocs.length} 个块`);
  return splitDocs;
}
```

### 3. 向量存储（Vector Stores）

存储文档的向量表示，支持相似度搜索。

```javascript
// 从server/services/vectorStore.js的实际实现
import { MemoryVectorStore } from "langchain/vectorstores/memory";

/**
 * 从序列化数据加载内存向量存储
 */
export async function loadVectorStore(storePath, embeddings) {
  const jsonPath = `${storePath}.json`;

  // 读取序列化数据
  const serialized = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(serialized);

  // 创建新的内存向量存储
  const vectorStore = new MemoryVectorStore(embeddings);

  // 手动设置内存向量
  vectorStore.memoryVectors = data.vectors;
  vectorStore.documentIds = data.documentIds;

  return vectorStore;
}
```

### 4. 检索器（Retrievers）

从向量存储中检索相关文档。

```javascript
// 从server/services/queryService.js的createQAChain函数中提取
const PROMPT = PromptTemplate.fromTemplate(template);

// 创建问答链
return new RetrievalQAChain({
  combineDocumentsChain: loadQAStuffChain(llm, { prompt: PROMPT }),
  retriever: vectorStore.asRetriever(), // 向量库
  returnSourceDocuments: true,
});
```

### 5. 链（Chains）

将多个组件连接起来，形成端到端的应用流程。

LangChain.js提供了多种专用链，用于解决不同场景的问题：

#### RetrievalQAChain - 基础检索问答链

用于从向量存储中检索文档并生成答案：

```javascript
// 从server/services/queryService.js的实际实现
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";

/**
 * 创建问答链
 */
export async function createQAChain(
  llm,
  vectorStore,
  promptTemplate,
  sessionId
) {
  // 获取历史记录
  let historyText = "";
  if (sessionId) {
    try {
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
```

以下是 `LangChain.js` 中其他常用的链类型，可以根据不同需求选择使用：

#### LLMChain - 最基础的提示词处理链

将提示模板与语言模型结合的最基础链，是许多其他链的基础组件。

```javascript
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate(
  "请为{product}写一个简短的产品描述，面向{audience}用户"
);

const chain = new LLMChain({
  llm: model,
  prompt: prompt
});

const result = await chain.invoke({
  product: "智能音箱",
  audience: "年轻人"
});
```

#### ConversationalRetrievalChain - 融合记忆的对话检索链

结合了对话历史记忆和文档检索功能，用于构建能够记住上下文的问答系统，也是本项目中使用到的链。

```javascript
import { ConversationalRetrievalChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";

const memory = new BufferMemory({
  memoryKey: "chat_history",
  returnMessages: true,
  inputKey: "question",
  outputKey: "text",
});

const chain = new ConversationalRetrievalChain({
  retriever: vectorStore.asRetriever(),
  memory: memory,
  combineDocumentsChain: loadQAStuffChain(model),
});

// 首次查询
const result1 = await chain.invoke({
  question: "什么是向量数据库?"
});

// 后续查询(自动包含对话历史)
const result2 = await chain.invoke({
  question: "它有哪些优势?"
});
```

#### SequentialChain - 按顺序执行的多步链

允许多个链按照特定顺序执行，前一个链的输出可以作为后一个链的输入。

```javascript
import { SequentialChain, LLMChain } from "langchain/chains";

// 第一个链：生成产品特性
const featureChain = new LLMChain({
  llm: model,
  prompt: PromptTemplate.fromTemplate("列出{product}的三个主要特性"),
  outputKey: "features",
});

// 第二个链：根据特性写营销文案
const copywritingChain = new LLMChain({
  llm: model,
  prompt: PromptTemplate.fromTemplate("根据这些特性为{product}写一段营销文案:\n{features}"),
  outputKey: "marketing_copy",
});

// 组合成顺序链
const overallChain = new SequentialChain({
  chains: [featureChain, copywritingChain],
  inputVariables: ["product"],
  outputVariables: ["marketing_copy"],
});

const result = await overallChain.invoke({
  product: "智能手表",
});
```

#### RouterChain - 智能路由链

根据输入内容动态选择应该使用哪条链进行处理，适合构建能处理多种不同任务的系统。

```javascript
import { LLMRouterChain, RouterOutputParser } from "langchain/chains";

const productChain = new LLMChain({/*...产品查询链...*/});
const supportChain = new LLMChain({/*...客服支持链...*/});
const feedbackChain = new LLMChain({/*...用户反馈链...*/});

const routerChain = LLMRouterChain.fromLLM(
  model,
  RouterOutputParser.fromZodSchema(z.object({
    destination: z.enum(["product", "support", "feedback"]),
    next_inputs: z.object({
      query: z.string(),
    }),
  }))
);

const chain = new MultiRouteChain({
  routerChain,
  destinationChains: {
    product: productChain,
    support: supportChain,
    feedback: feedbackChain,
  },
  defaultChain: new LLMChain({/*...默认链...*/}),
});

const result = await chain.invoke({
  input: "我想了解你们的新产品"
});
```

这些链可以根据实际需求组合使用，`LangChain.js` 的强大之处就在于它提供了高度模块化的组件，使开发者能够灵活构建各种复杂的LLM应用。在本项目中，我们主要使用了 `RetrievalQAChain` 来实现基于知识库的问答功能，结合 `BufferMemory` 实现多轮对话能力。

### 6. 代理（Agents）

能够根据用户输入动态选择工具和执行步骤的系统。在本项目中，使用了 `LangChain` 的代理功能实现智能路由和增强回答能力：

```javascript
// 从server/services/agentService.js的实际实现
import { Serper } from "@langchain/community/tools/serper";
import { Tool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { createEmbeddingModel } from "./embeddings.js";
import { addToMemory, getMemoryForSession } from "./memoryService.js";
import { createChatModel } from "./queryService.js";
import { loadVectorStore, similaritySearch } from "./vectorStore.js";

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

    // 获取会话记忆
    const memory = sessionId ? getMemoryForSession(sessionId) : null;

    // 初始化Agent - 使用新的API创建Agent
    const agent = await createOpenAIFunctionsAgent({
      llm,
      tools,
      verbose: verbose || process.env.DEBUG === "true",
    });

    const executor = AgentExecutor.fromAgentAndTools({
      agent,
      tools,
      memory,
      verbose: verbose || process.env.DEBUG === "true",
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
```

在本项目中，代理系统通过以下方式增强了智能客服能力：

1.  **工具集成**：将网络搜索和知识库搜索集成为工具，供代理使用
2.  **动态决策**：代理会根据用户问题的性质，自动决定使用哪种工具
3.  **统一接口**：通过 `executeAgentQuery` 函数提供与普通查询相同的接口，便于集成
4.  **思维链追踪**：支持 `verbose` 模式，可以查看代理的决策过程，便于调试

路由系统也实现了一个简化版的判断功能，用于确定是否需要网络搜索：

```javascript
// 从server/services/webSearchService.js的实际实现
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
```

代理系统的用户体验在前端也得到了增强：

```javascript
// 从client/App.vue的相关部分
if (response.data.success) {
  // 主要回答
  chatHistory.value.push({
    role: 'assistant',
    content: response.data.answer || '未找到相关答案',
    usedGeneralModel: response.data.usedGeneralModel,
    usedWebSearch: response.data.usedWebSearch,
    usedAgent: response.data.usedAgent
  });
  
  // 如果使用了Agent，显示Agent信息
  if (response.data.usedAgent) {
    chatHistory.value.push({
      role: 'system',
      content: '通过智能代理提供的回答'
    });
  }
  // 如果使用了网络搜索，显示搜索结果来源
  else if (response.data.usedWebSearch && response.data.searchResults && response.data.searchResults.length > 0) {
    const searchResults = response.data.searchResults;
    const resultInfo = "网络搜索结果来源：\n" + 
      searchResults.map((result, index) => 
        `- [${index + 1}] ${result.title} (${result.displayLink})`
      ).join('\n');
    
    chatHistory.value.push({
      role: 'system',
      content: resultInfo
    });
  }
}
```

## 前端实现

我们的前端使用 `Vue3` 构建，提供直观的用户界面进行文档上传和交互式对话。

### 关键组件

前端界面主要包含两个核心功能区域：

1.  **文档上传与管理**：允许用户上传文档并构建知识库
2.  **查询设置**：可以选择是否开启记忆、网络搜索、agent 代理，设置相似度阈值等
3.  **对话界面**：进行基于知识库的智能问答

以下是对话界面的关键代码片段：

```vue
<template>
  <div class="chat-container">
    <!-- 聊天历史 -->
    <div class="chat-history" ref="chatHistoryRef">
      <div v-for="(message, index) in chatHistory" :key="index" class="message" 
           :class="message.role">
        <div class="message-content">{{ message.content }}</div>
      </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="chat-input">
      <div class="input-wrapper">
        <input
          v-model="userInput"
          @keyup.enter="sendMessage"
          placeholder="在此输入问题..."
          :disabled="isLoading"
        />
        <button @click="sendMessage" :disabled="isLoading || !userInput">
          {{ isLoading ? '思考中...' : '发送' }}
        </button>
      </div>
      
      <!-- 查询设置 -->
      <div class="query-settings">
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" v-model="useMemory" />
          <label class="form-check-label">记忆对话历史</label>
        </div>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" v-model="useGeneralModelFallback" />
          <label class="form-check-label">使用通用模型回退</label>
        </div>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" v-model="useWebSearch" />
          <label class="form-check-label">启用网络搜索</label>
        </div>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" v-model="useAgent" />
          <label class="form-check-label">使用智能代理</label>
        </div>
      </div>
    </div>
  </div>
</template>
```

前端的核心查询逻辑：

```javascript
// 发送查询到后端
async function sendQuery() {
  try {
    isLoading.value = true;
    const response = await axios.post('/api/query', {
      query: userInput.value,
      vectorStorePath: selectedVectorStore.value,
      similarityThreshold: parseFloat(similarityThreshold.value),
      useGeneralModelFallback: useGeneralModelFallback.value,
      useWebSearch: useWebSearch.value,
      sessionId: useMemory.value ? sessionId.value : null,
      useAgent: useAgent.value
    });

    // 处理响应...
    if (response.data.success) {
      chatHistory.value.push({
        role: 'assistant',
        content: response.data.answer
      });
      
      // 显示来源信息
      // ...
    }
  } catch (error) {
    console.error('查询失败:', error);
    chatHistory.value.push({
      role: 'system',
      content: '查询失败，请稍后再试'
    });
  } finally {
    isLoading.value = false;
    userInput.value = '';
  }
}
```

## 后端实现：Express服务

后端使用 `Express` 框架，提供 `RESTful API` 供前端调用。

### 路由系统

服务端的路由主要分为两部分：

1.  **文档路由**：处理文档上传、分割、向量化等
2.  **查询路由**：处理用户查询、响应生成等

路由的关键实现：

```javascript
// server/routes/queryRoutes.js
import express from "express";
import { clearMemory } from "../services/memoryService.js";
import { executeQuery, searchSimilarDocs } from "../services/queryService.js";
import { executeAgentQuery } from "../services/agentService.js";

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
      useAgent = false,
    } = req.body;

    // 参数验证...

    const options = {
      vectorStorePath,
      apiKey: process.env.OPENAI_API_KEY,
      apiEndpoint: process.env.OPENAI_API_ENDPOINT,
      modelName: process.env.MODEL_NAME,
      similarityThreshold:
        similarityThreshold !== undefined ? similarityThreshold : 0.6,
      useGeneralModelFallback:
        useGeneralModelFallback !== undefined ? useGeneralModelFallback : true,
      useWebSearch: useWebSearch !== undefined ? useWebSearch : false,
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

// 其他路由...

export default router;
```

## 核心服务实现

### 1. 文档加载与处理

`documentLoader.js`负责文档的加载、分割和向量化处理：

```javascript
// server/services/documentLoader.js
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { DirectoryLoader } from "langchain/document_loaders";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

/**
 * 根据文件路径和类型加载文档
 */
export async function loadDocumentsFromPath(filePath, fileType) {
  let loader;

  // 根据文件类型选择加载器
  switch (fileType) {
    case "pdf":
      loader = new PDFLoader(filePath);
      break;
    case "txt":
      loader = new TextLoader(filePath);
      break;
    case "docx":
      loader = new DocxLoader(filePath);
      break;
    case "csv":
      loader = new CSVLoader(filePath);
      break;
    // 其他文件类型...
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }

  return await loader.load();
}

/**
 * 分割文档为较小的块
 */
export async function splitDocuments(documents, chunkSize = 1000, chunkOverlap = 200) {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  return await textSplitter.splitDocuments(documents);
}
```

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/5a60f487903b4c5a85cc686662c5ddd6~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgX2ppYW5n:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiODYyNDg3NTIyMzE0MzY2In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1748177654&x-orig-sign=5JvPxi%2FwuQJEwmB2ykF36yiIwts%3D)

### 2. 向量存储

`vectorStore.js`实现了向量存储的创建与查询功能：

```javascript
// server/services/vectorStore.js
import fs from "fs";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import path from "path";

/**
 * 从序列化数据加载内存向量存储
 * @param {string} storePath 存储路径
 * @param {object} embeddings 嵌入模型
 * @returns {Promise<MemoryVectorStore>} 内存向量存储
 */
export async function loadVectorStore(storePath, embeddings) {
  const jsonPath = `${storePath}.json`;

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`向量存储路径不存在: ${jsonPath}`);
  }

  if (!embeddings) {
    throw new Error("未提供嵌入模型");
  }

  try {
    console.log(`从 ${jsonPath} 加载内存向量存储`);

    // 读取序列化数据
    const serialized = fs.readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(serialized);

    // 创建新的内存向量存储
    const vectorStore = new MemoryVectorStore(embeddings);

    // 手动设置内存向量
    vectorStore.memoryVectors = data.vectors;
    vectorStore.documentIds = data.documentIds;

    return vectorStore;
  } catch (error) {
    console.error("加载向量存储失败:", error);
    throw error;
  }
}

/**
 * 在向量存储中进行相似度搜索
 * @param {MemoryVectorStore} vectorStore 向量存储
 * @param {string} query 查询文本
 * @param {number} k 返回结果数量
 * @param {number} threshold 相似度阈值（0-1），低于此阈值的结果将被过滤
 * @returns {Promise<Array>} 相似文档数组和得分
 */
export async function similaritySearch(
  vectorStore,
  query,
  k = 4,
  threshold = 0.0
) {
  if (!vectorStore) {
    throw new Error("未提供向量存储");
  }

  if (!query || query.trim().length === 0) {
    throw new Error("查询文本为空");
  }

  try {
    console.log(`在向量存储中搜索: "${query}"`);

    // 使用带分数的搜索
    const resultsWithScore = await vectorStore.similaritySearchWithScore(
      query,
      k
    );

    // 如果设置了阈值，过滤低于阈值的结果
    const filteredResults =
      threshold > 0
        ? resultsWithScore.filter(([, score]) => score >= threshold)
        : resultsWithScore;

    console.log(
      `找到 ${filteredResults.length} 个相关文档，阈值: ${threshold}`
    );

    // 返回文档和分数
    return filteredResults;
  } catch (error) {
    console.error("相似度搜索失败:", error);
    throw error;
  }
}
```

在本项目中，我们选择了 `MemoryVectorStore` 作为向量存储方案。`MemoryVectorStore` 是 `LangChain` 内置的一种内存向量存储实现，适合中小规模应用，具有以下特点：

1.  **本地内存存储**：所有向量都保存在内存中，适合快速开发和测试
2.  **序列化支持**：通过 `JSON序列化` 保存到文件系统，方便持久化
3.  **简单集成**：无需额外依赖，直接集成到 `Node.js` 应用
4.  **高效检索**：支持余弦相似度等多种相似度计算方法

向量存储的核心功能包括：

1.  **存储文档向量**：将文档的向量表示持久化存储
2.  **相似度搜索**：根据查询向量快速检索最相似的文档
3.  **过滤低相关度结果**：通过阈值控制，确保只返回相关性足够高的文档

通过`threshold`参数，我们可以灵活调整相似度阈值，在查询精度和召回率之间取得平衡。在实际应用中，这个阈值通常需要根据业务场景和文档特性进行调整，推荐在 `0.5-0.8` 之间进行测试。

### 3. 嵌入模型

在 [硅基流动](https://cloud.siliconflow.cn/models?types=embedding) 中选择一个适合的嵌入模型

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/fb9df0d8ee8744e6987a67171549e9f3~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgX2ppYW5n:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiODYyNDg3NTIyMzE0MzY2In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1748177654&x-orig-sign=61VPHI9lF%2B5sgaOSjD3neg%2BVXKk%3D)

`embeddings.js` 负责将文本转换为向量：

```javascript
// server/services/embeddings.js
import axios from "axios";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

/**
 * BGE嵌入模型实现
 */
export class BGEEmbeddings {
  constructor() {
    this.apiKey = process.env.EMBEDDING_API_KEY;
    this.apiUrl = process.env.EMBEDDING_ENDPOINT;
    this.modelName = process.env.EMBEDDING_MODEL;

    this.client = axios.create({
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`初始化嵌入模型: ${this.modelName}`);
    console.log(`API端点: ${this.apiUrl}`);
  }

  /**
   * 嵌入文档
   * @param {Array<string>} texts 文本数组
   * @returns {Promise<Array<Array<number>>>} 嵌入向量数组
   */
  async embedDocuments(texts) {
    if (!texts || texts.length === 0) {
      throw new Error("没有提供文本进行嵌入");
    }

    try {
      console.log(`嵌入 ${texts.length} 个文本`);

      // 批次处理，每批最多处理10个文本
      const batchSize = 10;
      const batches = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }

      console.log(`将文本分为 ${batches.length} 批进行处理`);

      // 处理每一批
      const embeddings = [];
      for (const batch of batches) {
        const batchEmbeddings = await this._embedBatch(batch);
        embeddings.push(...batchEmbeddings);
      }

      return embeddings;
    } catch (error) {
      console.error("嵌入文档失败:", error);
      throw error;
    }
  }

  /**
   * 嵌入查询
   * @param {string} text 查询文本
   * @returns {Promise<Array<number>>} 嵌入向量
   */
  async embedQuery(text) {
    if (!text || text.trim().length === 0) {
      throw new Error("没有提供查询文本进行嵌入");
    }

    try {
      const embeddings = await this._embedBatch([text]);
      return embeddings[0];
    } catch (error) {
      console.error("嵌入查询失败:", error);
      throw error;
    }
  }
}

/**
 * 创建嵌入模型的工厂函数
 * @returns {BGEEmbeddings} 嵌入模型实例
 */
export function createEmbeddingModel() {
  return new BGEEmbeddings();
}
```

嵌入模型是 `RAG` 系统的核心组件，负责将文本转化为高维向量空间中的点。在本项目中，我们使用硅基流动免费的 `BGE嵌入模型`，它是一个优秀的开源嵌入模型，通过 `API` 调用方式集成到系统中。

嵌入模型工作原理：

1.  **文本编码**：接收文本输入，进行分词和编码处理
2.  **特征提取**：通过深度神经网络提取文本的语义特征
3.  **向量生成**：将特征映射到高维向量空间
4.  **向量归一化**：确保向量的长度统一，便于后续计算余弦相似度

在实际应用中，我们将同一嵌入模型用于两个场景：

1.  **文档向量化**：在知识库构建阶段，将文档片段转换为向量并存储
2.  **查询向量化**：在查询阶段，将用户问题转换为向量并与知识库进行相似度匹配

通过使用相同的嵌入模型，确保文档和查询在同一向量空间中进行比较，从而获得准确的相似度计算结果。

BGEEmbeddings实现了批量处理功能，通过将大量文本分批处理，有效避免API限制和内存问题，提高了系统的稳定性和扩展性。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/160d0f4d73b742d3bbaab7193de8f4f6~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgX2ppYW5n:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiODYyNDg3NTIyMzE0MzY2In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1748177654&x-orig-sign=KbMT9BfyMC1MaMVh%2F8jKHFkZrNQ%3D)

### 4. 会话记忆

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/5021a1ba41704cdd945e02645bf7092c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgX2ppYW5n:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiODYyNDg3NTIyMzE0MzY2In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1748177654&x-orig-sign=30nhQKC4zHzenfvSe%2BU23SRzVxA%3D)

`memoryService.js`实现了对话历史的记忆功能，使用 LangChain 的 BufferMemory：

```javascript
// server/services/memoryService.js
import { BufferMemory } from "langchain/memory";

// 使用Map存储不同会话的记忆实例
const memoryInstances = new Map();

/**
 * 获取或创建一个会话记忆
 * @param {string} sessionId 会话ID
 * @returns {BufferMemory} 会话记忆实例
 */
export function getMemoryForSession(sessionId) {
  if (!sessionId) {
    return new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "question", // 使用question而不是input，与ConversationalRetrievalChain兼容
      outputKey: "text", // 使用text而不是output，与ConversationalRetrievalChain兼容
    });
  }

  // 如果会话ID已存在，返回现有的记忆
  if (memoryInstances.has(sessionId)) {
    return memoryInstances.get(sessionId);
  }

  // 否则创建新的记忆
  const memory = new BufferMemory({
    returnMessages: true,
    memoryKey: "chat_history",
    inputKey: "question", // 使用question而不是input，与ConversationalRetrievalChain兼容
    outputKey: "text", // 使用text而不是output，与ConversationalRetrievalChain兼容
  });

  memoryInstances.set(sessionId, memory);
  console.log(`为会话 ${sessionId} 创建了新的记忆实例`);

  return memory;
}

/**
 * 将新的对话轮次添加到记忆中
 * @param {string} sessionId 会话ID
 * @param {string} humanInput 用户输入
 * @param {string} aiOutput AI回答
 * @returns {Promise<void>}
 */
export async function addToMemory(sessionId, humanInput, aiOutput) {
  if (!sessionId) return;

  try {
    // 确保输入和输出都是字符串
    const inputText = humanInput ? String(humanInput).trim() : "";
    const outputText = aiOutput ? String(aiOutput).trim() : "";

    if (!inputText || !outputText) {
      console.log(`跳过记忆保存: 输入或输出为空 (sessionId: ${sessionId})`);
      return;
    }

    // 获取会话记忆
    const memory = getMemoryForSession(sessionId);

    // 添加新的消息到记忆，注意使用与BufferMemory配置中相同的键名
    await memory.saveContext({ question: inputText }, { text: outputText });

    console.log(`已将对话添加到会话 ${sessionId} 的记忆中`);
  } catch (error) {
    console.error(`向记忆添加对话失败:`, error);
  }
}
```

能够自动存储到 `localStorage` 中，便于查看与调试：

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/d1c684af308f4a05a1fbec19f57d15c3~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgX2ppYW5n:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiODYyNDg3NTIyMzE0MzY2In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1748177654&x-orig-sign=hGyLDjoM7qZ%2FAMu%2F29c0V8QFMmk%3D)

会话记忆是智能客服系统的关键组件，使AI能够理解多轮对话的上下文，从而提供连贯、个性化的回复。在本项目中，我们采用LangChain内置的BufferMemory组件，它提供了以下优势：

1.  **标准化接口**：提供了统一的记忆管理接口，简化了与LangChain其他组件的集成
2.  **消息序列化**：自动处理消息对象的序列化和反序列化
3.  **会话上下文管理**：专为对话场景设计，优化了上下文传递
4.  **兼容性保证**：与LangChain的链和代理系统无缝集成

BufferMemory的核心配置参数包括：

*   **returnMessages**: 设置为true时返回消息对象而非字符串，便于后续处理
*   **memoryKey**: 定义在输出变量中用于存储对话历史的键名，本项目使用"chat\_history"
*   **inputKey**: 用户输入在上下文中的键名，本项目使用"question"
*   **outputKey**: AI输出在上下文中的键名，本项目使用"text"

在实现中，我们使用Map作为内存缓存，每个会话通过唯一sessionId映射到各自的BufferMemory实例。这种设计保持了会话之间的严格隔离，同时利用了LangChain提供的记忆管理功能。

### 5. 查询服务

`queryService.js`是系统的核心，处理用户查询并决定如何获取回答：

```javascript
// server/services/queryService.js (关键部分)
import { PromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createEmbeddingModel } from "./embeddings.js";
import { addToMemory, getFormattedHistory, getMemoryForSession } from "./memoryService.js";
import { loadVectorStore, similaritySearch } from "./vectorStore.js";
import { getAnswerFromWebSearch } from "./webSearchService.js";

/**
 * 创建问答链
 * @param {object} llm 语言模型
 * @param {object} vectorStore 向量存储
 * @param {string} promptTemplate 提示模板
 * @param {string} sessionId 用户会话ID
 * @returns {Promise<object>} 问答链
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

  // 获取会话的记忆实例
  const memory = getMemoryForSession(sessionId);

  // 默认QA提示模板
  const qaTemplate =
    promptTemplate ||
    `请根据以下信息回答用户的问题。如果无法从提供的信息中找到答案，请明确告知您不知道，不要编造信息。

信息:
{context}

用户问题: {question}

请用中文简明扼要地回答:`;

  const PROMPT = PromptTemplate.fromTemplate(qaTemplate);

  // 创建文档合并链 - 使用新的API
  const documentChain = await createStuffDocumentsChain({
    llm,
    prompt: PROMPT,
  });

  // 创建检索链 - 使用新的API
  return createRetrievalChain({
    retriever: vectorStore.asRetriever(),
    combineDocsChain: documentChain,
    memory,
    returnSourceDocuments: true,
  });
}

/**
 * 执行查询
 */
export async function executeQuery(query, options) {
  const {
    vectorStorePath,
    similarityThreshold = 0.6,
    useGeneralModelFallback = true,
    useWebSearch = false,
    sessionId = null,
  } = options;

  try {
    // 加载向量存储
    const embeddings = createEmbeddingModel();
    const vectorStore = await loadVectorStore(vectorStorePath, embeddings);
    const llm = createChatModel(options.apiKey, options.modelName, options.apiEndpoint);

    // 搜索相关文档
    const searchResults = await similaritySearch(
      vectorStore,
      query,
      4,
      similarityThreshold
    );

    // 如果没有找到相似度足够高的文档
    if (searchResults.length === 0) {
      console.log("未找到相似度足够高的文档");

      // 如果开启了网络搜索
      if (useWebSearch) {
        console.log("使用网络搜索获取答案");
        const webSearchResult = await getAnswerFromWebSearch(query);

        // 更新会话记忆
        if (sessionId) {
          const answer = webSearchResult.output || webSearchResult.answer;
          if (answer) {
            await addToMemory(sessionId, query, answer);
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
      // 如果开启了通用模型回退
      else if (useGeneralModelFallback) {
        console.log("使用通用模型回答问题");
        const generalAnswer = await queryGeneralModel(query, llm, sessionId);

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
    console.log(`找到 ${searchResults.length} 个相关文档，执行LangChain问答链...`);
    const chain = await createQAChain(llm, vectorStore, null, sessionId);

    // 使用新的invoke方法调用链
    const result = await chain.invoke({
      question: query,
    });

    console.log("LangChain查询完成");

    // 从结果中获取text和sourceDocuments，兼容新版本的返回格式
    const answerText = result.answer || result.text || result.output || result;
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

    // createRetrievalChain已自动处理记忆保存，不需要手动更新

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
```

### 6. 网络搜索

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/d123ab26fd3243a6a346f198e424e79d~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgX2ppYW5n:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiODYyNDg3NTIyMzE0MzY2In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1748177654&x-orig-sign=nZIPkBMIy8MGCx1XOoU242p6Owk%3D)

请提前在 [serper](https://serper.dev/) 自行申请一个 `apikey`

`webSearchService.js`实现了网络搜索功能，增强大模型的实时信息获取能力：

```javascript
// server/services/webSearchService.js
import { Serper } from "@langchain/community/tools/serper";
import dotenv from "dotenv";
import { createChatModel } from "./queryService.js";

// 加载环境变量
dotenv.config();

// 缓存机制，避免重复请求
const searchCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1小时

/**
 * 使用网络搜索回答问题
 */
export async function getAnswerFromWebSearch(query, options = {}) {
  // 确保有API密钥
  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey) {
    console.error("缺少SERPER_API_KEY环境变量");
    return {
      answer: "无法执行网络搜索，未配置SERPER_API_KEY环境变量。",
      output: "无法执行网络搜索，未配置SERPER_API_KEY环境变量。",
      searchResults: []
    };
  }

  // 缓存检查
  const cacheKey = query.trim().toLowerCase();
  if (searchCache.has(cacheKey)) {
    const cachedResult = searchCache.get(cacheKey);
    if (Date.now() - cachedResult.timestamp < CACHE_TTL) {
      console.log(`从缓存获取结果: "${query}"`);
      return cachedResult.data;
    } else {
      searchCache.delete(cacheKey);
    }
  }

  try {
    // 执行网络搜索
    const searchResults = await fetch("https://google.serper.dev/search", {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        gl: "cn",
        hl: "zh-cn"
      })
    }).then(res => res.json())
      .then(data => data.organic || [])
      .then(items => items.slice(0, 3).map(item => ({
        title: item.title || "",
        link: item.link || "",
        snippet: item.snippet || "",
        displayLink: item.displayedLink || item.link || "",
      })));

    // 使用语言模型总结搜索结果
    if (searchResults.length > 0) {
      const searchContext = formatSearchResultsAsContext(searchResults);
      const model = createChatModel(null, process.env.MODEL_NAME || "gpt-3.5-turbo");
      model.temperature = 0;
      
      const prompt = `根据以下搜索结果，请简明扼要地回答问题: "${query}"
      
搜索结果:
${searchContext}

请用中文回答，清晰准确，避免重复内容。`;

      const response = await model.invoke(prompt);
      const answer = typeof response === "string" ? response : response.content;
      
      // 缓存结果
      const result = { answer, output: answer, searchResults };
      searchCache.set(cacheKey, { timestamp: Date.now(), data: result });
      
      return result;
    } else {
      return {
        answer: "抱歉，我没有找到与您问题相关的搜索结果。",
        output: "抱歉，我没有找到与您问题相关的搜索结果。",
        searchResults: []
      };
    }
  } catch (error) {
    console.error("网络搜索回答问题失败:", error);
    return {
      answer: `我无法通过搜索回答此问题。错误: ${error.message}`,
      output: `我无法通过搜索回答此问题。错误: ${error.message}`,
      searchResults: []
    };
  }
}
```

网络搜索功能是增强 `RAG` 系统实时性和全面性的关键组件，特别适用于以下场景：

1.  **知识库无法覆盖的问题**：当用户询问知识库中不存在的信息时
2.  **需要最新信息的查询**：对于涉及时效性的问题（如近期新闻、产品更新等）
3.  **事实性验证**：需要对特定事实进行确认或补充的情况

在本项目中，我们实现了一个基于 `Serper API` 的网络搜索服务。`Serper` 是一个 `Google` 搜索 `API` 服务，提供了结构化的搜索结果，非常适合程序化处理。

## 项目总结

通过本项目，我们构建了一个完整的基于 `LangChain.js` 的智能客服平台，实现了以下核心功能：

1.  **文档处理与向量化**：将各种格式的文档转换为可检索的向量形式
2.  **智能查询路由**：根据查询内容智能选择使用本地知识库、通用模型或网络搜索
3.  **会话记忆**：实现多轮对话，保持上下文连贯性
4.  **智能代理**：自动决策使用哪种工具回答用户问题
5.  **网络搜索增强**：通过实时网络搜索弥补知识库的不足

### LangChain.js在项目中的应用价值

`LangChain.js` 作为一个强大的LLM应用开发框架，在本项目中展现出以下优势：

1.  **组件化开发**：提供了丰富的预构建组件，如文档加载器、文本分割器、向量存储等
2.  **链式调用**：能够将多个处理步骤组合为统一的调用链，简化复杂流程
3.  **提示词工程**：内置提示词模板系统，便于管理和优化与LLM的交互
4.  **代理系统**：支持基于工具的智能代理，使AI能够根据需要选择不同功能
5.  **多模型支持**：与多种LLM和嵌入模型兼容，提供更大的灵活性

## 结语

`LangChain.js` 为开发者提供了构建复杂 `AI` 应用的强大工具集，大幅简化了大语言模型应用的开发流程。

通过组合文档处理、向量存储、智能查询、会话记忆和网络搜索等功能，我们创建了一个既能利用专有知识库又能获取实时信息的智能系统。这种方法不仅提高了回答的相关性和准确性，还大幅降低了开发复杂AI应用的技术门槛。

如果觉得本文对您有帮助，可以收藏一波，也希望能够给项目仓库点个 star\~
