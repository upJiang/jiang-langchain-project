import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { CohereEmbeddings } from 'langchain/embeddings/cohere';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAI as LangchainOpenAI } from 'langchain/llms/openai';
import { PromptTemplate } from 'langchain/prompts';
import { RetrievalQAChain, loadQAStuffChain } from 'langchain/chains';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { fixChineseFilename } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// 配置中间件
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], // 允许的来源
  methods: ['GET', 'POST'], // 允许的HTTP方法
  allowedHeaders: ['Content-Type', 'Authorization'], // 允许的请求头
  credentials: true // 允许携带凭证
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 确保上传目录存在
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      console.log(`创建上传目录: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 处理文件名编码问题
    let originalName = file.originalname;
    
    // 使用工具函数修复文件名
    originalName = fixChineseFilename(originalName);
    
    // 记录修复后的文件名
    file.decodedOriginalname = originalName;
    console.log(`处理后的文件名: ${originalName}`);
    
    // 使用时间戳避免文件名冲突
    cb(null, Date.now() + '-' + originalName);
  }
});

// 文件类型过滤器
const fileFilter = (req, file, cb) => {
  // 检查文件扩展名，只接受txt和md文件
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    cb(null, true);
  } else {
    cb(new Error('只支持.txt和.md文件格式'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter 
});

// 全局向量存储
let vectorStore = null;

// 处理文本文件
const processTextFile = async (filePath) => {
  console.log(`读取文件内容: ${filePath}`);
  const text = fs.readFileSync(filePath, 'utf-8');
  console.log(`文件内容长度: ${text.length} 字符`);
  return text;
};

// BGE嵌入模型类
class BGEEmbeddings {
  constructor(apiKey, apiUrl) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl || 'https://api.siliconflow.cn/v1/embeddings';
    this.modelName = 'BAAI/bge-large-zh-v1.5';
  }

  async embedDocuments(texts) {
    console.log(`准备处理${texts.length}个文本片段的嵌入...`);
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        // 检查文本是否为undefined或为空
        if (!texts[i] || typeof texts[i] !== 'string' || texts[i].trim().length === 0) {
          console.warn(`第${i+1}个文本片段无效，使用零向量替代`);
          embeddings.push(new Array(1024).fill(0));
          continue;
        }
        
        // 确保文本不超过限制 (大约1500个字符，约500个tokens)
        const truncatedText = texts[i].substring(0, 1500);
        if (truncatedText.length < texts[i].length) {
          console.warn(`第${i+1}个文本片段已被截断，原长度: ${texts[i].length}，截断后长度: ${truncatedText.length}`);
        }
        
        const embedding = await this.embedQuery(truncatedText);
        embeddings.push(embedding);
        if (i % 10 === 0 && i > 0) {
          console.log(`已处理${i}/${texts.length}个文本片段...`);
        }
      } catch (error) {
        console.error(`处理第${i+1}个文本片段时出错:`, error.message);
        // 在出错时使用零向量，避免整个处理失败
        embeddings.push(new Array(1024).fill(0));
      }
    }
    
    console.log(`完成${texts.length}个文本片段的嵌入`);
    return embeddings;
  }

  async embedQuery(text) {
    try {
      console.log('调用BGE嵌入API...');
      console.log(`API密钥: ${this.apiKey.substring(0, 5)}***...`);
      console.log(`API URL: ${this.apiUrl}`);
      console.log(`文本: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      
      // 确保text是字符串
      if (typeof text !== 'string') {
        console.warn('输入文本不是字符串类型，尝试转换...');
        text = String(text);
      }
      
      // 按照硅基流动API的示例格式
      const requestBody = JSON.stringify({
        model: this.modelName,
        input: text,
        encoding_format: 'float'
      });
      
      console.log('请求体:', requestBody.substring(0, 200) + '...');
      
      // 使用fetch API风格
      const options = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: requestBody,
        timeout: 30000
      };
      
      // 使用axios但格式化为fetch风格的请求
      const response = await axios.post(this.apiUrl, JSON.parse(requestBody), {
        headers: options.headers,
        timeout: options.timeout
      });
      
      if (!response.data || !response.data.data || !response.data.data[0] || !response.data.data[0].embedding) {
        console.error('无效的API响应:', JSON.stringify(response.data).substring(0, 200));
        throw new Error('API响应中没有找到嵌入向量');
      }
      
      console.log(`成功获取嵌入向量，维度: ${response.data.data[0].embedding.length}`);
      return response.data.data[0].embedding;
    } catch (error) {
      console.error('BGE嵌入模型错误:', error);
      if (error.response) {
        console.error('API响应状态:', error.response.status);
        console.error('API响应数据:', error.response.data);
      } else if (error.request) {
        console.error('未收到API响应');
      }
      throw new Error(`BGE嵌入请求失败: ${error.message}`);
    }
  }
}

// 获取嵌入模型
const getEmbeddingModel = (modelName, apiKey, apiEndpoint, embeddingApiKey, embeddingEndpoint) => {
  if (modelName === 'bge-large-zh' || modelName.includes('BAAI/bge')) {
    return new BGEEmbeddings(embeddingApiKey || apiKey, embeddingEndpoint);
  }
  
  if (modelName.includes('cohere')) {
    return new CohereEmbeddings({
      apiKey,
    });
  }
  
  return new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName,
    configuration: {
      basePath: apiEndpoint ? `${apiEndpoint}/v1` : undefined,
    },
  });
};

// 文件上传和向量化处理
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files;
    const embeddingModel = req.body.embeddingModel;
    const apiKey = req.body.apiKey;
    const apiEndpoint = req.body.apiEndpoint;
    const embeddingApiKey = req.body.embeddingApiKey;
    const embeddingEndpoint = req.body.embeddingEndpoint;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: '未上传文件' });
    }

    if (!apiKey) {
      return res.status(400).json({ message: '未提供API密钥' });
    }

    console.log(`正在处理上传文件，使用嵌入模型: ${embeddingModel}`);
    console.log(`嵌入模型API端点: ${embeddingEndpoint || '默认'}`);
    console.log(`上传的文件数量: ${files.length}`);
    
    // 验证文件类型
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.txt' && ext !== '.md') {
        return res.status(400).json({ message: `不支持的文件类型: ${file.originalname}，仅支持.txt和.md文件` });
      }
    }
    
    // 创建嵌入模型
    let embeddings;
    try {
      embeddings = getEmbeddingModel(embeddingModel, apiKey, apiEndpoint, embeddingApiKey, embeddingEndpoint);
      console.log('成功创建嵌入模型实例');
    } catch (error) {
      console.error('创建嵌入模型失败:', error);
      return res.status(500).json({ message: `创建嵌入模型失败: ${error.message}` });
    }

    // 处理所有上传的文件
    let documents = [];
    for (const file of files) {
      const filePath = file.path;
      try {
        console.log(`处理文件: ${file.originalname} (${file.mimetype})`);
        const text = await processTextFile(filePath);
        
        if (!text || text.trim().length === 0) {
          console.warn(`文件 ${file.originalname} 内容为空，跳过`);
          continue;
        }
        
        // 文本分割
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 500, // 减小块大小，确保不超过API的512 tokens限制
          chunkOverlap: 50,
        });
        
        const docs = await textSplitter.createDocuments([text], [{ source: file.originalname }]);
        console.log(`文件 ${file.originalname} 分割为 ${docs.length} 个片段`);
        documents.push(...docs);
      } catch (error) {
        console.error(`处理文件 ${file.originalname} 失败:`, error);
        return res.status(500).json({ message: `处理文件 ${file.originalname} 失败: ${error.message}` });
      }
    }

    if (documents.length === 0) {
      return res.status(400).json({ message: '没有提取到有效的文本内容' });
    }

    // 创建向量存储
    try {
      console.log('开始向量化处理...');
      console.log(`文档片段总数: ${documents.length}`);
      console.log(`示例文档内容: "${documents[0].pageContent.substring(0, 100)}..."`);
      
      vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
      console.log('向量化处理完成');
    } catch (error) {
      console.error('向量化处理失败:', error);
      
      // 尝试切换到备用嵌入模型
      try {
        console.log('尝试使用备用OpenAI嵌入模型...');
        const fallbackEmbeddings = new OpenAIEmbeddings({
          openAIApiKey: apiKey,
          modelName: 'text-embedding-ada-002',
          configuration: {
            basePath: apiEndpoint ? `${apiEndpoint}/v1` : undefined,
          },
        });
        vectorStore = await MemoryVectorStore.fromDocuments(documents, fallbackEmbeddings);
        console.log('使用备用嵌入模型成功');
      } catch (fallbackError) {
        console.error('备用嵌入模型也失败:', fallbackError);
        return res.status(500).json({ message: `向量化处理失败，原始错误: ${error.message}, 备用模型错误: ${fallbackError.message}` });
      }
    }
    
    // 获取向量示例以返回给前端
    const vectors = documents.map((doc, index) => {
      let embedding = [];
      try {
        if (vectorStore.memoryVectors[index] && vectorStore.memoryVectors[index].embedding) {
          embedding = vectorStore.memoryVectors[index].embedding.slice(0, 5);
        } else {
          console.error(`向量 ${index} 不存在`);
          embedding = [0, 0, 0, 0, 0]; // 返回默认向量
        }
      } catch (error) {
        console.error(`获取向量 ${index} 失败:`, error);
        embedding = [0, 0, 0, 0, 0]; // 返回默认向量
      }
      
      return {
        id: index,
        text: doc.pageContent.substring(0, 100) + '...',
        source: doc.metadata.source,
        embedding: embedding,
      };
    });

    res.json({ vectors });
  } catch (error) {
    console.error('处理文件错误:', error);
    res.status(500).json({ message: '处理文件失败', error: error.message });
  }
});

// 处理查询API函数
app.post('/api/query', async (req, res) => {
  try {
    const { query, apiKey, apiEndpoint, embeddingModel, embeddingApiKey, embeddingEndpoint, modelName } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: '未提供查询内容' 
      });
    }
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        message: '未提供API密钥'
      });
    }
    
    if (!vectorStore) {
      return res.status(400).json({ 
        success: false, 
        message: '向量存储为空，请先上传并处理文档'
      });
    }
    
    console.log(`处理查询: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    console.log(`使用API端点: ${apiEndpoint || 'Default OpenAI'}`);
    console.log(`使用模型: ${modelName || 'gpt-3.5-turbo'}`);
    
    // 确保查询文本不超过API限制
    const truncatedQuery = query.substring(0, 1000);
    if (truncatedQuery.length < query.length) {
      console.log(`查询文本已被截断，原长度: ${query.length} -> ${truncatedQuery.length}`);
    }
    
    try {
      // 创建LangChain语言模型实例
      const model = new LangchainOpenAI({
        openAIApiKey: apiKey,
        modelName: modelName || 'gpt-3.5-turbo',
        temperature: 0.3,
        maxTokens: 800,
        configuration: {
          basePath: apiEndpoint ? `${apiEndpoint}/v1` : undefined,
        },
      });
      
      // 创建提示模板
      const PROMPT = PromptTemplate.fromTemplate(
        `请根据以下信息回答用户的问题。如果无法从提供的信息中找到答案，请明确告知您不知道，不要编造信息。

信息:
{context}

用户问题: {question}

请用中文简明扼要地回答:`
      );
      
      // 创建一个基于检索的问答链
      const chain = new RetrievalQAChain({
        combineDocumentsChain: loadQAStuffChain(model, { prompt: PROMPT }),
        retriever: vectorStore.asRetriever(),
        returnSourceDocuments: true,
      });
      
      // 执行问答链
      console.log('执行LangChain问答链...');
      const result = await chain.call({
        query: truncatedQuery,
      });
      
      console.log('LangChain查询完成');
      console.log(`找到的源文档数量: ${result.sourceDocuments?.length || 0}`);
      
      // 确保源文档中文件名正确编码
      const sources = result.sourceDocuments?.map(doc => {
        let sourceName = doc.metadata.source;
        
        // 使用工具函数修复文件名
        sourceName = fixChineseFilename(sourceName);
        
        return {
          content: doc.pageContent.substring(0, 150) + '...',
          source: sourceName
        };
      }) || [];
      
      // 返回结果给前端
      return res.json({
        success: true,
        answer: result.text,
        sources: sources
      });
    } catch (error) {
      console.error('LangChain处理查询错误:', error);
      
      // 备用方法: 直接返回找到的相关文档
      try {
        console.log('使用备用方法获取答案...');
        const similarDocs = await vectorStore.similaritySearch(truncatedQuery, 2);
        
        if (similarDocs && similarDocs.length > 0) {
          const answer = `我找到了这些可能相关的信息:\n\n${similarDocs.map(doc => doc.pageContent).join('\n\n')}`;
          
          // 确保源文档中文件名正确编码
          const sources = similarDocs.map(doc => {
            let sourceName = doc.metadata.source;
            
            // 使用工具函数修复文件名
            sourceName = fixChineseFilename(sourceName);
            
            return {
              content: doc.pageContent.substring(0, 150) + '...',
              source: sourceName
            };
          });
          
          return res.json({ 
            success: true, 
            answer: answer,
            sources: sources
          });
        } else {
          throw new Error('备用搜索方法无结果');
        }
      } catch (backupError) {
        console.error('备用方法也失败:', backupError);
        return res.status(500).json({ 
          success: false, 
          message: '处理查询失败，请稍后再试',
          error: error.message 
        });
      }
    }
  } catch (error) {
    console.error('查询接口错误:', error);
    return res.status(500).json({ 
      success: false, 
      message: '查询处理失败', 
      error: error.message 
    });
  }
});

// 文件上传和文本提取
app.post('/api/extractText', upload.array('files', 10), async (req, res) => {
  console.log('收到文件上传请求');
  try {
    // 确保上传目录存在
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      console.log(`创建上传目录: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const files = req.files;
    console.log(`收到 ${files ? files.length : 0} 个文件`);
    
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: '未上传文件' });
    }
    
    // 验证文件类型
    const validFiles = [];
    const invalidFiles = [];
    
    for (const file of files) {
      // 确保文件名正确编码
      if (!file.decodedOriginalname) {
        file.decodedOriginalname = fixChineseFilename(file.originalname);
      }
      
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.txt' || ext === '.md') {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.decodedOriginalname || file.originalname);
      }
    }
    
    if (validFiles.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: `不支持的文件类型: ${invalidFiles.join(', ')}，仅支持.txt和.md文件` 
      });
    }
    
    // 处理所有上传的文件
    const extractedTexts = [];
    
    for (const file of validFiles) {
      try {
        console.log(`处理文件: ${file.decodedOriginalname || file.originalname} (${file.size} 字节)`);
        // 使用同步方法读取文件内容
        const text = fs.readFileSync(file.path, 'utf-8');
        
        if (!text || text.trim().length === 0) {
          console.warn(`文件 ${file.decodedOriginalname || file.originalname} 内容为空，跳过`);
          continue;
        }
        
        extractedTexts.push({
          filename: file.decodedOriginalname || file.originalname,
          text: text,
          size: text.length
        });
        
        console.log(`成功提取 ${file.decodedOriginalname || file.originalname} 的文本，长度: ${text.length} 字符`);
      } catch (error) {
        console.error(`处理文件 ${file.decodedOriginalname || file.originalname} 失败:`, error);
        // 继续处理其他文件，而不是立即返回错误
      }
    }
    
    if (extractedTexts.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '未能从任何上传的文件中提取有效文本内容' 
      });
    }
    
    res.json({ 
      success: true, 
      message: `成功从 ${extractedTexts.length} 个文件中提取文本`,
      extractedTexts: extractedTexts
    });
  } catch (error) {
    console.error('文件上传处理错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '文件处理失败', 
      error: error.message 
    });
  }
});

// 向量化处理
app.post('/api/vectorize', async (req, res) => {
  try {
    const { 
      extractedTexts, 
      embeddingModel, 
      apiKey, 
      apiEndpoint, 
      embeddingApiKey, 
      embeddingEndpoint 
    } = req.body;
    
    if (!extractedTexts || !Array.isArray(extractedTexts) || extractedTexts.length === 0) {
      return res.status(400).json({ success: false, message: '未提供文本内容' });
    }
    
    if (!apiKey) {
      return res.status(400).json({ success: false, message: '未提供API密钥' });
    }
    
    console.log(`正在处理向量化，使用嵌入模型: ${embeddingModel}`);
    console.log(`嵌入模型API端点: ${embeddingEndpoint || '默认'}`);
    console.log(`提供的文本数量: ${extractedTexts.length}`);
    
    // 修复提取文本中的文件名
    const processedTexts = extractedTexts.map(item => {
      return {
        ...item,
        filename: fixChineseFilename(item.filename)
      };
    });
    
    // 创建嵌入模型
    let embeddings;
    try {
      embeddings = getEmbeddingModel(embeddingModel, apiKey, apiEndpoint, embeddingApiKey, embeddingEndpoint);
      console.log('成功创建嵌入模型实例');
    } catch (error) {
      console.error('创建嵌入模型失败:', error);
      return res.status(500).json({ success: false, message: `创建嵌入模型失败: ${error.message}` });
    }
    
    // 处理所有文本
    let documents = [];
    
    for (const item of processedTexts) {
      try {
        if (!item || !item.text || item.text.trim().length === 0) {
          console.warn(`文本内容为空，跳过`);
          continue;
        }
        
        console.log(`处理文本: ${item.filename} (长度: ${item.text.length} 字符)`);
        
        // 文本分割
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 500, // 减小块大小，确保不超过API的512 tokens限制
          chunkOverlap: 50,
        });
        
        const docs = await textSplitter.createDocuments(
          [item.text], 
          [{ source: item.filename }]  // 使用修复后的文件名
        );
        
        if (!docs || docs.length === 0) {
          console.warn(`文本 ${item.filename} 分割后没有有效片段，跳过`);
          continue;
        }
        
        console.log(`文本 ${item.filename} 分割为 ${docs.length} 个片段`);
        
        // 过滤掉任何无效的文档对象
        const validDocs = docs.filter(doc => doc && doc.pageContent && doc.pageContent.trim().length > 0);
        
        if (validDocs.length === 0) {
          console.warn(`文本 ${item.filename} 没有有效内容片段，跳过`);
          continue;
        }
        
        documents.push(...validDocs);
      } catch (error) {
        console.error(`处理文本 ${item.filename} 失败:`, error);
        // 继续处理其他文本
      }
    }
    
    if (documents.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '未能生成有效的文档片段' 
      });
    }
    
    console.log(`总共生成 ${documents.length} 个文档片段`);
    
    // 创建向量存储
    try {
      console.log('开始创建向量存储...');
      
      // 检查是否有有效的documents
      if (!documents.every(doc => doc && doc.pageContent)) {
        // 过滤掉无效文档
        documents = documents.filter(doc => doc && doc.pageContent);
        console.warn(`过滤后剩余 ${documents.length} 个有效文档片段`);
        
        if (documents.length === 0) {
          throw new Error('没有有效的文档可以向量化');
        }
      }
      
      vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
      console.log('向量存储创建成功');
    } catch (error) {
      console.error('创建向量存储失败:', error);
      
      // 尝试使用逐个添加文档的方式
      try {
        console.log('尝试备用方法创建向量存储...');
        vectorStore = new MemoryVectorStore(embeddings);
        
        // 逐个处理文档以隔离错误
        for (let i = 0; i < documents.length; i++) {
          try {
            if (documents[i] && documents[i].pageContent) {
              await vectorStore.addDocuments([documents[i]]);
            }
          } catch (docError) {
            console.error(`添加文档 ${i} 失败:`, docError);
            // 继续处理下一个文档
          }
        }
        
        if (vectorStore.memoryVectors.length === 0) {
          throw new Error('备用方法未能添加任何向量');
        }
        
        console.log(`备用方法成功添加了 ${vectorStore.memoryVectors.length} 个向量`);
      } catch (fallbackError) {
        console.error('备用方法也失败:', fallbackError);
        return res.status(500).json({ 
          success: false, 
          message: `向量化处理失败，原始错误: ${error.message}, 备用错误: ${fallbackError.message}` 
        });
      }
    }
    
    // 获取向量示例以返回给前端
    const vectors = documents.map((doc, index) => {
      let embedding = [];
      try {
        if (index < vectorStore.memoryVectors.length && 
            vectorStore.memoryVectors[index] && 
            vectorStore.memoryVectors[index].embedding) {
          embedding = vectorStore.memoryVectors[index].embedding.slice(0, 5);
        } else {
          console.error(`向量 ${index} 不存在或无效`);
          embedding = [0, 0, 0, 0, 0]; // 返回默认向量
        }
      } catch (error) {
        console.error(`获取向量 ${index} 失败:`, error);
        embedding = [0, 0, 0, 0, 0]; // 返回默认向量
      }
      
      // 确保源文件名正确编码
      let sourceName = doc.metadata.source;
      sourceName = fixChineseFilename(sourceName);
      
      return {
        id: index,
        text: doc.pageContent.substring(0, 100) + (doc.pageContent.length > 100 ? '...' : ''),
        source: sourceName,
        embedding: embedding,
      };
    });
    
    res.json({ 
      success: true, 
      message: '向量化处理完成',
      vectors: vectors.slice(0, 10), // 只返回前10个向量的示例
      totalVectors: vectors.length
    });
  } catch (error) {
    console.error('向量化处理错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '向量化处理失败', 
      error: error.message 
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器已启动，监听端口: ${port}`);
});