"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMFactory = void 0;
const openai_1 = require("@langchain/openai");
const config_1 = require("../config/config");
// LLM模型工厂类
class LLMFactory {
    /**
     * 创建ChatOpenAI实例
     * @param model 模型名称
     * @param temperature 温度
     * @returns ChatOpenAI实例
     */
    static createChatOpenAI(model = config_1.MODEL_LIST.GPT3_5, temperature = config_1.DEFAULT_TEMPERATURE) {
        return new openai_1.ChatOpenAI({
            modelName: model,
            temperature,
            openAIApiKey: config_1.env.OPENAI_API_KEY,
        });
    }
    /**
     * 创建基于GPT-3.5 Turbo的LLM实例
     * @param temperature 温度
     * @returns ChatOpenAI实例
     */
    static createGPT3_5(temperature = config_1.DEFAULT_TEMPERATURE) {
        return this.createChatOpenAI(config_1.MODEL_LIST.GPT3_5, temperature);
    }
    /**
     * 创建基于GPT-4的LLM实例
     * @param temperature 温度
     * @returns ChatOpenAI实例
     */
    static createGPT4(temperature = config_1.DEFAULT_TEMPERATURE) {
        return this.createChatOpenAI(config_1.MODEL_LIST.GPT4, temperature);
    }
    /**
     * 创建基于GPT-4 Turbo的LLM实例
     * @param temperature 温度
     * @returns ChatOpenAI实例
     */
    static createGPT4Turbo(temperature = config_1.DEFAULT_TEMPERATURE) {
        return this.createChatOpenAI(config_1.MODEL_LIST.GPT4_TURBO, temperature);
    }
}
exports.LLMFactory = LLMFactory;
