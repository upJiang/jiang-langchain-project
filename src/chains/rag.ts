import { ChatOpenAI } from '@langchain/openai';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LLMFactory } from '../models/llm';
import { VectorStore } from '@langchain/core/vectorstores';

/**
 * 创建RAG（检索增强生成）链
 * @param vectorStore 向量存储
 * @param llm 语言模型实例，默认为GPT-3.5
 * @returns RAG链
 */
export async function createRAGChain(vectorStore: VectorStore, llm?: ChatOpenAI) {
  // 如果未提供llm实例，则创建一个默认的GPT-3.5实例
  const model = llm || LLMFactory.createGPT3_5();

  // 创建提示模板
  const prompt = ChatPromptTemplate.fromTemplate(`
    你是一个有帮助的AI助手。使用以下检索到的上下文来回答问题。
    如果你不知道答案，只需说你不知道，不要试图编造答案。
    
    上下文：{context}
    
    问题：{question}
  `);

  // 创建文档合并链
  const documentChain = await createStuffDocumentsChain({
    llm: model,
    prompt,
    documentPrompt: ChatPromptTemplate.fromTemplate("{page_content}"),
    documentSeparator: "\n\n",
  });

  // 创建检索器
  const retriever = vectorStore.asRetriever({
    k: 5, // 检索5个最相关的文档
  });

  // 创建检索链
  const retrievalChain = await createRetrievalChain({
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
export async function runRAG(chain: any, question: string): Promise<string> {
  try {
    const response = await chain.invoke({
      question,
    });
    return response.answer;
  } catch (error) {
    console.error('RAG链执行失败:', error);
    throw error;
  }
} 