import { ConversationChain } from 'langchain/chains';
import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory } from 'langchain/memory';
import { LLMFactory } from '../models/llm';

/**
 * 创建基本对话链
 * @param llm 语言模型实例，默认为GPT-3.5
 * @returns 对话链实例
 */
export function createConversationChain(llm?: ChatOpenAI) {
  // 如果未提供llm实例，则创建一个默认的GPT-3.5实例
  const model = llm || LLMFactory.createGPT3_5();

  // 创建内存存储
  const memory = new BufferMemory();

  // 创建对话链
  const chain = new ConversationChain({
    llm: model,
    memory,
  });

  return chain;
}

/**
 * 运行对话链
 * @param chain 对话链实例
 * @param input 用户输入
 * @returns 模型响应
 */
export async function runConversation(chain: ConversationChain, input: string): Promise<string> {
  try {
    const response = await chain.invoke({ input });
    return response.response;
  } catch (error) {
    console.error('对话链执行失败:', error);
    throw error;
  }
} 