"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmbeddings = createEmbeddings;
exports.createVectorStoreFromDocs = createVectorStoreFromDocs;
exports.loadDocumentsFromDirectory = loadDocumentsFromDirectory;
exports.loadOrCreateVectorStore = loadOrCreateVectorStore;
const openai_1 = require("@langchain/openai");
const chroma_1 = require("@langchain/community/vectorstores/chroma");
const text_1 = require("langchain/document_loaders/fs/text");
const pdf_1 = require("langchain/document_loaders/fs/pdf");
const directory_1 = require("langchain/document_loaders/fs/directory");
const text_splitter_1 = require("langchain/text_splitter");
const config_1 = require("../config/config");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * 创建OpenAI嵌入模型
 * @returns OpenAIEmbeddings实例
 */
function createEmbeddings() {
    return new openai_1.OpenAIEmbeddings({
        openAIApiKey: config_1.env.OPENAI_API_KEY,
    });
}
/**
 * 从文档创建向量存储
 * @param docs 文档列表
 * @param collectionName 集合名称
 * @returns Chroma向量存储
 */
async function createVectorStoreFromDocs(docs, collectionName = 'default') {
    const embeddings = createEmbeddings();
    // 确保向量存储目录存在
    if (!fs_1.default.existsSync(config_1.VECTOR_STORE_DIR)) {
        fs_1.default.mkdirSync(config_1.VECTOR_STORE_DIR, { recursive: true });
    }
    // 创建向量存储
    const vectorStore = await chroma_1.Chroma.fromDocuments(docs, embeddings, {
        collectionName,
        url: `file://${config_1.VECTOR_STORE_DIR}`,
    });
    return vectorStore;
}
/**
 * 从目录加载文档
 * @param dirPath 目录路径
 * @returns 文档列表
 */
async function loadDocumentsFromDirectory(dirPath) {
    // 确保目录存在
    if (!fs_1.default.existsSync(dirPath)) {
        throw new Error(`目录不存在: ${dirPath}`);
    }
    // 创建目录加载器
    const loader = new directory_1.DirectoryLoader(dirPath, {
        '.txt': (path) => new text_1.TextLoader(path),
        '.pdf': (path) => new pdf_1.PDFLoader(path),
    });
    // 加载文档
    const docs = await loader.load();
    // 文本分割
    const textSplitter = new text_splitter_1.RecursiveCharacterTextSplitter({
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
async function loadOrCreateVectorStore(dirPath, collectionName = 'default') {
    const chromaDir = path_1.default.join(config_1.VECTOR_STORE_DIR, collectionName);
    const embeddings = createEmbeddings();
    // 检查向量存储是否已存在
    if (fs_1.default.existsSync(chromaDir)) {
        // 使用新的API加载现有向量存储
        const vectorStore = await new chroma_1.Chroma(embeddings, {
            collectionName,
            url: `file://${config_1.VECTOR_STORE_DIR}`,
        });
        return vectorStore;
    }
    // 创建新的向量存储
    const docs = await loadDocumentsFromDirectory(dirPath);
    return createVectorStoreFromDocs(docs, collectionName);
}
