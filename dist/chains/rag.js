"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRAGChain = createRAGChain;
exports.runRAG = runRAG;
const combine_documents_1 = require("langchain/chains/combine_documents");
const retrieval_1 = require("langchain/chains/retrieval");
const prompts_1 = require("@langchain/core/prompts");
const llm_1 = require("../models/llm");
/**
 * 创建RAG（检索增强生成）链
 * @param vectorStore 向量存储
 * @param llm 语言模型实例，默认为GPT-3.5
 * @returns RAG链
 */
async function createRAGChain(vectorStore, llm) {
    // 如果未提供llm实例，则创建一个默认的GPT-3.5实例
    const model = llm || llm_1.LLMFactory.createGPT3_5();
    // 创建提示模板
    const prompt = prompts_1.ChatPromptTemplate.fromTemplate(`
    你是一个有帮助的AI助手。使用以下检索到的上下文来回答问题。
    如果你不知道答案，只需说你不知道，不要试图编造答案。
    
    上下文：{context}
    
    问题：{question}
  `);
    // 创建文档合并链
    const documentChain = await (0, combine_documents_1.createStuffDocumentsChain)({
        llm: model,
        prompt,
        documentPrompt: prompts_1.ChatPromptTemplate.fromTemplate("{page_content}"),
        documentSeparator: "\n\n",
    });
    // 创建检索器
    const retriever = vectorStore.asRetriever({
        k: 5, // 检索5个最相关的文档
    });
    // 创建检索链
    const retrievalChain = await (0, retrieval_1.createRetrievalChain)({
        combineDocsChain: documentChain,
        retriever,
    });
    return retrievalChain;
}
/**
 * 运行RAG链
 * @param chain RAG链
 * @param question 用户问题
 * @returns 模型响应
 */
async function runRAG(chain, question) {
    try {
        const response = await chain.invoke({
            question,
        });
        return response.answer;
    }
    catch (error) {
        console.error('RAG链执行失败:', error);
        throw error;
    }
}
