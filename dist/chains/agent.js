"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentExecutor = createAgentExecutor;
exports.runAgent = runAgent;
const agents_1 = require("langchain/agents");
const llm_1 = require("../models/llm");
/**
 * 创建代理执行器
 * @param tools 工具列表
 * @param llm 语言模型实例，默认为GPT-3.5
 * @returns 代理执行器
 */
async function createAgentExecutor(tools, llm) {
    // 如果未提供llm实例，则创建一个默认的GPT-3.5实例
    const model = llm || llm_1.LLMFactory.createGPT3_5();
    
    // 包装工具以增强错误处理
    const wrappedTools = tools.map(tool => {
        const originalFunc = tool.func;
        const originalSchema = tool.schema;
        
        // 覆盖原始func以添加错误处理
        tool.func = async (input) => {
            try {
                // 对工具输入进行验证和防御性编程
                console.log(`执行工具 ${tool.name}，输入:`, input);
                
                // 处理各种类型的输入格式
                let processedInput = input;
                
                // 如果是字符串，尝试解析为JSON
                if (typeof input === 'string') {
                    try {
                        // 移除可能的额外字符
                        const cleanInput = input.trim().replace(/^```json|```$/g, '');
                        processedInput = JSON.parse(cleanInput);
                        console.log(`将字符串输入解析为JSON:`, processedInput);
                    } catch(e) {
                        console.warn(`无法解析输入为JSON: ${e.message}`, input);
                        // 对于单字段的工具，尝试构建一个符合schema的简单对象
                        if (originalSchema) {
                            const schemaProps = Object.keys(originalSchema.shape || {});
                            if (schemaProps.length === 1) {
                                const key = schemaProps[0];
                                processedInput = { [key]: input };
                                console.log(`为简单工具创建对象: ${key}=${input}`);
                            }
                        }
                    }
                }
                
                // 验证是否是所需的对象类型
                if (typeof processedInput !== 'object' || processedInput === null) {
                    console.warn(`工具输入不是有效的对象: ${typeof processedInput}`, processedInput);
                    throw new Error(`工具 ${tool.name} 需要一个包含有效参数的对象输入`);
                }
                
                return await originalFunc(processedInput);
            } catch (error) {
                console.error(`工具 ${tool.name} 执行失败:`, error);
                return `工具 ${tool.name} 执行失败: ${error.message || '未知错误'}。请确保提供正确的输入格式。示例: {"参数名": "参数值"} 或简单问题。`;
            }
        };
        return tool;
    });
    
    // 创建代理执行器
    const executor = await (0, agents_1.initializeAgentExecutorWithOptions)(wrappedTools, model, {
        agentType: 'chat-conversational-react-description',
        verbose: true,
        maxIterations: 5,
        handleParsingErrors: true, // 启用解析错误处理
    });
    
    return executor;
}
/**
 * 运行代理执行器
 * @param executor 代理执行器
 * @param input 用户输入
 * @returns 模型响应
 */
async function runAgent(executor, input) {
    try {
        // 验证输入参数
        if (!input || typeof input !== 'string' || input.trim().length < 2) {
            console.warn('代理输入过短或无效:', input);
            return '请提供更详细的问题或指令，以便我能更好地帮助您。至少需要2个字符。';
        }
        
        // 设置超时处理
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('代理请求超时')), 45000);
        });
        
        try {
            // 使用Promise.race以处理超时
            const response = await Promise.race([
                executor.invoke({ 
                    input,
                    // 添加自定义错误处理
                    onToolError: (tool, error) => {
                        console.error(`工具 ${tool.name} 执行错误:`, error);
                        return `我无法使用${tool.name}工具，请以不同方式描述您的请求: ${error.message}`;
                    },
                }),
                timeoutPromise
            ]);
            
            // 检查响应是否有效
            if (!response || !response.output) {
                console.warn('代理返回了空响应');
                return '抱歉，处理您的请求时出现问题。请尝试重新表述您的问题或指令。';
            }
            
            return response.output;
        } catch (invokeError) {
            // 特别处理工具输入错误
            if (invokeError.message && (
                invokeError.message.includes('tool input') || 
                invokeError.message.includes('schema') || 
                invokeError.message.includes('invalid')
            )) {
                console.error('工具输入错误:', invokeError);
                return `抱歉，我在尝试解决您的问题时遇到了技术困难。请尝试重新表述您的问题，或者提供更具体的指令。错误: ${invokeError.message}`;
            }
            throw invokeError; // 重新抛出其他错误供外层捕获
        }
    }
    catch (error) {
        console.error('代理执行器执行失败:', error);
        
        // 对错误进行分类和处理
        if (error.message && error.message.includes('timeout')) {
            return '处理您的请求超时。请尝试简化您的问题或稍后再试。';
        } 
        else if (error.message && error.message.includes('API')) {
            return '与AI服务通信时出现问题。请稍后再试。';
        }
        else if (error.message && error.message.includes('tool')) {
            return `使用工具时遇到问题: ${error.message}。请尝试用不同方式描述您的需求。`;
        }
        else {
            // 返回友好的错误信息而不是抛出异常
            return `处理您的请求时出现问题: ${error.message || '未知错误'}。请尝试不同的问题或指令。`;
        }
    }
}
