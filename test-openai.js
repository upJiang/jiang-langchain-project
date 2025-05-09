const { ChatOpenAI } = require('@langchain/openai');
require('dotenv').config();

async function testOpenAI() {
  try {
    // 从.env文件读取密钥
    const apiKey = 'sk-SkcQl4ZMGeagsTmrwKL3xcDst8IpEfCOT5RoO22rDTYU2u7D';
    const baseURL = 'https://api.chatanywhere.tech';
    
    console.log('OpenAI API Key:', apiKey ? '已设置' : '未设置');
    console.log('OpenAI Base URL:', baseURL);
    
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo-1106',
      temperature: 0.7,
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseURL,
      },
    });
    
    console.log('尝试调用OpenAI API...');
    const response = await model.invoke('你好，请用一句话回答。');
    
    console.log('API调用成功！');
    console.log('回复:', response.content);
  } catch (error) {
    console.error('API调用失败:', error);
  }
}

testOpenAI(); 