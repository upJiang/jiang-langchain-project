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

    // ================ 基本对话链相关 ================
    const chatMessages = ref([
      { role: 'system', content: '欢迎使用基本对话链！您可以开始与AI助手对话了。' }
    ]);
    const chatInput = ref('');
    const chatLoading = ref(false);
    const chatMessages_ref = ref(null);

    // 发送聊天消息
    const sendChatMessage = async () => {
      if (!chatInput.value.trim()) return;
      
      // 添加用户消息
      chatMessages.value.push({ role: 'user', content: chatInput.value });
      
      // 清空输入
      const message = chatInput.value;
      chatInput.value = '';
      
      // 显示加载状态
      chatLoading.value = true;
      
      try {
        // 调用实际API
        const response = await axios.post(`${API_BASE_URL}/conversation`, { input: message });
        
        // 添加助手回复
        chatMessages.value.push({ role: 'assistant', content: response.data.response });
      } catch (error) {
        console.error('对话请求失败:', error);
        ElMessage.error('对话请求失败，请稍后重试');
        
        // 添加错误消息
        chatMessages.value.push({ role: 'system', content: '对话请求失败，请稍后重试。' });
      } finally {
        chatLoading.value = false;
        
        // 滚动到底部
        await nextTick();
        if (chatMessages_ref.value) {
          chatMessages_ref.value.scrollTop = chatMessages_ref.value.scrollHeight;
        }
      }
    };

    // ================ 代理与工具相关 ================
    const agentMessages = ref([
      { role: 'system', content: '欢迎使用代理与工具！我可以帮您查询天气、数据库等信息。' }
    ]);
    const agentInput = ref('');
    const agentLoading = ref(false);
    const agentMessages_ref = ref(null);

    // 发送代理消息
    const sendAgentMessage = async () => {
      if (!agentInput.value.trim()) return;
      
      // 添加用户消息
      agentMessages.value.push({ role: 'user', content: agentInput.value });
      
      // 清空输入
      const message = agentInput.value;
      agentInput.value = '';
      
      // 显示加载状态
      agentLoading.value = true;
      
      try {
        // 调用实际API
        const response = await axios.post(`${API_BASE_URL}/agent`, { input: message });
        
        // 添加助手回复
        agentMessages.value.push({ role: 'assistant', content: response.data.response });
      } catch (error) {
        console.error('代理请求失败:', error);
        ElMessage.error('代理请求失败，请稍后重试');
        
        // 添加错误消息
        agentMessages.value.push({ role: 'system', content: '代理请求失败，请稍后重试。' });
      } finally {
        agentLoading.value = false;
        
        // 滚动到底部
        await nextTick();
        if (agentMessages_ref.value) {
          agentMessages_ref.value.scrollTop = agentMessages_ref.value.scrollHeight;
        }
      }
    };

    // ================ RAG检索相关 ================
    const ragMessages = ref([
      { role: 'system', content: '欢迎使用RAG检索！您可以询问关于LangChain的问题。' }
    ]);
    const ragInput = ref('');
    const ragLoading = ref(false);
    const ragMessages_ref = ref(null);

    // 发送RAG查询
    const sendRagQuery = async () => {
      if (!ragInput.value.trim()) return;
      
      // 添加用户消息
      ragMessages.value.push({ role: 'user', content: ragInput.value });
      
      // 清空输入
      const query = ragInput.value;
      ragInput.value = '';
      
      // 显示加载状态
      ragLoading.value = true;
      
      try {
        // 调用实际API
        const response = await axios.post(`${API_BASE_URL}/rag`, { query });
        
        // 添加助手回复
        ragMessages.value.push({ role: 'assistant', content: response.data.answer });
      } catch (error) {
        console.error('RAG查询失败:', error);
        ElMessage.error('RAG查询失败，请稍后重试');
        
        // 添加错误消息
        ragMessages.value.push({ role: 'system', content: 'RAG查询失败，请稍后重试。' });
      } finally {
        ragLoading.value = false;
        
        // 滚动到底部
        await nextTick();
        if (ragMessages_ref.value) {
          ragMessages_ref.value.scrollTop = ragMessages_ref.value.scrollHeight;
        }
      }
    };

    // ================ 数据库集成相关 ================
    const dbMessages = ref([
      { role: 'system', content: '欢迎使用数据库集成！您可以询问关于数据库表和数据的问题。' }
    ]);
    const dbInput = ref('');
    const dbLoading = ref(false);
    const dbMessages_ref = ref(null);

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
      
      // 添加用户消息
      dbMessages.value.push({ role: 'user', content: dbInput.value });
      
      // 清空输入
      const query = dbInput.value;
      dbInput.value = '';
      
      // 显示加载状态
      dbLoading.value = true;
      
      try {
        // 调用实际API
        const response = await axios.post(`${API_BASE_URL}/database`, { query });
        
        // 添加助手回复
        dbMessages.value.push({ role: 'assistant', content: response.data.result });
      } catch (error) {
        console.error('数据库查询失败:', error);
        ElMessage.error('数据库查询失败，请稍后重试');
        
        // 添加错误消息
        dbMessages.value.push({ role: 'system', content: '数据库查询失败，请稍后重试。' });
      } finally {
        dbLoading.value = false;
        
        // 滚动到底部
        await nextTick();
        if (dbMessages_ref.value) {
          dbMessages_ref.value.scrollTop = dbMessages_ref.value.scrollHeight;
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
        
        schedulesList.value.push(newSchedule);
        
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
        
        // 移除列表中的项目
        schedulesList.value = schedulesList.value.filter(item => item.id !== id);
        
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
      // 添加初始的系统欢迎消息
      ElMessage({
        message: '欢迎使用LangChain.js演示项目',
        type: 'success',
        duration: 3000
      });
      
      // 模拟添加一些预设的天气推送
      schedulesList.value = [
        { id: 1, city: '北京', time: '08:00', frequency: 'daily' },
        { id: 2, city: '上海', time: '09:00', frequency: 'weekday' }
      ];
    });

    // 返回状态和方法
    return {
      activeIndex,
      // 对话链
      chatMessages,
      chatInput,
      chatLoading,
      chatMessages_ref,
      sendChatMessage,
      // 代理工具
      agentMessages,
      agentInput,
      agentLoading,
      agentMessages_ref,
      sendAgentMessage,
      // RAG
      ragMessages,
      ragInput,
      ragLoading,
      ragMessages_ref,
      sendRagQuery,
      // 数据库
      dbMessages,
      dbInput,
      dbLoading,
      dbMessages_ref,
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