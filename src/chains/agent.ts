import { ChatOpenAI } from '@langchain/openai';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { LLMFactory } from '../models/llm';
import { Tool } from '@langchain/core/tools';

/**
 * 创建代理执行器
 * @param tools 工具列表
 * @param llm 语言模型实例，默认为GPT-3.5
 * @returns 代理执行器
 */
export async function createAgentExecutor(tools: Tool[], llm?: ChatOpenAI) {
  // 如果未提供llm实例，则创建一个默认的GPT-3.5实例
  const model = llm || LLMFactory.createGPT3_5();

  // 创建代理执行器
  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: 'chat-conversational-react-description',
    verbose: true,
    maxIterations: 5,
  });

  return executor;
}

/**
 * 运行代理执行器
 * @param executor 代理执行器
 * @param input 用户输入
 * @returns 模型响应
 */
export async function runAgent(executor: any, input: string): Promise<string> {
  try {
    const response = await executor.invoke({ input });
    return response.output;
  } catch (error) {
    console.error('代理执行器执行失败:', error);
    throw error;
  }
} 