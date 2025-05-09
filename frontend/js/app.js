// 创建Vue应用
const { createApp, ref, reactive, onMounted, nextTick } = Vue;
const ElementPlus = window.ElementPlus;
const { ElMessage, ElMessageBox } = ElementPlus;

// API基础URL - 确保与后端服务器地址一致
const API_BASE_URL = 'http://localhost:3000/api';

// 创建应用
const app = createApp({
  setup() {
    // 菜单状态
    const activeIndex = ref('1');
    
    // ================ 消息处理辅助函数 ================
    // 安全地添加消息到对话
    const addMessageToChat = (message) => {
      console.log('添加消息到对话:', message);
      if (!Array.isArray(chatMessages.value)) {
        console.log('chatMessages不是数组，初始化为空数组');
        chatMessages.value = [];
      }
      chatMessages.value = chatMessages.value.concat([message]);
      console.log('当前对话消息:', chatMessages.value);
    };
    
    // 安全地添加消息到代理
    const addMessageToAgent = (message) => {
      if (!Array.isArray(agentMessages.value)) {
        agentMessages.value = [];
      }
      agentMessages.value = agentMessages.value.concat([message]);
    };
    
    // 安全地添加消息到RAG
    const addMessageToRAG = (message) => {
      if (!Array.isArray(ragMessages.value)) {
        ragMessages.value = [];
      }
      ragMessages.value = ragMessages.value.concat([message]);
    };
    
    // 安全地添加消息到数据库查询
    const addMessageToDB = (message) => {
      if (!Array.isArray(dbMessages.value)) {
        dbMessages.value = [];
      }
      dbMessages.value = dbMessages.value.concat([message]);
    };
    
    // 安全地添加天气任务到列表
    const addScheduleToList = (schedule) => {
      if (!Array.isArray(schedulesList.value)) {
        schedulesList.value = [];
      }
      schedulesList.value = schedulesList.value.concat([schedule]);
    };

    // ================ 基本对话链相关 ================
    const chatMessages = ref([
      { role: 'system', content: '欢迎使用基本对话链！您可以开始与AI助手对话了。' }
    ]);
    const chatInput = ref('');
    const chatLoading = ref(false);
    const chatMessagesContainer = ref(null);

    // 发送聊天消息
    const sendChatMessage = async () => {
      if (!chatInput.value.trim()) return;
      
      console.log('开始发送聊天消息', chatInput.value);
      
      // 安全添加消息到聊天
      addMessageToChat({ role: 'user', content: chatInput.value });
      
      // 清空输入
      const message = chatInput.value;
      chatInput.value = '';
      
      // 显示加载状态
      chatLoading.value = true;
      
      try {
        // 调用实际API
        console.log('调用API:', `${API_BASE_URL}/conversation`);
        const response = await axios.post(`${API_BASE_URL}/conversation`, { input: message });
        console.log('API响应:', response.data);
        
        // 添加助手回复
        addMessageToChat({ role: 'assistant', content: response.data.response });
      } catch (error) {
        console.error('对话请求失败:', error);
        
        // 获取具体错误信息
        let errorMessage = '对话请求失败，请稍后重试';
        if (error.response) {
          // 服务器返回了错误状态码
          console.log('服务器错误:', error.response.data);
          if (error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
          } else {
            errorMessage = `服务器错误 (${error.response.status})`;
          }
        } else if (error.request) {
          // 请求已发送但没有收到响应
          errorMessage = '服务器无响应，请检查网络连接';
        } else {
          // 请求配置出现问题
          errorMessage = error.message;
        }
        
        ElMessage.error(errorMessage);
        
        // 添加错误消息
        addMessageToChat({ role: 'system', content: errorMessage });
      } finally {
        chatLoading.value = false;
        
        // 滚动到底部
        await nextTick();
        if (chatMessagesContainer.value) {
          chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight;
        }
      }
    };

    // ================ 代理与工具相关 ================
    const agentMessages = ref([
      { role: 'system', content: '欢迎使用代理与工具！我可以帮您查询天气、数据库等信息。' }
    ]);
    const agentInput = ref('');
    const agentLoading = ref(false);
    const agentMessagesContainer = ref(null);

    // 发送代理消息
    const sendAgentMessage = async () => {
      if (!agentInput.value.trim()) return;
      
      console.log('开始发送代理消息:', agentInput.value);
      
      // 安全添加用户消息到代理
      addMessageToAgent({ role: 'user', content: agentInput.value });
      
      // 清空输入
      const message = agentInput.value;
      agentInput.value = '';
      
      // 显示加载状态
      agentLoading.value = true;
      
      try {
        // 调用实际API
        console.log('调用代理API');
        const response = await axios.post(`${API_BASE_URL}/agent`, { input: message });
        console.log('代理API响应:', response.data);
        
        // 添加助手回复
        addMessageToAgent({ role: 'assistant', content: response.data.response });
      } catch (error) {
        console.error('代理请求失败:', error);
        
        // 获取具体错误信息
        let errorMessage = '代理请求失败，请稍后重试';
        
        // 处理服务器返回的错误信息
        if (error.response) {
          console.log('代理服务器错误:', error.response.data);
          
          // 如果服务器返回了具体的响应内容，使用它
          if (error.response.data && error.response.data.response) {
            errorMessage = error.response.data.response;
            // 直接添加服务器返回的响应作为助手消息
            addMessageToAgent({ role: 'assistant', content: errorMessage });
            
            // 因为我们已经添加了响应，所以不需要再添加系统错误消息
            agentLoading.value = false;
            
            // 滚动到底部
            await nextTick();
            if (agentMessagesContainer.value) {
              agentMessagesContainer.value.scrollTop = agentMessagesContainer.value.scrollHeight;
            }
            return;
          } 
          
          // 否则使用错误详情
          if (error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
            if (error.response.data.message) {
              errorMessage += `: ${error.response.data.message}`;
            }
          } else {
            errorMessage = `服务器错误 (${error.response.status})`;
          }
        } else if (error.request) {
          // 请求已发送但没有收到响应
          errorMessage = '服务器无响应，请检查网络连接';
        } else {
          // 请求配置出现问题
          errorMessage = error.message;
        }
        
        ElMessage.error(errorMessage);
        
        // 添加错误消息
        addMessageToAgent({ role: 'system', content: errorMessage });
      } finally {
        agentLoading.value = false;
        
        // 滚动到底部
        await nextTick();
        if (agentMessagesContainer.value) {
          agentMessagesContainer.value.scrollTop = agentMessagesContainer.value.scrollHeight;
        }
      }
    };

    // ================ RAG检索相关 ================
    const ragMessages = ref([
      { role: 'system', content: '欢迎使用RAG检索！您可以询问关于LangChain的问题。' }
    ]);
    const ragInput = ref('');
    const ragLoading = ref(false);
    const ragMessagesContainer = ref(null);

    // 发送RAG查询
    const sendRagQuery = async () => {
      if (!ragInput.value.trim()) return;
      
      // 安全添加用户消息到RAG
      addMessageToRAG({ role: 'user', content: ragInput.value });
      
      // 清空输入
      const query = ragInput.value;
      ragInput.value = '';
      
      // 显示加载状态
      ragLoading.value = true;
      
      try {
        // 调用实际API
        const response = await axios.post(`${API_BASE_URL}/rag`, { query });
        
        // 添加助手回复
        addMessageToRAG({ role: 'assistant', content: response.data.answer });
      } catch (error) {
        console.error('RAG查询失败:', error);
        
        // 获取具体错误信息
        let errorMessage = 'RAG查询失败，请稍后重试';
        if (error.response) {
          // 服务器返回了错误状态码
          if (error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
          } else {
            errorMessage = `服务器错误 (${error.response.status})`;
          }
        } else if (error.request) {
          // 请求已发送但没有收到响应
          errorMessage = '服务器无响应，请检查网络连接';
        } else {
          // 请求配置出现问题
          errorMessage = error.message;
        }
        
        ElMessage.error(errorMessage);
        
        // 添加错误消息
        addMessageToRAG({ role: 'system', content: errorMessage });
      } finally {
        ragLoading.value = false;
        
        // 滚动到底部
        await nextTick();
        if (ragMessagesContainer.value) {
          ragMessagesContainer.value.scrollTop = ragMessagesContainer.value.scrollHeight;
        }
      }
    };

    // ================ 数据库集成相关 ================
    const dbMessages = ref([
      { role: 'system', content: '欢迎使用数据库集成！您可以询问关于数据库表和数据的问题。' }
    ]);
    const dbInput = ref('');
    const dbLoading = ref(false);
    const dbMessagesContainer = ref(null);

    // 示例查询
    const exampleQueries = [
      '数据库中有哪些表？',
      'users表的结构是什么样的？',
      '获取所有用户的信息',
      '获取所有天气记录',
      '查找温度高于28度的城市'
    ];

    // 使用示例查询
    const useExampleQuery = (index) => {
      dbInput.value = exampleQueries[index - 1];
    };

    // 发送数据库查询
    const sendDbQuery = async () => {
      if (!dbInput.value.trim()) return;
      
      // 安全添加用户消息到数据库查询
      addMessageToDB({ role: 'user', content: dbInput.value });
      
      // 清空输入
      const query = dbInput.value;
      dbInput.value = '';
      
      // 显示加载状态
      dbLoading.value = true;
      
      try {
        // 调用实际API
        const response = await axios.post(`${API_BASE_URL}/database`, { query });
        
        // 添加助手回复
        addMessageToDB({ role: 'assistant', content: response.data.result });
      } catch (error) {
        console.error('数据库查询失败:', error);
        
        // 获取具体错误信息
        let errorMessage = '数据库查询失败，请稍后重试';
        if (error.response) {
          // 服务器返回了错误状态码
          if (error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
          } else {
            errorMessage = `服务器错误 (${error.response.status})`;
          }
        } else if (error.request) {
          // 请求已发送但没有收到响应
          errorMessage = '服务器无响应，请检查网络连接';
        } else {
          // 请求配置出现问题
          errorMessage = error.message;
        }
        
        ElMessage.error(errorMessage);
        
        // 添加错误消息
        addMessageToDB({ role: 'system', content: errorMessage });
      } finally {
        dbLoading.value = false;
        
        // 滚动到底部
        await nextTick();
        if (dbMessagesContainer.value) {
          dbMessagesContainer.value.scrollTop = dbMessagesContainer.value.scrollHeight;
        }
      }
    };

    // ================ 天气预报相关 ================
    const weatherTab = ref('query');
    const weatherCity = ref('');
    const weatherLoading = ref(false);
    const weatherReport = ref(null);

    const scheduleCity = ref('');
    const scheduleTime = ref(null);
    const scheduleFrequency = ref('daily');
    const scheduleLoading = ref(false);
    const schedulesList = ref([]);

    // 获取天气报告
    const getWeatherReport = async () => {
      if (!weatherCity.value.trim()) {
        ElMessage.warning('请输入城市名称');
        return;
      }
      
      weatherLoading.value = true;
      
      try {
        // 调用实际API
        const response = await axios.get(`${API_BASE_URL}/weather`, { 
          params: { city: weatherCity.value }
        });
        
        // 将后端返回的数据格式化为前端需要的格式
        weatherReport.value = {
          city: weatherCity.value,
          temperature: response.data.temperature || 0,
          condition: response.data.condition || '未知',
          windDirection: response.data.windDirection || '未知',
          windScale: response.data.windScale || 0,
          humidity: response.data.humidity || 0
        };
        
        ElMessage.success(`成功获取${weatherCity.value}的天气信息`);
      } catch (error) {
        console.error('天气查询失败:', error);
        ElMessage.error('天气查询失败，请稍后重试');
        
        // 如果API调用失败，使用模拟数据
        weatherReport.value = {
          city: weatherCity.value,
          temperature: Math.floor(Math.random() * 15) + 15, // 15-30度
          condition: ['晴朗', '多云', '小雨', '阴天'][Math.floor(Math.random() * 4)],
          windDirection: ['东风', '南风', '西风', '北风'][Math.floor(Math.random() * 4)],
          windScale: Math.floor(Math.random() * 6) + 1, // 1-6级
          humidity: Math.floor(Math.random() * 40) + 40 // 40-80%
        };
        
        ElMessage.info('使用模拟数据进行演示');
      } finally {
        weatherLoading.value = false;
      }
    };

    // 安排天气报告定时推送
    const scheduleWeatherReport = async () => {
      if (!scheduleCity.value.trim()) {
        ElMessage.warning('请输入城市名称');
        return;
      }
      
      if (!scheduleTime.value) {
        ElMessage.warning('请选择推送时间');
        return;
      }
      
      scheduleLoading.value = true;
      
      try {
        // 格式化时间
        const time = new Date(scheduleTime.value);
        const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                                    
        // 调用实际API
        const response = await axios.post(`${API_BASE_URL}/weather/schedule`, {
          city: scheduleCity.value,
          time: timeString,
          frequency: scheduleFrequency.value
        });
        
        // 添加新的定时任务
        const newSchedule = {
          id: response.data.jobId || schedulesList.value.length + 1,
          city: scheduleCity.value,
          time: timeString,
          frequency: scheduleFrequency.value
        };
        
        // 安全添加天气任务到列表
        addScheduleToList(newSchedule);
        
        // 清空表单
        scheduleCity.value = '';
        scheduleTime.value = null;
        
        ElMessage.success('成功设置天气推送');
      } catch (error) {
        console.error('设置推送失败:', error);
        ElMessage.error('设置推送失败，请稍后重试');
      } finally {
        scheduleLoading.value = false;
      }
    };

    // 取消定时推送
    const cancelSchedule = async (id) => {
      try {
        // 调用实际API
        await axios.delete(`${API_BASE_URL}/weather/schedule/${id}`);
        
        // 移除列表中的项目（使用安全的数组操作）
        if (Array.isArray(schedulesList.value)) {
          schedulesList.value = schedulesList.value.filter(item => item.id !== id);
        }
        
        ElMessage.success('成功取消天气推送');
      } catch (error) {
        console.error('取消推送失败:', error);
        ElMessage.error('取消推送失败，请稍后重试');
      }
    };

    // 处理菜单选择
    const handleSelect = (key) => {
      activeIndex.value = key;
    };

    // 页面加载完成
    onMounted(() => {
      console.log('页面已加载');
      
      // 检查DOM引用
      console.log('chatMessagesContainer:', chatMessagesContainer.value);
      
      // 初始化所有消息列表，确保它们是数组
      if (!Array.isArray(chatMessages.value)) {
        console.log('初始化chatMessages数组');
        chatMessages.value = [{ role: 'system', content: '欢迎使用基本对话链！您可以开始与AI助手对话了。' }];
      }
      
      if (!Array.isArray(agentMessages.value)) {
        agentMessages.value = [{ role: 'system', content: '欢迎使用代理与工具！我可以帮您查询天气、数据库等信息。' }];
      }
      
      if (!Array.isArray(ragMessages.value)) {
        ragMessages.value = [{ role: 'system', content: '欢迎使用RAG检索！您可以询问关于LangChain的问题。' }];
      }
      
      if (!Array.isArray(dbMessages.value)) {
        dbMessages.value = [{ role: 'system', content: '欢迎使用数据库集成！您可以询问关于数据库表和数据的问题。' }];
      }
      
      if (!Array.isArray(schedulesList.value)) {
        schedulesList.value = [
          { id: 1, city: '北京', time: '08:00', frequency: 'daily' },
          { id: 2, city: '上海', time: '09:00', frequency: 'weekday' }
        ];
      }
      
      // 添加初始的系统欢迎消息
      ElMessage({
        message: '欢迎使用LangChain.js演示项目',
        type: 'success',
        duration: 3000
      });
      
      // 延迟检查DOM引用（等待渲染完成）
      setTimeout(() => {
        console.log('延迟检查chatMessagesContainer:', chatMessagesContainer.value);
      }, 500);
    });

    // 返回状态和方法
    return {
      activeIndex,
      // 对话链
      chatMessages,
      chatInput,
      chatLoading,
      chatMessagesContainer,
      sendChatMessage,
      // 代理工具
      agentMessages,
      agentInput,
      agentLoading,
      agentMessagesContainer,
      sendAgentMessage,
      // RAG
      ragMessages,
      ragInput,
      ragLoading,
      ragMessagesContainer,
      sendRagQuery,
      // 数据库
      dbMessages,
      dbInput,
      dbLoading,
      dbMessagesContainer,
      sendDbQuery,
      useExampleQuery,
      // 天气
      weatherTab,
      weatherCity,
      weatherLoading,
      weatherReport,
      getWeatherReport,
      scheduleCity,
      scheduleTime,
      scheduleFrequency,
      scheduleLoading,
      schedulesList,
      scheduleWeatherReport,
      cancelSchedule,
      // 菜单
      handleSelect
    };
  }
});

// 使用Element Plus
app.use(ElementPlus);

// 挂载应用
app.mount('#app');
