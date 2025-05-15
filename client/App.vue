<template>
  <div class="container mt-4">
    <h1 class="text-center mb-4">智能客服系统</h1>
    
    <div class="row">
      <div class="col-md-6">
        <!-- 配置面板 -->
        <div class="card mb-4">
          <div class="card-header">
            配置
          </div>
          <div class="card-body">
            <div class="mb-3">
              <label for="apiEndpoint" class="form-label">模型API地址</label>
              <input type="text" class="form-control" id="apiEndpoint" v-model="apiEndpoint" placeholder="例如: https://api.openai.com/v1">
            </div>
            
            <div class="mb-3">
              <label for="modelName" class="form-label">模型名称</label>
              <input type="text" class="form-control" id="modelName" v-model="modelName" placeholder="例如: gpt-3.5-turbo">
            </div>
            
            <div class="mb-3">
              <label for="apiKey" class="form-label">API密钥</label>
              <input type="password" class="form-control" id="apiKey" v-model="apiKey" placeholder="输入您的API密钥">
            </div>
            
            <div class="mb-3" >
              <label for="embeddingEndpoint" class="form-label">Embedding API地址</label>
              <input type="text" class="form-control" id="embeddingEndpoint" v-model="embeddingEndpoint" placeholder="硅基流动API地址">
            </div>
            
            <div class="mb-3">
              <label for="embeddingApiKey" class="form-label">Embedding API密钥</label>
              <input type="password" class="form-control" id="embeddingApiKey" v-model="embeddingApiKey" placeholder="输入Embedding API密钥">
            </div>
          </div>
        </div>
        
        <!-- 上传文件卡片 -->
        <div class="card mb-4">
          <div class="card-header">
            上传文档
          </div>
          <div class="card-body">
            <div class="mb-3">
              <label for="fileUpload" class="form-label">选择文档文件</label>
              <input class="form-control" type="file" id="fileUpload" accept=".txt,.md" @change="onFileSelected" multiple>
              <div class="form-text">仅支持 .txt 和 .md 文本文件</div>
            </div>
            
            <button @click="uploadFiles" class="btn btn-primary" :disabled="!selectedFiles.length || isProcessing">
              {{ isProcessing ? '处理中...' : '上传并处理文件' }}
            </button>
            
            <!-- 处理状态显示 -->
            <div v-if="processingStatus" class="alert mt-3" :class="processingStatus.type">
              {{ processingStatus.message }}
            </div>
            
            <!-- 错误信息显示 -->
            <div v-if="errorMessage" class="alert mt-3 alert-danger">
              {{ errorMessage }}
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-md-6">
        <!-- 向量化结果卡片 -->
        <div class="card mb-4">
          <div class="card-header">
            向量化结果
          </div>
          <div class="card-body">
            <div v-if="vectors.length" class="mb-3">
              <p>已处理 {{ vectors.length }} 个文档片段</p>
              <div class="vector-sample">
                <p><strong>示例向量:</strong></p>
                <small class="text-muted">{{ getVectorSample() }}</small>
              </div>
            </div>
            <div v-else class="text-center text-muted py-4">
              上传并处理文件后将显示向量化结果
            </div>
          </div>
        </div>
        
        <!-- 聊天区域卡片 -->
        <div class="card">
          <div class="card-header">
            智能客服对话
          </div>
          <div class="card-body">
            <div class="chat-container mb-3">
              <div v-for="(message, index) in chatHistory" :key="index" class="chat-message" :class="message.role">
                <div class="message-content">
                  {{ message.content }}
                </div>
              </div>
            </div>
            
            <div class="input-group">
              <input type="text" class="form-control" placeholder="请输入您的问题..." v-model="userQuery" @keyup.enter="sendQuery" :disabled="!vectors.length || isQueryProcessing">
              <button class="btn btn-primary" @click="sendQuery" :disabled="!vectors.length || isQueryProcessing || !userQuery.trim()">
                {{ isQueryProcessing ? '处理中...' : '发送' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { fixEncodingIssues } from './utils.js';

// 配置axios基础URL
axios.defaults.baseURL = 'http://localhost:3001';

export default {
  name: 'App',
  data() {
    return {
      apiEndpoint: 'https://api.chatanywhere.tech',
      modelName: 'gpt-3.5-turbo-1106',
      apiKey: 'sk-SkcQl4ZMGeagsTmrwKL3xcDst8IpEfCOT5RoO22rDTYU2u7D',
      embeddingEndpoint: 'https://api.siliconflow.cn/v1/embeddings',
      embeddingModel: 'BAAI/bge-large-zh-v1.5', 
      embeddingApiKey: 'sk-esvuhwigovazzljmtcmwgsmwcrgbrnrtzokaireqyytezgdh',
      selectedFiles: [],
      extractedTexts: [], // 存储从文件中提取的文本
      vectors: [],
      isProcessing: false,
      isVectorizing: false,
      processingStatus: null,
      chatHistory: [],
      userQuery: '',
      isQueryProcessing: false,
      errorMessage: '',
      isFileUploading: false
    };
  },
  methods: {
    onFileSelected(event) {
      this.selectedFiles = Array.from(event.target.files);
    },
    
    // 上传并处理文件
    async uploadFiles() {
      if (!this.selectedFiles.length) return;
      
      this.isFileUploading = true;
      this.processingStatus = {
        type: 'alert-info',
        message: '正在上传和处理文件...'
      };
      
      try {
        // 第一步：上传文件并提取文本
        const formData = new FormData();
        
        // 添加所有选中的文件到formData
        for (let i = 0; i < this.selectedFiles.length; i++) {
          const file = this.selectedFiles[i];
          console.log(`添加文件: ${file.name} (${file.size} 字节)`);
          formData.append('files', file);
        }
        
        console.log('发送文件上传请求...');
        const textExtractResponse = await axios.post('/api/extractText', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: 60000 // 60秒超时
        });
        
        if (!textExtractResponse.data.success) {
          throw new Error(textExtractResponse.data.message || '文本提取失败');
        }
        
        console.log('文本提取成功:', textExtractResponse.data);
        
        // 确保文件名正确显示
        this.extractedTexts = textExtractResponse.data.extractedTexts.map(item => {
          return {
            ...item,
            filename: fixEncodingIssues(item.filename)  // 使用工具函数处理文件名
          };
        });
        
        // 第二步：向量化处理提取的文本
        this.processingStatus = {
          type: 'alert-info',
          message: '正在进行向量化处理，请稍候...'
        };
        
        const vectorizeResponse = await axios.post('/api/vectorize', {
          extractedTexts: this.extractedTexts,
          embeddingModel: this.embeddingModel,
          apiEndpoint: this.apiEndpoint,
          embeddingEndpoint: this.embeddingEndpoint,
          apiKey: this.apiKey,
          embeddingApiKey: this.embeddingApiKey
        }, {
          timeout: 120000
        });
        
        if (!vectorizeResponse.data.success) {
          throw new Error(vectorizeResponse.data.message || '向量化处理失败');
        }
        
        // 处理向量数据中的文件名
        this.vectors = vectorizeResponse.data.vectors.map(vector => {
          return {
            ...vector,
            source: fixEncodingIssues(vector.source)  // 使用工具函数修复向量数据中的文件名
          };
        });
        
        this.processingStatus = {
          type: 'alert-success',
          message: `成功处理了 ${vectorizeResponse.data.totalVectors} 个文档片段`
        };
      } catch (error) {
        console.error('处理文件失败', error);
        
        let errorMessage = '处理失败';
        if (error.response) {
          errorMessage = `处理失败: ${error.response.data?.message || error.message}`;
          console.error('服务器响应:', error.response.data);
        } else if (error.request) {
          errorMessage = '服务器未响应，请确保后端服务正在运行';
        } else {
          errorMessage = `请求错误: ${error.message}`;
        }
        
        this.processingStatus = {
          type: 'alert-danger',
          message: errorMessage
        };
      } finally {
        this.isFileUploading = false;
      }
    },
    
    // 获取向量示例
    getVectorSample() {
      if (!this.vectors.length) return '';
      
      const vector = this.vectors[0].embedding;
      if (vector.length > 20) {
        return JSON.stringify(vector.slice(0, 10)) + '... (省略了 ' + (vector.length - 10) + ' 个维度)';
      }
      return JSON.stringify(vector);
    },
    
    // 发送查询
    async sendQuery() {
      if (!this.userQuery.trim() || !this.vectors.length) return;
      
      this.chatHistory.push({
        role: 'user',
        content: this.userQuery
      });
      
      const query = this.userQuery;
      this.userQuery = '';
      this.isQueryProcessing = true;
      
      try {
        // 限制查询文本长度，避免超出API限制
        const truncatedQuery = query.substring(0, 1000);
        if (truncatedQuery.length < query.length) {
          console.log(`查询文本已被截断，原长度: ${query.length} -> ${truncatedQuery.length}`);
        }
        
        console.log('发送查询请求...');
        const response = await axios.post('/api/query', {
          query: truncatedQuery,
          embeddingModel: this.embeddingModel,
          apiEndpoint: this.apiEndpoint,
          apiKey: this.apiKey,
          modelName: this.modelName,  // 确保传递modelName
          embeddingApiKey: this.embeddingApiKey,
          embeddingEndpoint: this.embeddingEndpoint
        }, {
          timeout: 90000 // 增加到90秒超时时间
        });
        
        console.log('收到查询响应:', response.data);
        
        // 添加消息到聊天历史
        if (response.data.success) {
          // 主要回答
          this.chatHistory.push({
            role: 'assistant',
            content: response.data.answer || '未找到相关答案'
          });
          
          // 如果有源文档信息，也可以显示（可选）
          if (response.data.sources && response.data.sources.length > 0) {
            // 确保源文件名正确显示
            const sources = response.data.sources.map(src => {
              return {
                content: src.content,
                source: fixEncodingIssues(src.source)  // 使用工具函数处理文件名
              };
            });
            
            const sourceInfo = "参考信息来源：\n" + 
              sources.map(src => `- ${src.source}: ${src.content}`).join('\n');
            
            this.chatHistory.push({
              role: 'system',
              content: sourceInfo
            });
          }
        } else {
          throw new Error(response.data.message || '查询处理失败');
        }
      } catch (error) {
        console.error('查询失败', error);
        
        let errorMessage;
        if (error.code === 'ECONNABORTED') {
          errorMessage = '请求超时，请稍后再试或简化您的问题';
        } else if (error.response) {
          errorMessage = `查询失败: ${error.response.data?.message || error.message}`;
          console.error('服务器错误响应:', error.response.data);
        } else if (error.request) {
          errorMessage = '服务器未响应，请确保后端服务正在运行';
        } else {
          errorMessage = `请求错误: ${error.message}`;
        }
        
        this.chatHistory.push({
          role: 'system',
          content: errorMessage
        });
      } finally {
        this.isQueryProcessing = false;
      }
    }
  }
};
</script>

<style scoped>
.chat-container {
  height: 300px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 10px;
}

.chat-message {
  margin-bottom: 10px;
  padding: 8px;
  border-radius: 8px;
  max-width: 80%;
}

.chat-message.user {
  background-color: #e9ecef;
  margin-left: auto;
}

.chat-message.assistant {
  background-color: #d1ecf1;
  margin-right: auto;
}

.chat-message.system {
  background-color: #f8d7da;
  margin-right: auto;
  margin-left: auto;
}

.vector-sample {
  font-size: 0.8rem;
  overflow-x: auto;
  background-color: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
}

.text-content-preview {
  max-height: 300px;
  overflow-y: auto;
}

.text-preview {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 0.9rem;
}
</style> 