# 从零开始构建一个基于LangChain.js的本地知识库问答系统

![LangChain.js封面图](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/762b49d9f6d04d4e859b7a877a3f8771~tplv-k3u1fbpfcp-zoom-crop-mark:1512:1512:1512:851.awebp?)

> 作者：前端森林
> 
> 本文介绍如何使用LangChain.js构建一个功能完整的本地知识库问答系统，实现对多种文档格式的处理、高效的向量检索以及多轮对话记忆功能。希望这篇文章能够帮助你入门LangChain.js开发。

## 通过本文你能学到什么？

- LangChain.js的基本原理和核心概念
- 嵌入模型的原理及其在文档检索中的应用
- 如何构建向量数据库和实现高效的文档检索
- 如何实现RAG（检索增强生成）技术
- 如何创建多轮对话记忆功能
- 如何构建支持多种文档格式的上传和处理系统
- Vue 3和Node.js结合实现全栈应用的技巧

## 项目目录结构

首先，让我们来看一下项目的整体目录结构，了解各个文件的职责：

```
langchain-knowledge-base/
├── client/                # 前端目录
│   ├── public/            # 静态资源
│   │   ├── App.vue        # 主应用组件，处理文件上传、聊天和会话管理
│   │   ├── main.js        # 应用入口文件
│   │   └── assets/        # 资源文件
│   ├── index.html         # HTML入口
│   └── package.json       # 前端依赖
│
├── server/                # 后端目录
│   ├── index.js           # 服务器入口文件
│   ├── routes/            # API路由
│   │   ├── documentRoutes.js  # 文档处理相关路由
│   │   └── queryRoutes.js     # 查询处理相关路由
│   ├── services/          # 业务逻辑服务
│   │   ├── documentLoader.js  # 文档加载服务
│   │   ├── embeddings.js      # 嵌入模型服务
│   │   ├── queryService.js    # 查询处理服务
│   │   └── vectorStore.js     # 向量存储服务
│   ├── uploads/           # 文件上传临时目录
│   ├── vector_stores/     # 向量存储目录
│   └── package.json       # 后端依赖
│
├── .env                   # 环境变量
└── package.json           # 项目根目录依赖
```

各文件职责说明：

- **client/App.vue**: 前端主界面，实现文件上传、文档处理、聊天交互等功能
- **server/index.js**: 后端入口，配置Express服务器和中间件
- **server/routes/documentRoutes.js**: 处理文档上传和向量化的API路由
- **server/routes/queryRoutes.js**: 处理问答查询的API路由
- **server/services/documentLoader.js**: 加载和处理各种格式的文档
- **server/services/embeddings.js**: 创建和配置嵌入模型
- **server/services/queryService.js**: 实现RAG问答和多轮对话记忆功能
- **server/services/vectorStore.js**: 管理向量存储的创建、加载和检索

## LangChain.js简介

LangChain是一个用于开发由大型语言模型（LLM）驱动的应用程序的框架。LangChain.js是其JavaScript版本，为构建基于LLM的应用提供了一整套工具和组件。

### 核心概念

LangChain.js的设计围绕以下几个核心概念：

1. **链(Chains)**: 将多个组件（如LLM、提示模板、工具等）组合在一起，形成一个执行复杂任务的管道。
2. **向量存储(Vector Stores)**: 将文本转换为向量并存储，实现高效的语义搜索。
3. **记忆(Memory)**: 存储对话历史，实现多轮交互中的上下文理解。
4. **文档加载器(Document Loaders)**: 从各种来源加载和处理文档。
5. **文本分割器(Text Splitters)**: 将长文本分割成更小的块，便于处理和检索。
6. **提示模板(Prompt Templates)**: 构建和管理提示词，让LLM生成符合预期的输出。

### 嵌入模型详解

嵌入模型（Embedding Model）是RAG系统的核心组件之一，它负责将文本内容转换为高维向量，使计算机能够"理解"文本的语义信息。

**嵌入模型的工作原理**：
- 将文本输入转换为固定长度的数值向量（通常是几百到几千维）
- 语义相似的文本会被映射到向量空间中相近的位置
- 通过计算向量之间的距离（通常是余弦相似度）来衡量文本之间的语义相似度

**在我们的项目中**，嵌入模型的实现如下：

```javascript
// server/services/embeddings.js
import { OpenAIEmbeddings } from "@langchain/openai";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

/**
 * 创建嵌入模型
 * @returns {OpenAIEmbeddings} 嵌入模型实例
 */
export function createEmbeddingModel() {
  // 从环境变量获取配置
  const apiKey = process.env.EMBEDDING_API_KEY;
  const modelName = process.env.EMBEDDING_MODEL;
  const endpoint = process.env.EMBEDDING_ENDPOINT;

  if (!apiKey) {
    throw new Error("未提供嵌入API密钥");
  }

  // 创建嵌入模型配置
  const embeddingOptions = {
    apiKey: apiKey,
    model: modelName || "text-embedding-ada-002",
  };

  if (endpoint) {
    embeddingOptions.basePath = endpoint;
  }

  // 创建并返回嵌入模型
  return new OpenAIEmbeddings(embeddingOptions);
}
```

这个嵌入模型服务将用于我们系统的两个关键环节：
1. 文档向量化：将文档内容转换为向量并存储
2. 查询向量化：将用户问题转换为向量，用于相似度检索

### RAG技术简介

RAG（Retrieval-Augmented Generation，检索增强生成）是一种结合文档检索和语言生成的技术，它的核心流程包括：

1. **索引阶段**: 将文档转换为向量并存储
2. **检索阶段**: 基于用户查询找到最相关的文档
3. **生成阶段**: 将检索到的文档作为上下文，让LLM生成回答

通过RAG技术，我们可以克服LLM知识截止日期的限制，实现基于最新自定义数据的问答功能。

## 项目核心功能实现

我们的本地知识库问答系统具有以下功能：

- 支持多种文档格式（.txt、.md、.pdf、.csv、.json、.docx）的上传和处理
- 实现文档向量化和高效检索
- 支持相似度阈值过滤，提高回答准确性
- 支持多轮对话记忆功能
- 当没有相关文档时自动切换到通用模型回答
- 美观的用户界面和良好的用户体验

下面我们详细讲解每个核心功能的实现。

### 1. 多格式文档加载与处理

我们需要支持多种文档格式的加载和处理，这通过`documentLoader.js`服务实现：

```javascript
// server/services/documentLoader.js
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

/**
 * 处理上传的文件
 * @param {Array} files 上传的文件数组
 * @param {object} filenameMap 文件名映射
 * @returns {Promise<object>} 处理结果
 */
export async function processUploadedFiles(files, filenameMap = {}) {
  if (!files || files.length === 0) {
    throw new Error("未提供文件");
  }

  const extractedTexts = [];
  const documents = [];

  for (const file of files) {
    // 获取文件路径和原始文件名
    const filePath = file.path;
    const originalFilename = filenameMap[file.filename] || file.originalname || file.filename;
    
    console.log(`处理文件: ${originalFilename} (${file.size} 字节)`);

    try {
      // 根据文件扩展名选择合适的加载器
      let loader;
      const fileExt = originalFilename.toLowerCase().split('.').pop();

      switch (fileExt) {
        case 'txt':
          console.log(`使用 TextLoader 加载文件`);
          loader = new TextLoader(filePath);
          break;
        case 'pdf':
          console.log(`使用 PDFLoader 加载文件`);
          loader = new PDFLoader(filePath);
          break;
        case 'csv':
          console.log(`使用 CSVLoader 加载文件`);
          loader = new CSVLoader(filePath);
          break;
        case 'json':
          console.log(`使用 JSONLoader 加载文件`);
          loader = new JSONLoader(filePath, "/texts");
          break;
        case 'docx':
          console.log(`使用 DocxLoader 加载文件`);
          loader = new DocxLoader(filePath);
          break;
        case 'md':
          console.log(`使用 TextLoader 加载文档`);
          loader = new TextLoader(filePath);
          break;
        default:
          console.log(`使用 TextLoader 加载文件`);
          loader = new TextLoader(filePath);
      }

      // 加载文档
      const loadedDocs = await loader.load();
      console.log(`成功从 ${originalFilename} 加载 ${loadedDocs.length} 个文档`);

      // 处理加载的文档
      for (const doc of loadedDocs) {
        // 设置元数据
        doc.metadata.source = originalFilename;
        doc.metadata.filePath = filePath;
        
        // 添加到文档数组
        documents.push(doc);
        
        // 提取文本
        extractedTexts.push({
          filename: originalFilename,
          text: doc.pageContent,
          metadata: doc.metadata
        });
      }
    } catch (error) {
      console.error(`处理文件 ${originalFilename} 失败:`, error);
      throw new Error(`处理文件 ${originalFilename} 失败: ${error.message}`);
    }
  }

  return {
    extractedTexts,
    documents
  };
}
```

这个服务能够根据文件扩展名自动选择合适的加载器，处理各种格式的文档，并提取其中的文本内容。

### 2. 文档分割与向量存储

文档加载后，需要将其分割为适当大小的块，然后转换为向量并存储。这个过程通过`vectorStore.js`服务实现：

```javascript
// server/services/vectorStore.js
import fs from "fs";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import path from "path";

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
 * @param {Array} documents 文档数组
 * @param {RecursiveCharacterTextSplitter} textSplitter 文本分割器
 * @returns {Promise<Array>} 分割后的文档数组
 */
export async function splitDocuments(documents, textSplitter) {
  if (!documents || documents.length === 0) {
    throw new Error("没有提供文档进行分割");
  }

  if (!textSplitter) {
    textSplitter = createTextSplitter();
  }

  try {
    // 拆分所有文档
    const splitDocs = [];

    for (const doc of documents) {
      const splits = await textSplitter.splitDocuments([doc]);
      splitDocs.push(...splits);
    }

    console.log(`将 ${documents.length} 个文档分割为 ${splitDocs.length} 个块`);
    return splitDocs;
  } catch (error) {
    console.error("分割文档失败:", error);
    throw error;
  }
}

/**
 * 从文档创建内存向量存储
 * @param {Array} documents 文档数组
 * @param {object} embeddings 嵌入模型
 * @param {string} storePath 存储路径（用于保存序列化数据）
 * @returns {Promise<MemoryVectorStore>} 内存向量存储
 */
export async function createVectorStore(documents, embeddings, storePath) {
  if (!documents || documents.length === 0) {
    throw new Error("没有提供文档进行向量化");
  }

  if (!embeddings) {
    throw new Error("未提供嵌入模型");
  }

  try {
    console.log(`开始为 ${documents.length} 个文档创建向量存储`);

    // 创建向量存储
    const vectorStore = await MemoryVectorStore.fromDocuments(
      documents,
      embeddings
    );

    // 如果提供了路径，保存向量存储的序列化数据
    if (storePath) {
      // 确保存储目录存在
      const storeDir = path.dirname(storePath);
      if (!fs.existsSync(storeDir)) {
        fs.mkdirSync(storeDir, { recursive: true });
      }

      // 序列化向量存储
      const serialized = JSON.stringify({
        vectors: vectorStore.memoryVectors,
        documentIds: vectorStore.documentIds,
      });

      fs.writeFileSync(`${storePath}.json`, serialized);
      console.log(`内存向量存储已保存到: ${storePath}.json`);
    }

    return vectorStore;
  } catch (error) {
    console.error("创建向量存储失败:", error);
    throw error;
  }
}

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
export async function similaritySearch(vectorStore, query, k = 4, threshold = 0.0) {
  if (!vectorStore) {
    throw new Error("未提供向量存储");
  }

  if (!query || query.trim().length === 0) {
    throw new Error("查询文本为空");
  }

  try {
    console.log(`在向量存储中搜索: "${query}"`);
    
    // 使用带分数的搜索
    const resultsWithScore = await vectorStore.similaritySearchWithScore(query, k);
    
    // 如果设置了阈值，过滤低于阈值的结果
    const filteredResults = threshold > 0 ? 
      resultsWithScore.filter(([, score]) => score >= threshold) : 
      resultsWithScore;
    
    console.log(`找到 ${filteredResults.length} 个相关文档，阈值: ${threshold}`);
    
    // 返回文档和分数
    return filteredResults;
  } catch (error) {
    console.error("相似度搜索失败:", error);
    throw error;
  }
}
```

这个服务提供了一系列功能：
- 文本分割：将长文档分割成适当大小的块
- 向量存储创建：将文档块转换为向量并创建存储
- 向量存储的保存和加载：实现向量存储的持久化
- 相似度搜索：在向量存储中查找相似文档

### 3. RAG查询服务实现

有了文档的向量存储后，我们需要一个查询服务来处理用户的问题。这通过`queryService.js`实现：

```javascript
// server/services/queryService.js (部分核心代码)
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import { createEmbeddingModel } from "./embeddings.js";
import { loadVectorStore, similaritySearch } from "./vectorStore.js";

// 存储用户会话记忆的Map
const sessionMemories = new Map();

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

  try {
    // 创建嵌入模型
    const embeddings = createEmbeddingModel();

    // 加载向量存储
    const vectorStore = await loadVectorStore(vectorStorePath, embeddings);

    // 创建语言模型
    const llm = createChatModel(apiKey, modelName, apiEndpoint);

    // 首先检查是否有相似度高于阈值的文档
    const searchResults = await similaritySearch(
      vectorStore,
      query,
      4,
      similarityThreshold
    );

    // 如果没有找到相似度足够高的文档，且用户开启了通用模型回退
    if (searchResults.length === 0 && useGeneralModelFallback) {
      console.log("未找到相似度足够高的文档，使用通用模型回答问题");
      const generalAnswer = await queryGeneralModel(query, llm, sessionId);
      return {
        answer: generalAnswer,
        sources: [],
        usedGeneralModel: true,
      };
    }

    // 有结果或者用户要求不使用通用模型，使用问答链
    console.log(`找到 ${searchResults.length} 个相关文档，执行LangChain问答链...`);
    const chain = createQAChain(llm, vectorStore, null, sessionId);
    const result = await chain.call({ query: query });

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
      addMessageToMemory(sessionId, 'user', query);
      addMessageToMemory(sessionId, 'assistant', result.text);
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
```

这个查询服务实现了RAG的核心功能：
1. 使用嵌入模型将用户问题转换为向量
2. 在向量存储中查找相似文档
3. 根据相似度决定使用RAG还是通用模型
4. 将文档内容作为上下文，让LLM生成回答

### 4. 多轮对话记忆功能

为了实现自然的多轮对话，我们实现了记忆功能，也在`queryService.js`中：

```javascript
// 获取或创建用户会话的记忆
export function getOrCreateMemory(sessionId) {
  if (!sessionMemories.has(sessionId)) {
    // 创建新的会话记忆，使用简单数组存储历史记录
    sessionMemories.set(sessionId, []);
  }
  return sessionMemories.get(sessionId);
}

// 添加消息到会话记忆
export function addMessageToMemory(sessionId, role, content) {
  if (!sessionId) return;
  
  const memory = getOrCreateMemory(sessionId);
  memory.push({ role, content });
  
  // 保持历史记录在合理范围内，避免token过多
  if (memory.length > 10) {
    memory.shift(); // 移除最旧的消息
  }
}

// 格式化历史记录为提示模板可用的格式
export function formatChatHistory(messages) {
  if (!messages || messages.length === 0) return "";
  
  return messages.map(m => `${m.role === 'user' ? '人类' : 'AI'}: ${m.content}`).join('\n');
}

// 在查询中使用历史记录
export async function queryGeneralModel(query, llm, sessionId) {
  if (sessionId) {
    // 获取历史记录
    const chatHistory = getOrCreateMemory(sessionId);
    const formattedHistory = formatChatHistory(chatHistory);
    
    // 创建带历史记录的提示
    const template = `以下是人类和AI之间的对话。请根据对话历史回答人类的最新问题。

对话历史:
${formattedHistory ? formattedHistory + '\n' : ''}

人类: {question}

AI: `;

    const prompt = PromptTemplate.fromTemplate(template);
    const formattedPrompt = await prompt.format({ question: query });
    
    // 调用LLM
    const response = await llm.invoke(formattedPrompt);
    const answer = typeof response === 'string' ? response : response.content;
    
    // 更新会话历史
    addMessageToMemory(sessionId, 'user', query);
    addMessageToMemory(sessionId, 'assistant', answer);
    
    return answer;
  } else {
    // 单次调用逻辑...
  }
}
```

这种实现使AI能够记住之前的对话内容，从而进行更加连贯的多轮交互。

### 5. 前端实现

前端使用Vue 3的组合式API实现，主要代码在`App.vue`中：

```vue
<script setup>
import axios from 'axios';
import { nextTick, onMounted, ref, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';

// 状态变量
const selectedFiles = ref([]);
const processingStatus = ref(null);
const isProcessing = ref(false);
const vectorStorePath = ref('');
const chatHistory = ref([]);
const userQuery = ref('');
const sessionId = ref('');
const useMemory = ref(true);

// 初始化会话ID
onMounted(() => {
  // 从localStorage获取会话ID，或创建新的
  const savedSessionId = localStorage.getItem('chatSessionId');
  if (savedSessionId) {
    sessionId.value = savedSessionId;
  } else {
    // 创建新的会话ID
    resetSession();
  }
  
  // 从localStorage恢复聊天历史和向量存储路径
  // ...
});

// 文件上传和处理
const uploadFiles = async () => {
  isProcessing.value = true;
  
  try {
    // 第一步：上传文件并提取文本
    const formData = new FormData();
    
    // 添加所有选中的文件到formData
    for (let i = 0; i < selectedFiles.value.length; i++) {
      const file = selectedFiles.value[i];
      const safeFilename = `file_${Date.now()}_${i}${file.name.substring(file.name.lastIndexOf('.'))}`;
      formData.append('files', file, safeFilename);
      
      // 记录文件详情...
    }
    
    // 上传并提取文本
    const textExtractResponse = await axios.post('/api/extractText', formData);
    
    // 提取成功后向量化处理
    const extractedTexts = textExtractResponse.data.extractedTexts;
    
    const vectorizeRequest = {
      extractedTexts: extractedTexts,
      appendToExisting: appendToExisting.value,
      ...(appendToExisting.value && vectorStorePath.value ? { vectorStorePath: vectorStorePath.value } : {})
    };
    
    // 执行向量化
    const vectorizeResponse = await axios.post('/api/vectorize', vectorizeRequest);
    
    // 保存向量存储路径
    vectorStorePath.value = vectorizeResponse.data.vectorStorePath;
    
    // 更新界面状态...
    
  } catch (error) {
    console.error('处理文件失败', error);
  } finally {
    isProcessing.value = false;
  }
};

// 发送查询
const sendQuery = async () => {
  chatHistory.value.push({
    role: 'user',
    content: userQuery.value
  });
  
  const query = userQuery.value;
  userQuery.value = '';
  isQueryProcessing.value = true;
  
  try {
    // 构建查询请求
    const requestData = {
      query: query.substring(0, 1000), // 截断长文本
      vectorStorePath: vectorStorePath.value,
      similarityThreshold: parseFloat(similarityThreshold.value),
      useGeneralModelFallback: useGeneralModelFallback.value
    };
    
    // 如果启用了记忆功能，添加会话ID
    if (useMemory.value) {
      requestData.sessionId = sessionId.value;
    }
    
    // 发送查询请求
    const response = await axios.post('/api/query', requestData);
    
    // 处理回答和显示源文档
    chatHistory.value.push({
      role: 'assistant',
      content: response.data.answer,
      usedGeneralModel: response.data.usedGeneralModel
    });
    
    // 如果有源文档且不是使用通用模型，显示参考信息
    if (response.data.sources && response.data.sources.length > 0 && !response.data.usedGeneralModel) {
      const sources = response.data.sources;
      const sourceInfo = "参考信息来源：\n" + 
        sources.map(src => `- ${src.source} (相似度: ${src.similarity})`).join('\n');
      
      chatHistory.value.push({
        role: 'system',
        content: sourceInfo
      });
    }
    
  } catch (error) {
    console.error('查询失败', error);
    // 处理错误...
  } finally {
    isQueryProcessing.value = false;
  }
};

// 重置会话
const resetSession = () => {
  sessionId.value = uuidv4();
  localStorage.setItem('chatSessionId', sessionId.value);
};

// 清除历史记录
const clearChatHistory = () => {
  chatHistory.value = [];
  resetSession();
};
</script>
```

前端实现包括：
- 文件上传和处理功能
- 聊天界面和交互逻辑
- 会话管理和本地存储
- 各种用户体验优化

## 项目实现关键点总结

通过这个项目，我们实现了一个完整的本地知识库问答系统，其中最关键的几个技术点包括：

1. **文档处理链**: 从文件上传到文本提取，再到向量化的完整处理链。
2. **嵌入模型应用**: 将文本转换为向量，实现语义理解和检索。
3. **向量存储与检索**: 使用内存向量存储实现高效的文档检索。
4. **RAG实现**: 结合文档检索和语言生成，提高回答的准确性和知识覆盖面。
5. **相似度阈值过滤**: 通过设置相似度阈值，过滤掉不相关的文档，提高回答质量。
6. **记忆功能实现**: 使用自定义的会话记忆管理，支持多轮自然对话。
7. **无结果回退机制**: 当没有找到相关文档时，自动切换到通用模型回答。
8. **多格式文档支持**: 支持多种常见文档格式，提高系统的适用性。

这些关键技术点共同构建了一个功能完善、体验良好的知识库问答系统。

## 参考资料

1. [LangChain.js官方文档](https://js.langchain.com/docs/)
2. [OpenAI官方文档](https://platform.openai.com/docs/introduction)
3. [Vue 3官方文档](https://vuejs.org/guide/introduction.html)
4. [Express官方文档](https://expressjs.com/)
5. [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)
6. [掘金 - LangChain基础入门教程](https://juejin.cn/post/7490391876743921704)

## 结语

通过本文，我们从零开始构建了一个功能完整的基于LangChain.js的本地知识库问答系统。这个系统不仅能够处理多种文档格式，实现高效的向量检索，还支持多轮对话记忆功能，大大提升了用户体验。

希望这篇文章能够帮助你理解LangChain.js的核心概念和使用方法，为你开发更加强大的LLM应用提供参考。如果你有任何问题或建议，欢迎在评论区留言交流！

---

如果你喜欢这篇文章，别忘了点赞、收藏和关注，我会持续分享更多关于AI应用开发的实用技术文章。一起探索人工智能的无限可能！

