# LangChain.js 学习笔记与项目总结

## 1. LangChain.js 核心概念

### 1.1 什么是LangChain.js
LangChain.js是LangChain框架的JavaScript/TypeScript实现，专为构建基于大语言模型(LLMs)的应用而设计。它提供了一套工具和抽象，使开发者能够轻松地创建复杂的AI应用，如聊天机器人、问答系统、文档分析工具等。

#### 实际开发中的代码示例：

```typescript
// 导入LangChain基础组件
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";

// 创建LLM实例
const llm = new OpenAI({
  temperature: 0.7,
  modelName: "gpt-3.5-turbo-instruct",
});

// 创建提示模板
const promptTemplate = PromptTemplate.fromTemplate(
  "请你作为一个{role}，回答以下问题: {question}"
);

// 创建LLM链
const chain = new LLMChain({ llm, prompt: promptTemplate });

// 运行链
async function runChain() {
  const result = await chain.call({
    role: "历史学家",
    question: "唐朝的主要成就有哪些？"
  });
  console.log(result.text);
}

runChain();
```

### 1.2 核心组件

#### 模型(Models)
- **LLMs**: 与各种大语言模型(如OpenAI的GPT系列)交互的统一接口
- **聊天模型(Chat Models)**: 专门为多轮对话设计的模型接口
- **嵌入模型(Embedding Models)**: 用于将文本转换为向量表示

##### 模型代码示例

```typescript
import { OpenAI } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";

// 创建标准LLM实例
const llm = new OpenAI({
  modelName: "gpt-3.5-turbo-instruct", // 指定模型
  temperature: 0.7, // 控制创造性（0-1）
  maxTokens: 500, // 限制生成的token数
});

// 创建聊天模型实例
const chatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo", // 聊天模型
  temperature: 0.9,
});

// 创建嵌入模型实例
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-ada-002", // 嵌入模型
});

// 使用LLM生成文本
async function generateText() {
  const result = await llm.invoke("请解释量子力学的基本原理");
  console.log(result); // 输出文本结果
}

// 使用嵌入模型生成向量
async function generateEmbedding() {
  const embedding = await embeddings.embedQuery("这是一段示例文本");
  console.log(`生成的向量维度: ${embedding.length}`); // 通常是1536维
}
```

#### 提示(Prompts)
- **提示模板(Prompt Templates)**: 创建动态提示的工具
- **输出解析器(Output Parsers)**: 将LLM输出解析为结构化数据
- **示例选择器(Example Selectors)**: 选择相关示例以增强提示效果

##### 提示系统代码示例

```typescript
import { PromptTemplate } from "@langchain/core/prompts";
import { OpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";

// 创建结构化输出解析器
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    name: z.string().describe("人物的名字"),
    age: z.number().describe("人物的年龄"),
    traits: z.array(z.string()).describe("人物的特点列表"),
    summary: z.string().describe("对人物的简短总结")
  })
);

// 获取格式说明
const formatInstructions = parser.getFormatInstructions();

// 创建提示模板
const prompt = new PromptTemplate({
  template: "请创建一个虚构人物的详细描述。\n{format_instructions}\n人物类型: {character_type}",
  inputVariables: ["character_type"],
  partialVariables: { format_instructions: formatInstructions }
});

// 创建LLM和运行
const llm = new OpenAI({ temperature: 0.7 });

async function createCharacter() {
  // 生成提示
  const input = await prompt.format({ character_type: "科幻小说中的科学家" });
  console.log("生成的提示:\n", input);
  
  // 获取LLM响应
  const response = await llm.invoke(input);
  
  // 解析响应
  try {
    const structuredOutput = await parser.parse(response);
    console.log("解析后的结构化输出:", JSON.stringify(structuredOutput, null, 2));
  } catch (e) {
    console.error("无法解析输出:", e);
    console.log("原始响应:", response);
  }
}
```

#### 索引和检索(Indexes & Retrievers)
- **文档加载器(Document Loaders)**: 从各种源加载文档
- **文本分割器(Text Splitters)**: 将长文本分割为适当大小的块
- **向量存储(Vector Stores)**: 存储和检索向量化文本
- **检索器(Retrievers)**: 基于查询从存储中检索相关文档

##### 检索系统代码示例

```typescript
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// 创建文档加载器
const loader = new PDFLoader("docs/research-paper.pdf");

async function createRetrievalSystem() {
  // 加载文档
  const docs = await loader.load();
  console.log(`加载了 ${docs.length} 个文档`);
  
  // 创建文本分割器
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  // 分割文档
  const splitDocs = await textSplitter.splitDocuments(docs);
  console.log(`分割后得到 ${splitDocs.length} 个文档块`);
  
  // 创建嵌入模型
  const embeddings = new OpenAIEmbeddings();
  
  // 创建向量存储
  const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
  
  // 创建检索器
  const retriever = vectorStore.asRetriever({
    k: 4, // 检索前4个最相关的文档
  });
  
  // 执行检索
  const query = "研究的主要发现是什么？";
  const retrievedDocs = await retriever.getRelevantDocuments(query);
  
  console.log(`找到 ${retrievedDocs.length} 个相关文档`);
  retrievedDocs.forEach((doc, i) => {
    console.log(`\n文档 ${i+1}:`);
    console.log(doc.pageContent.substring(0, 150) + "...");
  });
}
```

#### 内存(Memory)
- **聊天消息历史(Chat Message History)**: 存储对话历史
- **缓冲内存(Buffer Memory)**: 简单的历史记忆机制
- **摘要内存(Summary Memory)**: 根据历史生成摘要的记忆机制

##### 内存系统代码示例

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { BufferMemory, ConversationSummaryMemory } from "langchain/memory";

// 创建聊天模型
const chatModel = new ChatOpenAI({ temperature: 0.7 });

async function demoMemory() {
  // 使用缓冲内存
  const bufferMemory = new BufferMemory();
  
  // 创建带记忆的对话链
  const conversationChain = new ConversationChain({
    llm: chatModel,
    memory: bufferMemory,
  });
  
  // 第一次对话
  const response1 = await conversationChain.invoke({ 
    input: "你好，我叫张三。" 
  });
  console.log("AI: " + response1.response);
  
  // 第二次对话（模型会记住之前的交互）
  const response2 = await conversationChain.invoke({ 
    input: "你还记得我的名字吗？" 
  });
  console.log("AI: " + response2.response);
  
  // 查看内存中存储的内容
  const memoryContent = await bufferMemory.loadMemoryVariables({});
  console.log("内存内容:", memoryContent);
  
  // 使用摘要内存
  const summaryMemory = new ConversationSummaryMemory({
    llm: chatModel,
    memoryKey: "chat_history",
  });
  
  // 向摘要内存添加消息
  await summaryMemory.saveContext(
    { input: "请告诉我太阳系的行星" },
    { output: "太阳系有八大行星：水星、金星、地球、火星、木星、土星、天王星和海王星。" }
  );
  
  await summaryMemory.saveContext(
    { input: "哪个是最大的行星？" },
    { output: "木星是太阳系中最大的行星。" }
  );
  
  // 获取对话摘要
  const summaryContent = await summaryMemory.loadMemoryVariables({});
  console.log("对话摘要:", summaryContent);
}
```

#### 链(Chains)
- **LLM链(LLM Chain)**: 将提示模板与LLM连接
- **序列链(Sequential Chain)**: 按顺序连接多个链
- **检索QA链(Retrieval QA Chain)**: 结合检索器和LLM的问答链

##### 链系统代码示例

```typescript
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain, SimpleSequentialChain, RetrievalQAChain } from "langchain/chains";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";

// 创建LLM实例
const llm = new OpenAI({ temperature: 0.7 });
const embeddings = new OpenAIEmbeddings();

async function demonstrateChains() {
  // 1. 简单LLM链
  const promptTemplate = PromptTemplate.fromTemplate(
    "生成一个关于{topic}的简短故事，风格是{style}"
  );
  
  const storyChain = new LLMChain({
    llm,
    prompt: promptTemplate,
  });
  
  const storyResult = await storyChain.invoke({
    topic: "太空探险",
    style: "科幻"
  });
  
  console.log("生成的故事:", storyResult.text);
  
  // 2. 序列链
  const translationPrompt = PromptTemplate.fromTemplate(
    "将以下英文翻译成中文: {input}"
  );
  
  const summaryPrompt = PromptTemplate.fromTemplate(
    "用一句话总结以下内容: {input}"
  );
  
  const translationChain = new LLMChain({
    llm,
    prompt: translationPrompt,
  });
  
  const summaryChain = new LLMChain({
    llm,
    prompt: summaryPrompt,
  });
  
  // 创建序列链
  const sequentialChain = new SimpleSequentialChain({
    chains: [translationChain, summaryChain],
    verbose: true,
  });
  
  // 运行序列链
  const text = "The artificial intelligence revolution has begun, transforming how we work and live.";
  const sequentialResult = await sequentialChain.invoke({
    input: text,
  });
  
  console.log("序列链结果:", sequentialResult.output);
  
  // 3. 检索QA链
  // 首先创建一个简单的向量存储
  const texts = [
    "人工智能是计算机科学的一个分支，致力于创造能够模拟人类智能的系统。",
    "机器学习是人工智能的一个子领域，专注于让系统从数据中学习。",
    "深度学习是基于神经网络的一种机器学习方法，适用于处理非结构化数据。",
    "自然语言处理是AI的一个领域，专注于让计算机理解和生成人类语言。"
  ];
  
  const documents = texts.map(text => ({
    pageContent: text,
    metadata: {},
  }));
  
  const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
  
  // 创建检索QA链
  const qaChain = RetrievalQAChain.fromLLM(
    llm,
    vectorStore.asRetriever()
  );
  
  // 运行检索QA链
  const qaResult = await qaChain.invoke({
    query: "什么是自然语言处理？",
  });
  
  console.log("QA链结果:", qaResult.text);
}
```

#### 代理(Agents)
- **工具(Tools)**: 代理可以使用的功能
- **代理类型(Agent Types)**: 不同类型的推理和决策代理
- **代理执行器(Agent Executor)**: 管理代理和工具的执行过程

##### 代理系统代码示例

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

async function demonstrateAgent() {
  // 创建模型
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
  });
  
  // 定义工具
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Beijing,China",
      hl: "zh-cn",
      gl: "cn",
    }),
    new Calculator(),
  ];
  
  // 初始化代理执行器
  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    verbose: true,
    maxIterations: 3,
  });
  
  // 运行代理
  const input = "今天北京的天气如何？如果温度高于25度，请计算25的平方是多少。";
  console.log(`执行代理，输入: ${input}`);
  
  const result = await executor.invoke({ input });
  
  console.log("代理执行结果:", result.output);
}
```

## 2. RAG (检索增强生成) 详解

### 2.1 RAG的工作原理
检索增强生成(RAG)是一种将检索系统与生成式AI结合的技术：

1. **文档索引**:
   - 将文档转换为向量嵌入
   - 存储在向量数据库中

2. **查询处理**:
   - 用户问题也被转换为向量
   - 系统检索与问题最相似的文档片段
   - 将检索到的文档作为上下文与原始问题一起发送给LLM

3. **生成回答**:
   - LLM基于提供的上下文和问题生成回答
   - 因为回答基于检索到的信息，所以更准确且可引用

#### RAG实现代码示例

```typescript
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOpenAI } from "@langchain/openai";
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import path from "path";
import fs from "fs";

// 模拟创建一些文档
async function createDocs() {
  // 创建目录
  const docsDir = path.join(process.cwd(), "docs");
  if (!fs.existsSync(docsDir)){
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // 示例文档内容
  const docs = [
    {
      filename: "langchain.txt",
      content: `LangChain是一个专门用于开发由语言模型驱动的应用的框架。它提供了一系列工具、组件和接口，帮助开发者构建复杂的应用。
LangChain的主要组件包括链(Chains)、代理(Agents)、内存(Memory)、提示(Prompts)等。LangChain支持多种语言，包括Python和JavaScript/TypeScript。`
    },
    {
      filename: "vector-db.txt",
      content: `向量数据库是专门用于存储和检索向量嵌入的数据库系统。在人工智能和机器学习领域，向量数据库被广泛用于语义搜索、推荐系统和相似性匹配等应用。
常见的向量数据库包括Pinecone、Milvus、Chroma、Qdrant和FAISS等。这些数据库支持高效的向量相似性搜索，如余弦相似度和欧氏距离计算。`
    }
  ];
  
  // 写入文件
  docs.forEach(doc => {
    fs.writeFileSync(path.join(docsDir, doc.filename), doc.content);
  });
  
  return docsDir;
}

async function buildRAGSystem() {
  // 创建示例文档
  const docsDir = await createDocs();
  
  // 加载文档
  const loaders = [
    new TextLoader(`${docsDir}/langchain.txt`),
    new TextLoader(`${docsDir}/vector-db.txt`)
  ];
  
  const docs = [];
  for (const loader of loaders) {
    const loadedDocs = await loader.load();
    docs.push(...loadedDocs);
  }
  
  console.log(`已加载 ${docs.length} 个文档`);
  
  // 分割文档
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  
  const splitDocs = await textSplitter.splitDocuments(docs);
  console.log(`分割后得到 ${splitDocs.length} 个文档块`);
  
  // 创建嵌入
  const embeddings = new OpenAIEmbeddings();
  
  // 创建向量存储
  const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
  
  // 创建检索器
  const retriever = vectorStore.asRetriever();
  
  // 创建LLM
  const model = new ChatOpenAI({
    temperature: 0.2,
    modelName: "gpt-3.5-turbo",
  });
  
  // 创建QA链
  const chain = RetrievalQAChain.fromLLM(model, retriever);
  
  // 执行查询
  const queries = [
    "LangChain是什么？它有哪些主要组件？",
    "向量数据库的主要用途是什么？列举几个常见的向量数据库。"
  ];
  
  for (const query of queries) {
    console.log(`\n问题: ${query}`);
    const result = await chain.invoke({ query });
    console.log(`回答: ${result.text}`);
  }
  
  // 展示高级用法：自定义RAG行为
  console.log("\n自定义RAG行为示例:");
  
  // 创建自定义链，增加源文档引用
  const qaChain = loadQAStuffChain(model, {
    prompt: `你是一个专业的AI助手。请基于以下上下文回答问题。
如果你不知道答案，就说你不知道，不要尝试编造答案。
使用三个反引号来引用源文件中的内容。
回答尽量简洁清晰。

上下文：{context}

问题：{question}

回答：`,
  });
  
  const customRAG = async (query) => {
    // 获取相关文档
    const docs = await retriever.getRelevantDocuments(query);
    
    // 运行自定义QA链
    const result = await qaChain.invoke({
      input_documents: docs,
      question: query,
    });
    
    return result.text;
  };
  
  const customResult = await customRAG("什么是向量数据库？");
  console.log(`自定义RAG回答: ${customResult}`);
}
```

### 2.2 RAG的优势
- 使LLM能够访问训练数据之外的信息
- 减少"幻觉"现象
- 提供最新信息(克服训练数据截止问题)
- 增强特定领域知识
- 提高透明度和可解释性
- 降低运营成本(相比微调整个模型)

### 2.3 RAG高级配置与优化

```typescript
// RAG高级配置与优化示例
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";

async function advancedRAGExample() {
  // 创建示例文档
  const documents = [
    new Document({ 
      pageContent: "LangChain是一个框架，旨在简化使用大型语言模型构建应用程序的过程。",
      metadata: { source: "docs/intro.txt", page: 1 }
    }),
    new Document({ 
      pageContent: "LangChain提供了模块，使开发人员能够构建上下文感知和推理驱动的应用程序。",
      metadata: { source: "docs/intro.txt", page: 2 }
    }),
    new Document({ 
      pageContent: "向量数据库用于存储和检索向量嵌入，实现语义搜索和相似性匹配。",
      metadata: { source: "docs/vector_db.txt", page: 1 }
    }),
  ];
  
  // 创建嵌入和向量存储
  const embeddings = new OpenAIEmbeddings({ maxConcurrency: 5 }); // 限制并发请求
  const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
  
  // 设置检索器，使用MMR检索策略以平衡相关性和多样性
  const retriever = vectorStore.asRetriever({
    searchType: "mmr", // Maximum Marginal Relevance
    searchKwargs: {
      fetchK: 5, // 获取前5个候选
      k: 3,      // 返回最终的3个文档
      lambda: 0.5, // 平衡相关性和多样性的参数
    },
  });
  
  // 创建提示模板，包含详细说明和对源文档的引用需求
  const prompt = PromptTemplate.fromTemplate(`
你是一个专业的研究助手。请使用以下检索到的上下文信息来回答问题。
如果下面的上下文信息不足以回答问题，请直接说明你不知道，而不是猜测。
每个信息块后面都标注了来源，请在回答中引用这些来源。

上下文信息:
{context}

问题: {question}

请给出全面、准确、信息丰富的回答，并引用信息来源。
`);
  
  // 创建LLM
  const llm = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
  });
  
  // 构建RAG管道
  const ragPipeline = RunnableSequence.from([
    {
      // 这个函数接收用户查询并返回检索结果和原始查询
      async invoke(query) {
        console.log(`执行查询: "${query}"`);
        const relevantDocs = await retriever.getRelevantDocuments(query);
        const formattedDocs = formatDocumentsAsString(relevantDocs, (doc) => {
          return `${doc.pageContent}\n来源: ${doc.metadata.source}, 页码: ${doc.metadata.page}\n---\n`;
        });
        
        console.log(`找到 ${relevantDocs.length} 个相关文档`);
        return {
          context: formattedDocs,
          question: query,
        };
      },
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);
  
  // 测试RAG系统
  const query = "LangChain是什么？它有什么用途？";
  const result = await ragPipeline.invoke(query);
  
  console.log("\n问题:", query);
  console.log("\n回答:", result);
  
  // 打印性能指标
  console.log("\n性能分析:");
  console.log("- 检索器使用MMR算法确保结果的相关性和多样性");
  console.log("- 嵌入请求并发数限制为5，避免API限流");
  console.log("- 使用prompt模板鼓励引用源文档，提高可引用性");
}
```

## 3. 项目搭建过程

### 3.1 项目初始化
1. 创建项目结构和安装依赖：
   ```bash
   # 创建项目目录
   mkdir langchain-weather-demo
   cd langchain-weather-demo

   # 初始化Node.js项目
   npm init -y

   # 安装TypeScript
   npm install typescript ts-node @types/node --save-dev

   # 安装LangChain相关依赖
   npm install langchain @langchain/openai @langchain/core @langchain/community
   
   # 安装其他依赖
   npm install dotenv axios zod node-schedule chromadb sqlite3 pg
   ```

2. 配置TypeScript：
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "esModuleInterop": true,
       "outDir": "./dist",
       "strict": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

3. 创建环境变量文件(.env)：
   ```
   OPENAI_API_KEY=your_openai_api_key
   QWEATHER_KEY=your_qweather_key
   ```

### 3.2 核心模块实现

#### 配置模块
```typescript
// src/config/config.ts
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 获取项目根目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 环境变量验证模式
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, '请设置OPENAI_API_KEY环境变量'),
  OPENAI_BASE_URL: z.string().optional(),
  QWEATHER_KEY: z.string().min(1, '请设置QWEATHER_KEY环境变量')
});

// 验证环境变量
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('环境变量验证失败:', error);
    throw error;
  }
}

export const env = validateEnv();

// 配置常量
export const OPENAI_CHAT_MODEL = 'gpt-3.5-turbo';
export const OPENAI_EMBEDDING_MODEL = 'text-embedding-ada-002';
export const DEFAULT_TEMPERATURE = 0.7;
export const MAX_TOKENS = 1000;
```

#### LLM模型工厂
```typescript
// src/models/llm.ts
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { 
  OPENAI_CHAT_MODEL, 
  OPENAI_EMBEDDING_MODEL, 
  DEFAULT_TEMPERATURE 
} from "../config/config.js";

/**
 * LLM工厂类，用于创建不同类型的LLM实例
 */
export class LLMFactory {
  /**
   * 创建OpenAI GPT-3.5模型实例
   */
  static createGPT3_5(temperature = DEFAULT_TEMPERATURE) {
    return new ChatOpenAI({
      modelName: OPENAI_CHAT_MODEL,
      temperature: temperature,
    });
  }
  
  /**
   * 创建OpenAI GPT-4模型实例
   */
  static createGPT4(temperature = DEFAULT_TEMPERATURE) {
    return new ChatOpenAI({
      modelName: "gpt-4",
      temperature: temperature,
    });
  }
  
  /**
   * 创建OpenAI嵌入模型实例
   */
  static createEmbeddings() {
    return new OpenAIEmbeddings({
      modelName: OPENAI_EMBEDDING_MODEL,
    });
  }
}
```

#### 链的实现
```typescript
// src/chains/conversation.ts
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "@langchain/openai";

/**
 * 创建对话链
 * @param llm 语言模型实例
 * @returns 对话链实例
 */
export function createConversationChain(llm: ChatOpenAI) {
  // 创建记忆存储
  const memory = new BufferMemory();
  
  // 创建对话链
  const chain = new ConversationChain({
    llm,
    memory,
    verbose: true,
  });
  
  return chain;
}

/**
 * 运行对话链
 * @param chain 对话链实例
 * @param input 用户输入
 * @returns 模型响应
 */
export async function runConversation(chain: ConversationChain, input: string) {
  try {
    // 调用链
    const response = await chain.invoke({ input });
    return response.response;
  } catch (error) {
    console.error("对话链执行失败:", error);
    throw error;
  }
}
```

#### 向量存储
```typescript
// src/embeddings/vector-store.ts
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import path from "path";
import fs from "fs";
import { LLMFactory } from "../models/llm.js";
import { DATA_DIR } from "../config/config.js";

/**
 * 加载或创建向量存储
 * @param docsDir 文档目录
 * @param collectionName 集合名称
 * @returns 向量存储实例
 */
export async function loadOrCreateVectorStore(docsDir: string, collectionName: string) {
  // 创建嵌入模型
  const embeddings = LLMFactory.createEmbeddings();
  
  // 检查向量存储是否存在
  const vectorStoreDir = path.join(DATA_DIR, "vector_stores");
  const vectorStorePath = path.join(vectorStoreDir, collectionName);
  
  if (!fs.existsSync(vectorStoreDir)) {
    fs.mkdirSync(vectorStoreDir, { recursive: true });
  }
  
  // 如果向量存储已存在，则加载
  if (fs.existsSync(vectorStorePath) && fs.readdirSync(vectorStorePath).length > 0) {
    console.log(`加载现有向量存储: ${collectionName}`);
    return await Chroma.load(vectorStorePath, embeddings);
  }
  
  // 否则创建新的向量存储
  console.log(`创建新向量存储: ${collectionName}`);
  
  // 检查文档目录是否存在
  if (!fs.existsSync(docsDir)) {
    throw new Error(`文档目录不存在: ${docsDir}`);
  }
  
  // 加载文档
  const loader = new DirectoryLoader(docsDir, {
    ".txt": (path) => new TextLoader(path),
    ".md": (path) => new TextLoader(path),
  });
  
  const docs = await loader.load();
  console.log(`从 ${docsDir} 加载了 ${docs.length} 个文档`);
  
  if (docs.length === 0) {
    throw new Error(`没有找到文档: ${docsDir}`);
  }
  
  // 分割文档
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  const splitDocs = await textSplitter.splitDocuments(docs);
  console.log(`分割后得到 ${splitDocs.length} 个文档块`);
  
  // 创建向量存储
  return await Chroma.fromDocuments(splitDocs, embeddings, {
    collectionName,
    url: "http://localhost:8000", // ChromaDB服务地址
    collectionMetadata: {
      "description": `Collection for ${collectionName}`,
    },
  });
}
```

#### 工具实现
```typescript
// src/tools/weather-tools.ts
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getWeatherData, compareWeather } from "../services/weather-service.js";

/**
 * 创建天气查询工具
 * @returns 天气查询工具
 */
export function createWeatherQueryTool() {
  return new DynamicStructuredTool({
    name: "get_weather",
    description: "获取指定城市的当前天气情况",
    schema: z.object({
      city: z.string().describe("城市名称，如北京、上海等"),
    }),
    func: async ({ city }) => {
      try {
        const weatherData = await getWeatherData(city);
        return JSON.stringify(weatherData, null, 2);
      } catch (error) {
        return `获取天气数据失败: ${error.message}`;
      }
    },
  });
}

/**
 * 创建天气比较工具
 * @returns 天气比较工具
 */
export function createWeatherComparisonTool() {
  return new DynamicStructuredTool({
    name: "compare_weather",
    description: "比较多个城市的天气情况",
    schema: z.object({
      cities: z.array(z.string()).describe("城市名称列表"),
    }),
    func: async ({ cities }) => {
      try {
        if (!Array.isArray(cities) || cities.length < 2) {
          return "至少需要提供两个城市进行比较";
        }
        
        const comparison = await compareWeather(cities);
        return JSON.stringify(comparison, null, 2);
      } catch (error) {
        return `比较天气数据失败: ${error.message}`;
      }
    },
  });
}
```

```typescript
// src/tools/database-tools.ts
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { executeSqlQuery, getTableInfo, closeConnection } from "../services/database-service.js";

/**
 * 创建SQL查询工具
 * @returns SQL查询工具
 */
export function createSqlQueryTool() {
  return new DynamicStructuredTool({
    name: "run_sql_query",
    description: "执行SQL查询并返回结果",
    schema: z.object({
      query: z.string().describe("SQL查询语句"),
    }),
    func: async ({ query }) => {
      try {
        const result = await executeSqlQuery(query);
        return JSON.stringify(result, null, 2);
      } catch (error) {
        return `SQL查询执行失败: ${error.message}`;
      }
    },
  });
}

/**
 * 创建表信息查询工具
 * @returns 表信息查询工具
 */
export function createTableInfoTool() {
  return new DynamicStructuredTool({
    name: "get_table_info",
    description: "获取数据库表的结构信息",
    schema: z.object({
      table: z.string().describe("表名"),
    }),
    func: async ({ table }) => {
      try {
        const tableInfo = await getTableInfo(table);
        return JSON.stringify(tableInfo, null, 2);
      } catch (error) {
        return `获取表信息失败: ${error.message}`;
      }
    },
  });
}

/**
 * 关闭数据库连接
 */
export async function closeDbConnection() {
  await closeConnection();
  console.log("数据库连接已关闭");
}
```

#### 服务模块
```typescript
// src/services/weather-service.ts
import axios from "axios";
import { env } from "../config/config.js";

// 和风天气API地址
const WEATHER_API_BASE = "https://devapi.qweather.com/v7";

/**
 * 获取城市的天气数据
 * @param city 城市名称
 * @returns 天气数据
 */
export async function getWeatherData(city: string) {
  try {
    // 获取城市ID
    const locationRes = await axios.get(`${WEATHER_API_BASE}/geo/lookup`, {
      params: {
        location: city,
        key: env.QWEATHER_KEY,
      },
    });
    
    if (!locationRes.data.location || locationRes.data.location.length === 0) {
      throw new Error(`未找到城市: ${city}`);
    }
    
    const locationId = locationRes.data.location[0].id;
    
    // 获取天气数据
    const weatherRes = await axios.get(`${WEATHER_API_BASE}/weather/now`, {
      params: {
        location: locationId,
        key: env.QWEATHER_KEY,
      },
    });
    
    if (!weatherRes.data.now) {
      throw new Error(`获取天气数据失败: ${city}`);
    }
    
    // 格式化返回数据
    const weather = weatherRes.data.now;
    return {
      city,
      temperature: `${weather.temp}°C`,
      feelsLike: `${weather.feelsLike}°C`,
      text: weather.text,
      humidity: `${weather.humidity}%`,
      windSpeed: `${weather.windSpeed} km/h`,
      windDir: weather.windDir,
      updateTime: weatherRes.data.updateTime,
    };
  } catch (error) {
    console.error(`获取天气数据失败:`, error);
    throw error;
  }
}

/**
 * 比较多个城市的天气
 * @param cities 城市名称数组
 * @returns 比较结果
 */
export async function compareWeather(cities: string[]) {
  const weatherPromises = cities.map((city) => getWeatherData(city));
  const weatherDataList = await Promise.all(weatherPromises);
  
  // 寻找最高和最低温度
  const temperatures = weatherDataList.map((data) => parseInt(data.temperature));
  const maxTemp = Math.max(...temperatures);
  const minTemp = Math.min(...temperatures);
  
  const maxTempCity = weatherDataList[temperatures.indexOf(maxTemp)].city;
  const minTempCity = weatherDataList[temperatures.indexOf(minTemp)].city;
  
  // 返回比较结果
  return {
    cities: weatherDataList,
    comparison: {
      warmestCity: {
        city: maxTempCity,
        temperature: `${maxTemp}°C`,
      },
      coldestCity: {
        city: minTempCity,
        temperature: `${minTemp}°C`,
      },
      temperatureDifference: `${maxTemp - minTemp}°C`,
    },
  };
}
```

#### 调度服务

```typescript
// src/services/scheduler.ts
import schedule from "node-schedule";
import { getWeatherData } from "./weather-service.js";
import { sendEmail } from "./email-service.js";

// 存储所有定时任务
const scheduledJobs = {};

/**
 * 立即运行天气报告
 * @param city 城市名称
 * @returns 天气数据
 */
export async function runWeatherReportNow(city: string) {
  console.log(`获取 ${city} 的天气报告...`);
  
  try {
    const weatherData = await getWeatherData(city);
    console.log(`${city} 天气报告:`, JSON.stringify(weatherData, null, 2));
    
    // 这里可以添加发送邮件或其他通知的逻辑
    return weatherData;
  } catch (error) {
    console.error(`获取天气报告失败: ${city}`, error);
    throw error;
  }
}

/**
 * 创建定时天气报告任务
 * @param city 城市名称
 * @param cronExpression cron表达式，如"0 8 * * *"表示每天早上8点
 * @returns 任务ID
 */
export function scheduleDailyWeatherReport(city: string, cronExpression: string) {
  const jobId = `weather_${city}_${Date.now()}`;
  
  console.log(`为 ${city} 设置定时天气报告，cron: ${cronExpression}`);
  
  // 创建定时任务
  const job = schedule.scheduleJob(cronExpression, async function() {
    try {
      console.log(`执行定时天气报告: ${city}`);
      const weatherData = await getWeatherData(city);
      
      // 创建邮件内容
      const emailSubject = `${city} 天气预报`;
      const emailBody = `
        <h2>${city} 天气预报</h2>
        <p>温度: ${weatherData.temperature}</p>
        <p>体感温度: ${weatherData.feelsLike}</p>
        <p>天气状况: ${weatherData.text}</p>
        <p>湿度: ${weatherData.humidity}</p>
        <p>风速: ${weatherData.windSpeed}</p>
        <p>风向: ${weatherData.windDir}</p>
        <p>更新时间: ${weatherData.updateTime}</p>
      `;
      
      // 发送邮件通知
      // await sendEmail(emailSubject, emailBody);
      
      console.log(`${city} 天气报告已生成`);
    } catch (error) {
      console.error(`定时天气报告执行失败: ${city}`, error);
    }
  });
  
  // 存储任务
  scheduledJobs[jobId] = job;
  
  return jobId;
}

/**
 * 取消定时任务
 * @param jobId 任务ID
 * @returns 是否成功取消
 */
export function cancelScheduledJob(jobId: string) {
  if (scheduledJobs[jobId]) {
    scheduledJobs[jobId].cancel();
    delete scheduledJobs[jobId];
    console.log(`已取消定时任务: ${jobId}`);
    return true;
  }
  
  console.log(`未找到定时任务: ${jobId}`);
  return false;
}
```

### 3.3 主要功能演示

项目实现了以下主要功能，并提供了Web界面进行交互：

#### 1. 基本对话功能
通过OpenAI的ChatGPT模型实现基本对话功能，支持上下文记忆。

```javascript
// 前端代码
const chatInput = ref('');
const chatMessages = ref([{ role: 'system', content: '你好，我是AI助手，有什么可以帮助你的？' }]);
const chatLoading = ref(false);

async function sendChatMessage() {
  if (!chatInput.value.trim()) return;
  
  // 添加用户消息
  addMessageToChat({ role: 'user', content: chatInput.value });
  const userMessage = chatInput.value;
  chatInput.value = '';
  chatLoading.value = true;
  
  try {
    // 调用API
    const response = await axios.post('/api/conversation', { input: userMessage });
    
    // 添加助手回复
    addMessageToChat({ role: 'assistant', content: response.data.response });
  } catch (error) {
    console.error('发送消息失败:', error);
    addMessageToChat({ role: 'assistant', content: '抱歉，处理您的请求时出现错误。' });
  } finally {
    chatLoading.value = false;
    // 滚动到底部
    nextTick(() => {
      const chatContainer = document.querySelector('.chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    });
  }
}
```

#### 2. 代理与工具使用
集成了代理系统，可以使用工具解决复杂问题，例如查询天气和访问数据库。

```javascript
// 前端代码
const agentInput = ref('');
const agentMessages = ref([{ role: 'system', content: '你好，我是Agent助手。我可以帮助你查询天气、访问数据库等。' }]);
const agentLoading = ref(false);

async function sendAgentMessage() {
  if (!agentInput.value.trim()) return;
  
  // 添加用户消息
  addMessageToAgent({ role: 'user', content: agentInput.value });
  const userMessage = agentInput.value;
  agentInput.value = '';
  agentLoading.value = true;
  
  try {
    console.log('发送代理请求:', userMessage);
    // 调用API
    const response = await axios.post('/api/agent', { input: userMessage });
    
    // 添加助手回复
    addMessageToAgent({ role: 'assistant', content: response.data.response });
  } catch (error) {
    console.error('代理请求失败:', error);
    addMessageToAgent({ role: 'assistant', content: '抱歉，处理您的请求时出现错误。' });
  } finally {
    agentLoading.value = false;
    // 滚动到底部
    nextTick(() => {
      const agentContainer = document.querySelector('.agent-messages');
      if (agentContainer) {
        agentContainer.scrollTop = agentContainer.scrollHeight;
      }
    });
  }
}
```

#### 3. RAG问答系统
实现了基于文档的问答系统，可以根据已有文档回答用户问题。

```javascript
// 前端代码
const ragInput = ref('');
const ragMessages = ref([{ role: 'system', content: '你好，我是RAG助手。我可以回答关于LangChain的问题。' }]);
const ragLoading = ref(false);

async function sendRagQuery() {
  if (!ragInput.value.trim()) return;
  
  // 添加用户消息
  addMessageToRAG({ role: 'user', content: ragInput.value });
  const userQuery = ragInput.value;
  ragInput.value = '';
  ragLoading.value = true;
  
  try {
    // 调用API
    const response = await axios.post('/api/rag', { query: userQuery });
    
    // 添加助手回复
    addMessageToRAG({ role: 'assistant', content: response.data.answer });
  } catch (error) {
    console.error('RAG查询失败:', error);
    addMessageToRAG({ role: 'assistant', content: '抱歉，处理您的请求时出现错误。' });
  } finally {
    ragLoading.value = false;
    // 滚动到底部
    nextTick(() => {
      const ragContainer = document.querySelector('.rag-messages');
      if (ragContainer) {
        ragContainer.scrollTop = ragContainer.scrollHeight;
      }
    });
  }
}
```

#### 4. 数据库集成
支持通过自然语言查询数据库，无需直接编写SQL。

```javascript
// 前端代码
const dbInput = ref('');
const dbMessages = ref([{ role: 'system', content: '你好，我是数据库助手。我可以帮助你查询数据库信息。' }]);
const dbLoading = ref(false);

// 示例查询
const exampleQueries = [
  "数据库中有哪些表？",
  "users表的结构是什么？",
  "查询所有用户信息",
  "统计用户的平均年龄",
  "查找北京的天气记录"
];

function useExampleQuery(index) {
  dbInput.value = exampleQueries[index];
}

async function sendDbQuery() {
  if (!dbInput.value.trim()) return;
  
  // 添加用户消息
  addMessageToDB({ role: 'user', content: dbInput.value });
  const userQuery = dbInput.value;
  dbInput.value = '';
  dbLoading.value = true;
  
  try {
    // 调用API
    const response = await axios.post('/api/database', { query: userQuery });
    
    // 添加助手回复
    addMessageToDB({ role: 'assistant', content: response.data.result });
  } catch (error) {
    console.error('数据库查询失败:', error);
    addMessageToDB({ role: 'assistant', content: '抱歉，处理您的请求时出现错误。' });
  } finally {
    dbLoading.value = false;
    // 滚动到底部
    nextTick(() => {
      const dbContainer = document.querySelector('.db-messages');
      if (dbContainer) {
        dbContainer.scrollTop = dbContainer.scrollHeight;
      }
    });
  }
}
```

#### 5. 天气预报推送
实现了天气查询和定时推送功能，可以设置定时任务获取指定城市的天气信息。

```javascript
// 前端代码
const weatherTab = ref('current');
const weatherCity = ref('北京');
const weatherLoading = ref(false);
const weatherReport = ref(null);

const scheduleCity = ref('上海');
const scheduleTime = ref('08:00');
const scheduleFrequency = ref('daily');
const scheduleLoading = ref(false);
const schedulesList = ref([]);

async function getWeatherReport() {
  if (!weatherCity.value.trim()) return;
  
  weatherLoading.value = true;
  
  try {
    const response = await axios.get('/api/weather', {
      params: { city: weatherCity.value }
    });
    
    weatherReport.value = response.data;
  } catch (error) {
    console.error('获取天气失败:', error);
    ElMessage.error('获取天气信息失败');
  } finally {
    weatherLoading.value = false;
  }
}

async function scheduleWeatherReport() {
  if (!scheduleCity.value.trim() || !scheduleTime.value) {
    ElMessage.warning('请输入城市名称和推送时间');
    return;
  }
  
  scheduleLoading.value = true;
  
  try {
    // 解析时间
    const [hours, minutes] = scheduleTime.value.split(':');
    
    const response = await axios.post('/api/weather/schedule', {
      city: scheduleCity.value,
      time: `${minutes} ${hours} * * *`, // 转换为cron格式
      frequency: scheduleFrequency.value
    });
    
    // 添加到列表
    addScheduleToList({
      id: response.data.jobId,
      city: scheduleCity.value,
      time: scheduleTime.value,
      frequency: scheduleFrequency.value
    });
    
    ElMessage.success('成功设置天气推送');
    scheduleCity.value = '';
    scheduleTime.value = '08:00';
  } catch (error) {
    console.error('设置天气推送失败:', error);
    ElMessage.error('设置天气推送失败');
  } finally {
    scheduleLoading.value = false;
  }
}

function cancelSchedule(id) {
  try {
    axios.delete(`/api/weather/schedule/${id}`);
    schedulesList.value = schedulesList.value.filter(item => item.id !== id);
    ElMessage.success('已取消推送设置');
  } catch (error) {
    console.error('取消推送失败:', error);
    ElMessage.error('取消推送设置失败');
  }
}
```

## 4. LangChain.js 实战要点

### 4.1 性能优化

以下是一些性能优化的代码示例：

```typescript
// 批量处理示例
import { OpenAIEmbeddings } from "@langchain/openai";

async function batchEmbeddings(texts: string[]) {
  const embeddings = new OpenAIEmbeddings();
  
  // 批量处理而不是逐个处理
  console.time('batch_embed');
  const vectors = await embeddings.embedDocuments(texts);
  console.timeEnd('batch_embed');
  
  return vectors;
}

// 缓存机制示例
import { Redis } from "@upstash/redis";
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed";

async function createCachedEmbeddings() {
  const underlyingEmbeddings = new OpenAIEmbeddings();
  
  // 创建Redis客户端
  const client = new Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN,
  });
  
  // 创建缓存嵌入
  const cachedEmbeddings = CacheBackedEmbeddings.fromBytesStore(
    underlyingEmbeddings,
    client,
    {
      namespace: "embeddings_cache",
    }
  );
  
  return cachedEmbeddings;
}

// 并行处理示例
async function parallelProcessing(documents: Document[]) {
  // 将文档分成多个批次
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize));
  }
  
  // 并行处理批次
  const results = await Promise.all(
    batches.map(async (batch) => {
      return await processDocuments(batch);
    })
  );
  
  // 合并结果
  return results.flat();
}
```

### 4.2 错误处理

以下是错误处理的代码示例：

```typescript
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import { RateLimiter } from "limiter";

// 重试机制
async function runWithRetry(fn: Function, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`尝试 ${attempt}/${maxRetries} 失败:`, error.message);
      
      // 检查是否是速率限制错误
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        const waitTime = Math.pow(2, attempt) * delay; // 指数退避
        console.log(`等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // 如果不是速率限制错误，直接抛出
        throw error;
      }
    }
  }
  
  throw lastError;
}

// 速率限制器
const openaiLimiter = new RateLimiter({
  tokensPerInterval: 20, // 每分钟请求数
  interval: "minute"
});

async function callOpenAIWithRateLimit(prompt: string) {
  // 等待令牌
  await openaiLimiter.removeTokens(1);
  
  const llm = new OpenAI();
  return await llm.invoke(prompt);
}

// 优雅的错误处理
async function robustChainInvocation(input: string) {
  const llm = new OpenAI();
  const promptTemplate = PromptTemplate.fromTemplate(
    "回答以下问题: {question}"
  );
  const chain = new LLMChain({ llm, prompt: promptTemplate });
  
  try {
    const result = await runWithRetry(() => 
      chain.invoke({ question: input }),
      3 // 最多重试3次
    );
    return result.text;
  } catch (error) {
    console.error("链执行失败:", error);
    
    // 返回用户友好的错误消息
    if (error.message.includes('rate limit')) {
      return "系统当前繁忙，请稍后再试。";
    } else if (error.message.includes('context length')) {
      return "您的问题太长，请尝试缩短或分割您的问题。";
    } else {
      return "抱歉，处理您的请求时出现错误。请稍后再试。";
    }
  }
}
```

### 4.3 生产部署

在生产环境部署LangChain.js应用时的关键代码示例：

```typescript
// 环境变量管理
import dotenv from "dotenv";
import { z } from "zod";

// 区分环境
const NODE_ENV = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${NODE_ENV}` });

// 验证环境变量
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  PORT: z.string().default("3000").transform(Number),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // ... 其他环境变量
});

const env = envSchema.parse(process.env);

// 日志记录
import winston from "winston";

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// 监控中间件
import express from "express";
import prometheus from "prom-client";

const app = express();
const collectDefaultMetrics = prometheus.collectDefaultMetrics;
collectDefaultMetrics();

// 自定义指标
const httpRequestDurationMicroseconds = new prometheus.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status"],
  buckets: [0.1, 5, 15, 50, 100, 500],
});

// 请求计数器
const httpRequestCounter = new prometheus.Counter({
  name: "http_request_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
});

// 监控端点
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});

// 监控中间件
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds
      .labels(req.method, req.path, res.statusCode.toString())
      .observe(duration);
    
    httpRequestCounter
      .labels(req.method, req.path, res.statusCode.toString())
      .inc();
  });
  
  next();
});
```

### 4.4 安全考虑

安全防护相关代码示例：

```typescript
// 输入验证和过滤
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

function sanitizeInput(input: string): string {
  const window = new JSDOM("").window;
  const purify = DOMPurify(window);
  return purify.sanitize(input);
}

// 防止提示注入
function preventPromptInjection(userInput: string): string {
  // 移除可能的提示词控制字符
  const cleaned = userInput
    .replace(/```/g, "")
    .replace(/system:/gi, "")
    .replace(/assistant:/gi, "");
  
  // 长度限制
  return cleaned.substring(0, 1000);
}

// 内容过滤
function filterSensitiveContent(content: string): string {
  const sensitivePatterns = [
    /信用卡\s*\d{16}/g,
    /密码\s*[:：]\s*\S+/g,
    /手机\s*[:：]\s*\d{11}/g,
    /身份证\s*[:：]\s*\d{18}/g,
  ];
  
  let filteredContent = content;
  for (const pattern of sensitivePatterns) {
    filteredContent = filteredContent.replace(pattern, "[已过滤敏感信息]");
  }
  
  return filteredContent;
}

// API密钥轮换
class APIKeyManager {
  private keys: string[] = [];
  private currentIndex = 0;
  
  constructor(keys: string[]) {
    this.keys = keys;
  }
  
  getNextKey(): string {
    if (this.keys.length === 0) {
      throw new Error("No API keys available");
    }
    
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }
  
  markKeyAsInvalid(key: string): void {
    this.keys = this.keys.filter(k => k !== key);
    this.currentIndex = 0;
  }
}

// 使用管理器
const apiKeyManager = new APIKeyManager([
  process.env.OPENAI_API_KEY_1,
  process.env.OPENAI_API_KEY_2,
  process.env.OPENAI_API_KEY_3,
]);

// 创建LLM实例，使用动态密钥
function createSecureOpenAI() {
  return new OpenAI({
    apiKey: apiKeyManager.getNextKey(),
    maxRetries: 2,
  });
}
```

## 7. 结语

通过本项目，我们实现了基于LangChain.js的完整应用，包括基本对话、代理系统、RAG检索、数据库集成和天气服务等功能。我们展示了如何构建复杂的AI应用，同时保持代码的可维护性和可扩展性。

LangChain.js提供了强大而灵活的工具集，使开发者能够快速构建基于大语言模型的应用。通过使用其提供的抽象和组件，我们可以专注于业务逻辑而不是底层实现细节。随着大语言模型技术的不断发展，LangChain生态系统也将持续壮大，为开发者提供更多创新应用的可能性。

本项目的源代码可以在GitHub上找到，欢迎贡献和改进！ 