"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentExecutor = createAgentExecutor;
exports.runAgent = runAgent;
const agents_1 = require("langchain/agents");
const llm_1 = require("../models/llm");
/**
 * 创建代理执行器
 * @param tools 工具列表
 * @param llm 语言模型实例，默认为GPT-3.5
 * @returns 代理执行器
 */
async function createAgentExecutor(tools, llm) {
    // 如果未提供llm实例，则创建一个默认的GPT-3.5实例
    const model = llm || llm_1.LLMFactory.createGPT3_5();
    // 创建代理执行器
    const executor = await (0, agents_1.initializeAgentExecutorWithOptions)(tools, model, {
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
async function runAgent(executor, input) {
    try {
        const response = await executor.invoke({ input });
        return response.output;
    }
    catch (error) {
        console.error('代理执行器执行失败:', error);
        throw error;
    }
}
