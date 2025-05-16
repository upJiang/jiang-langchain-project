import axios from "axios";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

/**
 * BGE嵌入模型实现
 */
export class BGEEmbeddings {
  constructor() {
    this.apiKey = process.env.EMBEDDING_API_KEY;
    this.apiUrl = process.env.EMBEDDING_ENDPOINT;
    this.modelName = process.env.EMBEDDING_MODEL;

    this.client = axios.create({
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`初始化嵌入模型: ${this.modelName}`);
    console.log(`API端点: ${this.apiUrl}`);
  }

  /**
   * 嵌入文档
   * @param {Array<string>} texts 文本数组
   * @returns {Promise<Array<Array<number>>>} 嵌入向量数组
   */
  async embedDocuments(texts) {
    if (!texts || texts.length === 0) {
      throw new Error("没有提供文本进行嵌入");
    }

    try {
      console.log(`嵌入 ${texts.length} 个文本`);

      // 批次处理，每批最多处理10个文本
      const batchSize = 10;
      const batches = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }

      console.log(`将文本分为 ${batches.length} 批进行处理`);

      // 处理每一批
      const embeddings = [];
      for (const batch of batches) {
        const batchEmbeddings = await this._embedBatch(batch);
        embeddings.push(...batchEmbeddings);
      }

      return embeddings;
    } catch (error) {
      console.error("嵌入文档失败:", error);
      throw error;
    }
  }

  /**
   * 嵌入查询
   * @param {string} text 查询文本
   * @returns {Promise<Array<number>>} 嵌入向量
   */
  async embedQuery(text) {
    if (!text || text.trim().length === 0) {
      throw new Error("没有提供查询文本进行嵌入");
    }

    try {
      const embeddings = await this._embedBatch([text]);
      return embeddings[0];
    } catch (error) {
      console.error("嵌入查询失败:", error);
      throw error;
    }
  }

  /**
   * 批量嵌入文本
   * @private
   * @param {Array<string>} batch 文本批次
   * @returns {Promise<Array<Array<number>>>} 嵌入向量数组
   */
  async _embedBatch(batch) {
    try {
      // 按照硅基流动API的请求格式
      const requestBody = {
        model: this.modelName,
        input: batch,
        encoding_format: "float",
      };

      console.log(
        `请求体: ${JSON.stringify(requestBody).substring(0, 100)}...`
      );

      const response = await this.client.post(this.apiUrl, requestBody);

      if (response.status !== 200) {
        throw new Error(
          `API请求失败: ${response.status} ${response.statusText}`
        );
      }

      // 处理硅基流动API的响应格式
      if (
        !response.data ||
        !response.data.data ||
        !response.data.data[0] ||
        !response.data.data[0].embedding
      ) {
        console.error(
          "无效的API响应:",
          JSON.stringify(response.data).substring(0, 200)
        );
        throw new Error("API响应中没有找到嵌入向量");
      }

      // 返回嵌入向量
      return response.data.data.map((item) => item.embedding);
    } catch (error) {
      console.error("批量嵌入失败:", error);

      // 如果API超时或模型正在加载，等待一段时间后重试
      if (error.response && error.response.status === 503) {
        console.log("模型正在加载，等待5秒后重试...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return this._embedBatch(batch);
      }

      throw error;
    }
  }
}

/**
 * 创建嵌入模型的工厂函数
 * @returns {BGEEmbeddings} 嵌入模型实例
 */
export function createEmbeddingModel() {
  return new BGEEmbeddings();
}
