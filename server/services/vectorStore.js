import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs";
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
 * 获取默认的向量存储路径
 * @returns {string} 向量存储路径
 */
export function getDefaultVectorStorePath() {
  const vectorStoreDir = path.join(process.cwd(), "server", "vector_stores");

  // 确保目录存在
  if (!fs.existsSync(vectorStoreDir)) {
    fs.mkdirSync(vectorStoreDir, { recursive: true });
  }

  return path.join(vectorStoreDir, "default_vector_store");
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
 * 将新文档添加到现有向量存储中
 * @param {string} storePath 现有向量存储路径
 * @param {Array} documents 新文档数组
 * @param {object} embeddings 嵌入模型
 * @returns {Promise<{vectorStore: MemoryVectorStore, addedCount: number}>} 更新后的向量存储和添加的向量数量
 */
export async function addToVectorStore(storePath, documents, embeddings) {
  if (!documents || documents.length === 0) {
    throw new Error("没有提供文档进行向量化");
  }

  if (!embeddings) {
    throw new Error("未提供嵌入模型");
  }

  try {
    let vectorStore;
    let originalSize = 0;
    const jsonPath = `${storePath}.json`;

    // 检查向量存储是否已存在
    if (fs.existsSync(jsonPath)) {
      // 加载现有向量存储
      vectorStore = await loadVectorStore(storePath, embeddings);
      originalSize = vectorStore.memoryVectors.length;
      console.log(`加载现有向量存储，包含 ${originalSize} 个向量`);
    } else {
      // 创建新的向量存储
      console.log(`创建新的向量存储`);
      vectorStore = new MemoryVectorStore(embeddings);
    }

    // 添加新文档
    console.log(`向现有向量存储添加 ${documents.length} 个新文档`);
    await vectorStore.addDocuments(documents);

    // 保存更新后的向量存储
    const updatedSize = vectorStore.memoryVectors.length;
    const addedCount = updatedSize - originalSize;
    console.log(
      `成功添加 ${addedCount} 个向量，当前共有 ${updatedSize} 个向量`
    );

    // 序列化并保存
    const serialized = JSON.stringify({
      vectors: vectorStore.memoryVectors,
      documentIds: vectorStore.documentIds,
    });

    // 确保存储目录存在
    const storeDir = path.dirname(storePath);
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }

    fs.writeFileSync(jsonPath, serialized);
    console.log(`更新后的向量存储已保存到: ${jsonPath}`);

    return {
      vectorStore,
      addedCount,
      totalCount: updatedSize,
    };
  } catch (error) {
    console.error("添加到向量存储失败:", error);
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
