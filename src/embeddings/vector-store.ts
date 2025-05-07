import { OpenAIEmbeddings } from '@langchain/openai';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { env, VECTOR_STORE_DIR } from '../config/config';
import path from 'path';
import fs from 'fs';

/**
 * 创建OpenAI嵌入模型
 * @returns OpenAIEmbeddings实例
 */
export function createEmbeddings(): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    openAIApiKey: env.OPENAI_API_KEY,
  });
}

/**
 * 从文档创建向量存储
 * @param docs 文档列表
 * @param collectionName 集合名称
 * @returns Chroma向量存储
 */
export async function createVectorStoreFromDocs(
  docs: Document[],
  collectionName: string = 'default'
): Promise<Chroma> {
  const embeddings = createEmbeddings();
  
  // 确保向量存储目录存在
  if (!fs.existsSync(VECTOR_STORE_DIR)) {
    fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
  }
  
  // 创建向量存储
  const vectorStore = await Chroma.fromDocuments(docs, embeddings, {
    collectionName,
    url: `file://${VECTOR_STORE_DIR}`,
  });
  
  return vectorStore;
}

/**
 * 从目录加载文档
 * @param dirPath 目录路径
 * @returns 文档列表
 */
export async function loadDocumentsFromDirectory(dirPath: string): Promise<Document[]> {
  // 确保目录存在
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`);
  }
  
  // 创建目录加载器
  const loader = new DirectoryLoader(dirPath, {
    '.txt': (path) => new TextLoader(path),
    '.pdf': (path) => new PDFLoader(path),
  });
  
  // 加载文档
  const docs = await loader.load();
  
  // 文本分割
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  // 分割文档
  const splitDocs = await textSplitter.splitDocuments(docs);
  
  return splitDocs;
}

/**
 * 加载或创建向量存储
 * @param dirPath 文档目录路径
 * @param collectionName 集合名称
 * @returns Chroma向量存储
 */
export async function loadOrCreateVectorStore(
  dirPath: string,
  collectionName: string = 'default'
): Promise<Chroma> {
  const chromaDir = path.join(VECTOR_STORE_DIR, collectionName);
  const embeddings = createEmbeddings();
  
  // 检查向量存储是否已存在
  if (fs.existsSync(chromaDir)) {
    // 使用新的API加载现有向量存储
    const vectorStore = await new Chroma(embeddings, {
      collectionName,
      url: `file://${VECTOR_STORE_DIR}`,
    });
    return vectorStore;
  }
  
  // 创建新的向量存储
  const docs = await loadDocumentsFromDirectory(dirPath);
  return createVectorStoreFromDocs(docs, collectionName);
} 