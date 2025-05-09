"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMFactory = void 0;
const openai_1 = require("@langchain/openai");
const config_1 = require("../config/config");

// 模型列表 - 直接定义以避免config模块问题
const MODEL_LIST = {
    GPT3_5: 'gpt-3.5-turbo',
    GPT4: 'gpt-4',
    GPT4_TURBO: 'gpt-4-turbo-preview',
};

// 默认温度
const DEFAULT_TEMPERATURE = 0.7;

// LLM模型工厂类
class LLMFactory {
    /**
     * 创建ChatOpenAI实例
     * @param model 模型名称
     * @param temperature 温度
     * @returns ChatOpenAI实例
     */
    static createChatOpenAI(model = MODEL_LIST.GPT3_5, temperature = DEFAULT_TEMPERATURE) {
        return new openai_1.ChatOpenAI({
            modelName: model,
            temperature,
            openAIApiKey: process.env.OPENAI_API_KEY,
            openAIBaseURL: process.env.OPENAI_BASE_URL,
            timeout: 60000, // 设置60秒超时
            maxRetries: 3,  // 最多重试3次
            maxConcurrency: 5, // 最大并发请求数
        });
    }

    /**
     * 创建基于GPT-3.5 Turbo的LLM实例
     * @param temperature 温度
     * @returns ChatOpenAI实例
     */
    static createGPT3_5(temperature = DEFAULT_TEMPERATURE) {
        return this.createChatOpenAI(MODEL_LIST.GPT3_5, temperature);
    }

    /**
     * 创建基于GPT-4的LLM实例
     * @param temperature 温度
     * @returns ChatOpenAI实例
     */
    static createGPT4(temperature = DEFAULT_TEMPERATURE) {
        return this.createChatOpenAI(MODEL_LIST.GPT4, temperature);
    }

    /**
     * 创建基于GPT-4 Turbo的LLM实例
     * @param temperature 温度
     * @returns ChatOpenAI实例
     */
    static createGPT4Turbo(temperature = DEFAULT_TEMPERATURE) {
        return this.createChatOpenAI(MODEL_LIST.GPT4_TURBO, temperature);
    }
}
exports.LLMFactory = LLMFactory;
