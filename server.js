// 导入必要的Deno模块
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { load } from "https://deno.land/std@0.192.0/dotenv/mod.ts";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// 加载环境变量
const env = await load();
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || env["OPENAI_API_KEY"];

// 检查API密钥
if (!OPENAI_API_KEY) {
  console.error("错误: 缺少OPENAI_API_KEY环境变量");
  Deno.exit(1);
}

// 创建LangChain模型
const model = new ChatOpenAI({
  openAIApiKey: OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0.7,
  configuration: {
    baseURL: "https://api.chatanywhere.tech",
  }
});

// 创建输出解析器
const outputParser = new StringOutputParser();

// 设置CORS头信息
function setCorsHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// 处理OPTIONS请求
function handleOptionsRequest() {
  const response = new Response(null, {
    status: 204
  });
  return setCorsHeaders(response);
}

// 处理API错误
function handleApiError(error) {
  console.error("API错误:", error);
  
  // 获取错误消息
  let errorMessage = error.message || "未知错误";
  let statusCode = 500; // 默认服务器错误状态码
  
  // 检查是否是配额不足错误
  if (
    errorMessage.includes("insufficient_quota") || 
    errorMessage.includes("billing") || 
    errorMessage.includes("exceeded your current quota")
  ) {
    errorMessage = "OpenAI API配额已用尽，请检查API密钥或账户计费信息";
    statusCode = 402; // 支付要求，适合表示配额问题
  }
  
  const errorResponse = {
    error: errorMessage
  };
  
  const response = new Response(JSON.stringify(errorResponse), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json"
    }
  });
  
  return setCorsHeaders(response);
}

// 处理聊天请求 - 使用LangChain.js
async function handleChatRequest(request) {
  try {
    const data = await request.json();
    const messages = data.messages;
    
    console.log("处理聊天请求，消息:", JSON.stringify(messages));
    
    if (!messages || !Array.isArray(messages)) {
      const errorResponse = {
        error: "请求必须包含messages数组"
      };
      
      return setCorsHeaders(
        new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );
    }
    
    // 使用LangChain的ChatOpenAI模型处理请求
    const chatResponse = await model.invoke(messages);
    
    // 构建响应
    const aiResponse = {
      content: chatResponse.content || chatResponse.text
    };
    
    return setCorsHeaders(
      new Response(JSON.stringify({ response: aiResponse }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// 处理查询请求 - 使用LangChain的Chain
async function handleQueryRequest(request) {
  try {
    const data = await request.json();
    const query = data.query;
    
    console.log("处理查询请求:", query);
    
    if (!query) {
      const errorResponse = {
        error: "请求必须包含查询文本"
      };
      
      return setCorsHeaders(
        new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );
    }
    
    // 创建提示模板 - LangChain风格
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", "你是一个乐于助人的AI助手，基于LangChain.js构建。简洁、准确地回答用户的问题。"],
      ["human", "{query}"]
    ]);
    
    // 创建LangChain链
    const chain = promptTemplate.pipe(model).pipe(outputParser);
    
    // 执行链
    const result = await chain.invoke({
      query: query
    });
    
    // 构建响应
    const responseObj = {
      result: { text: result }
    };
    
    return setCorsHeaders(
      new Response(JSON.stringify(responseObj), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// 处理静态文件
async function handleStaticFile(req) {
  const url = new URL(req.url);
  let path = url.pathname;
  
  // 将根路径映射到index.html
  if (path === "/" || path === "") {
    path = "/index.html";
  }
  
  try {
    const file = await Deno.readFile(`.${path}`);
    
    // 设置内容类型
    let contentType = "text/plain";
    if (path.endsWith(".html")) contentType = "text/html";
    if (path.endsWith(".js")) contentType = "text/javascript";
    if (path.endsWith(".css")) contentType = "text/css";
    if (path.endsWith(".json")) contentType = "application/json";
    if (path.endsWith(".env")) contentType = "text/plain";
    
    return new Response(file, {
      headers: { "Content-Type": contentType }
    });
  } catch (error) {
    // 如果文件不存在，返回404
    if (error instanceof Deno.errors.NotFound) {
      return new Response("文件不存在", { status: 404 });
    }
    
    // 其他错误返回500
    return new Response(`服务器错误: ${error.message}`, { status: 500 });
  }
}

// 处理所有HTTP请求
async function handler(req) {
  const url = new URL(req.url);
  
  console.log(`收到请求: ${req.method} ${url.pathname}`);
  
  // 处理OPTIONS请求（CORS预检）
  if (req.method === "OPTIONS") {
    return handleOptionsRequest();
  }
  
  // 处理API请求
  if (url.pathname === "/api/chat" && req.method === "POST") {
    return await handleChatRequest(req);
  }
  
  // 处理单个查询API - 使用LangChain链
  if (url.pathname === "/api/query" && req.method === "POST") {
    return await handleQueryRequest(req);
  }
  
  // 处理静态文件
  const response = await handleStaticFile(req);
  return setCorsHeaders(response);
}

// 启动服务器
const port = 8088; // 使用一个不常用的端口，避免冲突
console.log(`Deno + LangChain.js 服务器运行在 http://localhost:${port}/`);
console.log(`该服务器提供基于LangChain.js的聊天和查询功能`);
await serve(handler, { port }); 