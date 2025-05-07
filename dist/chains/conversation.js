"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConversationChain = createConversationChain;
exports.runConversation = runConversation;
const chains_1 = require("langchain/chains");
const memory_1 = require("langchain/memory");
const llm_1 = require("../models/llm");
/**
 * 创建基本对话链
 * @param llm 语言模型实例，默认为GPT-3.5
 * @returns 对话链实例
 */
function createConversationChain(llm) {
    // 如果未提供llm实例，则创建一个默认的GPT-3.5实例
    const model = llm || llm_1.LLMFactory.createGPT3_5();
    // 创建内存存储
    const memory = new memory_1.BufferMemory();
    // 创建对话链
    const chain = new chains_1.ConversationChain({
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
async function runConversation(chain, input) {
    try {
        const response = await chain.invoke({ input });
        return response.response;
    }
    catch (error) {
        console.error('对话链执行失败:', error);
        throw error;
    }
}
