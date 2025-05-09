import { ChatOpenAI } from '@langchain/openai';
import { env, DEFAULT_TEMPERATURE, MODEL_LIST } from '../config/config';

// LLM模型工厂类
export class LLMFactory {
  /**
   * 创建ChatOpenAI实例
   * @param model 模型名称
   * @param temperature 温度
   * @returns ChatOpenAI实例
   */
  static createChatOpenAI(
    model: (typeof MODEL_LIST)[keyof typeof MODEL_LIST] = MODEL_LIST.GPT3_5,
    temperature: number = DEFAULT_TEMPERATURE
  ): ChatOpenAI {
    return new ChatOpenAI({
      modelName: model,
      temperature,
      openAIApiKey: env.OPENAI_API_KEY,
      configuration: {
        baseURL: env.OPENAI_BASE_URL,
      },
    });
  }

  /**
   * 创建基于GPT-3.5 Turbo的LLM实例
   * @param temperature 温度
   * @returns ChatOpenAI实例
   */
  static createGPT3_5(temperature: number = DEFAULT_TEMPERATURE): ChatOpenAI {
    return this.createChatOpenAI(MODEL_LIST.GPT3_5, temperature);
  }

  /**
   * 创建基于GPT-4的LLM实例
   * @param temperature 温度
   * @returns ChatOpenAI实例
   */
  static createGPT4(temperature: number = DEFAULT_TEMPERATURE): ChatOpenAI {
    return this.createChatOpenAI(MODEL_LIST.GPT4, temperature);
  }

  /**
   * 创建基于GPT-4 Turbo的LLM实例
   * @param temperature 温度
   * @returns ChatOpenAI实例
   */
  static createGPT4Turbo(temperature: number = DEFAULT_TEMPERATURE): ChatOpenAI {
    return this.createChatOpenAI(MODEL_LIST.GPT4_TURBO, temperature);
  }
} 