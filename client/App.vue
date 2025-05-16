<template>
  <div class="container mt-4">
    <h1 class="text-center mb-4">智能文档问答系统</h1>
    
    <div class="row">
      <div class="col-md-5">
        <!-- 上传文件卡片 -->
        <div class="card mb-4 shadow-sm">
          <div class="card-header bg-primary text-white">
            <i class="bi bi-cloud-upload me-2"></i>上传文档
          </div>
          <div class="card-body">
            <div class="mb-3">
              <label for="fileUpload" class="form-label">选择文档文件</label>
              <input class="form-control" type="file" id="fileUpload" accept=".txt,.md,.pdf,.csv,.json,.docx" @change="onFileSelected" multiple>
              <div class="form-text">支持 .txt、.md、.pdf、.csv、.json 和 .docx 格式文件</div>
            </div>
            
            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" id="appendToExisting" v-model="appendToExisting" :disabled="!vectorStorePath">
              <label class="form-check-label" for="appendToExisting">
                添加到已有文档
              </label>
              <div class="form-text" v-if="appendToExisting && vectorStorePath">文档将追加到现有向量库</div>
              <div class="form-text" v-else-if="!vectorStorePath">请先上传至少一个文档</div>
            </div>
            
            <button @click="uploadFiles" class="btn btn-primary w-100" :disabled="!selectedFiles.length || isProcessing">
              <span v-if="isProcessing" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              {{ isProcessing ? '处理中...' : '上传并处理文件' }}
            </button>
            
            <!-- 处理状态显示 -->
            <div v-if="processingStatus" class="alert mt-3" :class="processingStatus.type">
              {{ processingStatus.message }}
            </div>
          </div>
        </div>
        
        <!-- 向量化结果卡片 -->
        <div class="card mb-4 shadow-sm">
          <div class="card-header bg-success text-white">
            <i class="bi bi-diagram-3 me-2"></i>向量化状态
          </div>
          <div class="card-body">
            <div v-if="documentsProcessed" class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span>文档处理进度:</span>
                <span class="badge bg-success">{{ documentsProcessed }} 个文档</span>
              </div>
              <div class="progress mb-3">
                <div class="progress-bar bg-success" role="progressbar" :style="{ width: '100%' }"></div>
              </div>
              
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span>文本块数量:</span>
                <span class="badge bg-info">{{ chunksGenerated }} 个块</span>
              </div>
              
              <div v-if="totalVectors" class="d-flex justify-content-between align-items-center mb-2">
                <span>向量总数量:</span>
                <span class="badge bg-warning text-dark">{{ totalVectors }} 个向量</span>
              </div>
            </div>
            <div v-else class="text-center text-muted py-4">
              <i class="bi bi-cloud-upload fs-2 d-block mb-2"></i>
              上传并处理文件后将显示处理结果
            </div>
          </div>
        </div>
        
        <!-- 查询设置卡片 -->
        <div class="card mb-4 shadow-sm">
          <div class="card-header bg-secondary text-white">
            <i class="bi bi-sliders me-2"></i>查询设置
          </div>
          <div class="card-body">
            <div class="mb-3">
              <label for="similarityThreshold" class="form-label">相似度阈值: {{ similarityThreshold }}</label>
              <input type="range" class="form-range" id="similarityThreshold" min="0" max="1" step="0.05" v-model="similarityThreshold">
              <div class="form-text">较高的阈值可以过滤掉不太相关的文档</div>
            </div>
            
            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" id="useGeneralModel" v-model="useGeneralModelFallback">
              <label class="form-check-label" for="useGeneralModel">
                无相关信息时使用通用模型
              </label>
              <div class="form-text">找不到相关文档时，直接使用通用模型回答</div>
            </div>
            
            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" id="useMemory" v-model="useMemory">
              <label class="form-check-label" for="useMemory">
                启用对话记忆功能
              </label>
              <div class="form-text">AI会记住对话上下文，实现更自然的多轮对话</div>
            </div>
            
            <div class="d-flex justify-content-between">
              <button class="btn btn-outline-secondary btn-sm" @click="resetSession">
                <i class="bi bi-arrow-clockwise me-1"></i>重置会话
              </button>
              <button class="btn btn-outline-danger btn-sm" @click="clearChatHistory">
                <i class="bi bi-trash me-1"></i>清除历史记录
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-md-7">
        <!-- 聊天区域卡片 -->
        <div class="card shadow-sm" style="min-height: 500px;">
          <div class="card-header bg-info text-white d-flex justify-content-between align-items-center">
            <div>
              <i class="bi bi-chat-dots me-2"></i>智能文档问答
            </div>
            <div v-if="useMemory && sessionId" class="session-badge">
              <span class="badge bg-light text-dark">
                <i class="bi bi-clock-history me-1"></i>记忆对话中
              </span>
            </div>
          </div>
          <div class="card-body d-flex flex-column p-0">
            <div class="chat-container flex-grow-1 p-3" ref="chatContainer">
              <div v-if="chatHistory.length === 0" class="text-center text-muted py-5">
                <i class="bi bi-chat-dots fs-1 d-block mb-3"></i>
                <p>上传文档后，可以开始提问了！</p>
              </div>
              <div v-for="(message, index) in chatHistory" :key="index" class="chat-message" :class="message.role">
                <div class="message-content">
                  <div v-if="message.role === 'system'" v-html="formatSystemMessage(message.content)"></div>
                  <div v-else v-html="message.role === 'assistant' ? formatAssistantMessage(message.content) : message.content"></div>
                </div>
                <div v-if="message.usedGeneralModel" class="general-model-badge mt-1">
                  <span class="badge bg-secondary">通用模型回答</span>
                </div>
              </div>
            </div>
            
            <div class="p-3 border-top">
              <div class="input-group">
                <input type="text" class="form-control" placeholder="请输入您的问题..." v-model="userQuery" @keyup.enter="sendQuery" :disabled="!vectorStorePath || isQueryProcessing">
                <button class="btn btn-primary" @click="sendQuery" :disabled="!vectorStorePath || isQueryProcessing || !userQuery.trim()">
                  <span v-if="isQueryProcessing" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  {{ isQueryProcessing ? '处理中...' : '发送' }}
                </button>
              </div>
              <div v-if="!vectorStorePath" class="form-text text-center mt-2">
                请先上传并处理文档后再提问
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { nextTick, onMounted, ref, watch } from 'vue';

// 配置axios基础URL
axios.defaults.baseURL = 'http://localhost:3001';

// 状态变量
const selectedFiles = ref([]);
const processingStatus = ref(null);
const isProcessing = ref(false);
const vectorStorePath = ref('');
const chatHistory = ref([]);
const userQuery = ref('');
const isQueryProcessing = ref(false);
const chatContainer = ref(null);
const documentsProcessed = ref(0);
const chunksGenerated = ref(0);
const totalVectors = ref(0);
const appendToExisting = ref(false);
const similarityThreshold = ref(0.6);
const useGeneralModelFallback = ref(true);
const sessionId = ref('');
const useMemory = ref(true);

// 初始化会话ID
onMounted(() => {
  // 从localStorage获取会话ID，或创建新的
  const savedSessionId = localStorage.getItem('chatSessionId');
  if (savedSessionId) {
    sessionId.value = savedSessionId;
    console.log(`恢复会话ID: ${sessionId.value}`);
  } else {
    // 创建新的会话ID
    resetSession();
  }
  
  // 从localStorage恢复聊天历史
  const savedChatHistory = localStorage.getItem('chatHistory');
  if (savedChatHistory) {
    try {
      chatHistory.value = JSON.parse(savedChatHistory);
      console.log(`恢复聊天历史: ${chatHistory.value.length} 条消息`);
    } catch (e) {
      console.error('恢复聊天历史失败:', e);
    }
  }
  
  // 从localStorage恢复向量存储路径
  const savedVectorStorePath = localStorage.getItem('vectorStorePath');
  if (savedVectorStorePath) {
    vectorStorePath.value = savedVectorStorePath;
    console.log(`恢复向量存储路径: ${vectorStorePath.value}`);
  }
});

// 监听聊天历史变化，保存到localStorage
watch(chatHistory, (newHistory) => {
  localStorage.setItem('chatHistory', JSON.stringify(newHistory));
}, { deep: true });

// 监听向量存储路径变化，保存到localStorage
watch(vectorStorePath, (newPath) => {
  if (newPath) {
    localStorage.setItem('vectorStorePath', newPath);
  }
});

// 重置会话
const resetSession = () => {
  sessionId.value = uuidv4();
  localStorage.setItem('chatSessionId', sessionId.value);
  console.log(`创建新会话ID: ${sessionId.value}`);
  
  // 可选：清除历史记录
  // chatHistory.value = [];
};

// 处理文件选择
const onFileSelected = (event) => {
  selectedFiles.value = Array.from(event.target.files);
};

// 上传并处理文件
const uploadFiles = async () => {
  if (!selectedFiles.value.length) return;
  
  isProcessing.value = true;
  processingStatus.value = {
    type: 'alert-info',
    message: '正在上传和处理文件...'
  };
  
  try {
    // 第一步：上传文件并提取文本
    const formData = new FormData();
    
    // 创建文件名映射数组
    const fileDetails = [];
    
    // 添加所有选中的文件到formData，同时记录原始文件名
    for (let i = 0; i < selectedFiles.value.length; i++) {
      const file = selectedFiles.value[i];
      // 使用自定义文件名避免编码问题 - 仅使用时间戳和索引
      const safeFilename = `file_${Date.now()}_${i}${file.name.substring(file.name.lastIndexOf('.'))}`;
      console.log(`添加文件: ${file.name} (${file.size} 字节), 安全文件名: ${safeFilename}`);
      
      // 将文件添加到formData，使用安全文件名
      formData.append('files', file, safeFilename);
      
      // 记录文件详情
      fileDetails.push({
        safeFilename: safeFilename,
        originalFilename: file.name,
        size: file.size,
        type: file.type
      });
    }
    
    // 添加文件名映射信息到formData
    formData.append('fileDetails', JSON.stringify(fileDetails));
    
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
    
    // 使用后端返回的提取文本
    const extractedTexts = textExtractResponse.data.extractedTexts;
    
    // 第二步：向量化处理提取的文本
    processingStatus.value = {
      type: 'alert-info',
      message: '正在进行向量化处理，请稍候...'
    };
    
    const vectorizeRequest = {
      extractedTexts: extractedTexts,
      appendToExisting: appendToExisting.value,
      // 只有在追加模式下，且有现有向量路径时才传递
      ...(appendToExisting.value && vectorStorePath.value ? { vectorStorePath: vectorStorePath.value } : {})
    };
    
    const vectorizeResponse = await axios.post('/api/vectorize', vectorizeRequest, {
      timeout: 120000
    });
    
    if (!vectorizeResponse.data.success) {
      throw new Error(vectorizeResponse.data.message || '向量化处理失败');
    }
    
    // 保存向量存储路径
    vectorStorePath.value = vectorizeResponse.data.vectorStorePath;
    documentsProcessed.value += vectorizeResponse.data.documentsProcessed;
    chunksGenerated.value += vectorizeResponse.data.chunksGenerated;
    totalVectors.value = vectorizeResponse.data.totalVectors || chunksGenerated.value;
    
    // 构建成功消息
    let successMessage;
    if (vectorizeResponse.data.appendedToExisting) {
      successMessage = `成功添加 ${vectorizeResponse.data.documentsProcessed} 个文档到现有向量库，共有 ${totalVectors.value} 个向量`;
    } else {
      successMessage = `成功处理了 ${documentsProcessed.value} 个文档，生成 ${chunksGenerated.value} 个文本块`;
    }
    
    processingStatus.value = {
      type: 'alert-success',
      message: successMessage
    };
    
    // 清空选择的文件
    selectedFiles.value = [];
    document.getElementById('fileUpload').value = '';
    
    // 添加系统消息到聊天历史
    chatHistory.value.push({
      role: 'system',
      content: `${successMessage}，您可以开始提问了！`
    });
    
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
    
    processingStatus.value = {
      type: 'alert-danger',
      message: errorMessage
    };
  } finally {
    isProcessing.value = false;
  }
};

// 发送查询
const sendQuery = async () => {
  if (!userQuery.value.trim() || !vectorStorePath.value) return;
  
  chatHistory.value.push({
    role: 'user',
    content: userQuery.value
  });
  
  const query = userQuery.value;
  userQuery.value = '';
  isQueryProcessing.value = true;
  
  // 滚动到底部
  await nextTick();
  scrollToBottom();
  
  try {
    // 限制查询文本长度，避免超出API限制
    const truncatedQuery = query.substring(0, 1000);
    if (truncatedQuery.length < query.length) {
      console.log(`查询文本已被截断，原长度: ${query.length} -> ${truncatedQuery.length}`);
    }
    
    console.log('发送查询请求...');
    const requestData = {
      query: truncatedQuery,
      vectorStorePath: vectorStorePath.value,
      similarityThreshold: parseFloat(similarityThreshold.value),
      useGeneralModelFallback: useGeneralModelFallback.value
    };
    
    // 如果启用了记忆功能，添加会话ID
    if (useMemory.value) {
      requestData.sessionId = sessionId.value;
      console.log(`使用会话记忆功能，会话ID: ${sessionId.value}`);
    }
    
    const response = await axios.post('/api/query', requestData, {
      timeout: 90000 // 增加到90秒超时时间
    });
    
    console.log('收到查询响应:', response.data);
    
    // 添加消息到聊天历史
    if (response.data.success) {
      // 主要回答
      chatHistory.value.push({
        role: 'assistant',
        content: response.data.answer || '未找到相关答案',
        usedGeneralModel: response.data.usedGeneralModel
      });
      
      // 如果有源文档信息且不是使用通用模型，才显示参考信息
      if (response.data.sources && response.data.sources.length > 0 && !response.data.usedGeneralModel) {
        // 直接使用后端返回的源文件名
        const sources = response.data.sources;
        
        const sourceInfo = "参考信息来源：\n" + 
          sources.map(src => `- ${src.source} (相似度: ${src.similarity})`).join('\n');
        
        chatHistory.value.push({
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
    
    chatHistory.value.push({
      role: 'system',
      content: errorMessage
    });
  } finally {
    isQueryProcessing.value = false;
    
    // 滚动到底部
    await nextTick();
    scrollToBottom();
  }
};

// 滚动聊天窗口到底部
const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// 格式化系统消息（支持简单的换行符）
const formatSystemMessage = (text) => {
  return text.replace(/\n/g, '<br>').replace(/- ([^:]+): /g, '<strong>- $1:</strong> ');
};

// 格式化助手消息（支持简单的加粗和强调）
const formatAssistantMessage = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 处理 **加粗**
    .replace(/\*(.*?)\*/g, '<em>$1</em>'); // 处理 *斜体*
};

// 清除所有聊天历史
const clearChatHistory = () => {
  chatHistory.value = [];
  resetSession();
};
</script>

<style>
/* 引入Bootstrap图标 */
@import url("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css");

.chat-container {
  overflow-y: auto;
  height: 400px;
}

.chat-message {
  margin-bottom: 15px;
  padding: 10px 15px;
  border-radius: 10px;
  max-width: 85%;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  position: relative;
  overflow-wrap: break-word;
}

.chat-message.user {
  background-color: #e7f3ff;
  margin-left: auto;
  border-bottom-right-radius: 0;
}

.chat-message.assistant {
  background-color: #f0f2f5;
  margin-right: auto;
  border-bottom-left-radius: 0;
}

.chat-message.system {
  background-color: #fff3cd;
  color: #856404;
  margin-left: auto;
  margin-right: auto;
  max-width: 90%;
  font-size: 0.9rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card {
  border: none;
  border-radius: 10px;
  overflow: hidden;
}

.card-header {
  font-weight: 600;
}

input.form-control:focus, button.btn:focus {
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

.general-model-badge, .session-badge {
  text-align: right;
  font-size: 0.8rem;
}

.session-badge .badge {
  font-weight: normal;
}
</style> 