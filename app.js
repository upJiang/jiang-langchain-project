// app.js - 前端Vue应用与LangChain.js后端集成
const { createApp, ref, computed } = Vue;

const app = createApp({
    setup() {
        const userInput = ref('');
        const messages = ref([
            {
                content: '你好！我是基于LangChain.js和Deno构建的AI助手。我可以通过两种方式回答问题：聊天模式和LangChain链模式。有什么我可以帮到你的吗？',
                isUser: false
            }
        ]);
        const loading = ref(false);
        const errorMessage = ref('');
        const useChain = ref(false); // 是否使用LangChain链模式 (true) 或聊天模式 (false)
        
        // 显示错误消息
        const showError = (message) => {
            errorMessage.value = message;
            setTimeout(() => {
                errorMessage.value = '';
            }, 5000);
        };

        // 处理API错误
        const handleApiError = (error) => {
            console.error('API错误:', error);
            
            // 检查是否是配额不足错误
            if (error.message && error.message.includes('配额已用尽')) {
                showError('OpenAI API配额已用尽，请检查API密钥或账户计费信息');
                messages.value.push({
                    content: '抱歉，OpenAI API配额已用尽，无法继续处理请求。请联系管理员更新API密钥或检查账户计费信息。',
                    isUser: false
                });
                return;
            }
            
            // 其他错误
            showError(`调用LangChain API失败: ${error.message}`);
            messages.value.push({
                content: `抱歉，发生了错误: ${error.message}`,
                isUser: false
            });
        };

        // API模式说明
        const apiModeDescription = computed(() => {
            return useChain.value 
                ? 'LangChain链模式: 使用LangChain的链处理单个问题' 
                : '聊天模式: 使用LangChain的ChatModel处理对话';
        });
        
        // 切换API模式
        const toggleApiMode = () => {
            useChain.value = !useChain.value;
        };

        // 发送消息到AI
        const sendMessage = async () => {
            if (!userInput.value.trim()) return;

            // 添加用户消息到列表
            messages.value.push({
                content: userInput.value,
                isUser: true
            });

            loading.value = true;
            
            try {
                let response, data;
                
                if (useChain.value) {
                    // 使用LangChain链模式 - 单个查询模式
                    response = await fetch('/api/query', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            query: userInput.value
                        })
                    });
                    
                    const responseText = await response.text();
                    console.log('LangChain链API响应:', responseText);
                    
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        console.error('JSON解析错误:', e);
                        showError(`JSON解析错误: ${e.message}, 原始响应: ${responseText.substring(0, 100)}`);
                        throw new Error('响应格式错误');
                    }
                    
                    if (!response.ok) {
                        throw new Error(data.error || `服务器返回状态码 ${response.status}`);
                    }
                    
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    // 添加AI回复到消息列表
                    if (data.result && data.result.text) {
                        messages.value.push({
                            content: data.result.text,
                            isUser: false
                        });
                    } else {
                        throw new Error('响应中缺少预期的数据结构');
                    }
                } else {
                    // 使用ChatModel模式 - 对话模式
                    const langchainMessages = messages.value.map(msg => ({
                        role: msg.isUser ? 'user' : 'assistant',
                        content: msg.content
                    }));
                    
                    // 添加系统消息
                    langchainMessages.unshift({
                        role: 'system',
                        content: '你是一个乐于助人的AI助手，基于LangChain.js和Deno构建。'
                    });
                    
                    console.log('发送到聊天API的消息:', JSON.stringify(langchainMessages));
                    
                    response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            messages: langchainMessages
                        })
                    });
                    
                    const responseText = await response.text();
                    console.log('LangChain聊天API响应:', responseText);
                    
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        console.error('JSON解析错误:', e);
                        showError(`JSON解析错误: ${e.message}, 原始响应: ${responseText.substring(0, 100)}`);
                        throw new Error('响应格式错误');
                    }
                    
                    if (!response.ok) {
                        throw new Error(data.error || `服务器返回状态码 ${response.status}`);
                    }
                    
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    // 添加AI回复到消息列表
                    if (data.response && data.response.content) {
                        messages.value.push({
                            content: data.response.content,
                            isUser: false
                        });
                    } else {
                        throw new Error('响应中缺少预期的数据结构');
                    }
                }
            } catch (error) {
                handleApiError(error);
            } finally {
                loading.value = false;
                userInput.value = ''; // 清空输入框
            }
        };

        return {
            userInput,
            messages,
            loading,
            errorMessage,
            useChain,
            apiModeDescription,
            toggleApiMode,
            sendMessage
        };
    }
});

// 挂载应用
app.mount('#app'); 