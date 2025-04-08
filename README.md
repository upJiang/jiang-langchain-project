# LangChain Deno 问答Demo

这是一个使用Vue3、LangChain.js和Deno构建的轻量级AI问答应用Demo。该Demo集成了不同平台和框架，展示了现代AI应用的开发方式。

## 项目特点

- 🚀 **轻量级前端** - 使用CDN引入Vue3，无需复杂构建过程
- 🦕 **Deno后端** - 使用安全高效的Deno运行时处理服务器逻辑
- 🧠 **LangChain集成** - 使用LangChain.js框架与OpenAI API交互
- 🔑 **环境变量** - 从.env文件读取API密钥，保证安全性
- 🎨 **简洁界面** - 提供干净简洁的用户界面
- 📓 **Jupyter支持** - 包含Jupyter Notebook进行交互式开发和测试

## 环境要求

- Deno 1.35+
- Node.js 14+ (可选)
- Python 3.6+ (用于Jupyter Notebook)
- Jupyter Notebook (可选)

## 快速开始

### 1. 安装Deno

```bash
# macOS, Linux 系统
curl -fsSL https://deno.land/x/install/install.sh | sh

# Windows (PowerShell)
iwr https://deno.land/x/install/install.ps1 -useb | iex
```

### 2. 克隆项目

```bash
git clone <repository-url>
cd langchain-deno-demo
```

### 3. 设置API密钥

编辑项目根目录下的`.env`文件，将你的OpenAI API密钥填入：

```
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. 启动Deno服务器

```bash
# 启动Deno服务器
deno run --allow-net --allow-read --allow-env server.ts
```

服务器将运行在 http://localhost:3000/

### 5. 访问应用

打开浏览器，访问 http://localhost:3000 即可使用问答功能。

## 使用Jupyter Notebook

本项目还提供了一个Jupyter Notebook，用于交互式开发和测试：

1. 安装必要的Python依赖：

```bash
pip install jupyter notebook requests ipywidgets
```

2. 启动Jupyter Notebook：

```bash
jupyter notebook langchain_demo.ipynb
```

3. 按照Notebook中的指导进行交互式开发和测试。

## 项目结构

```
langchain-deno-demo/
├── .env                # 环境变量配置文件（包含API密钥）
├── index.html          # 前端HTML页面
├── app.js              # Vue应用逻辑
├── server.ts           # Deno服务器代码
├── langchain_demo.ipynb # Jupyter Notebook演示文件
└── README.md           # 项目说明文档
```

## 技术栈

- **前端**：
  - Vue 3 (通过CDN引入)
  - 纯HTML/CSS/JavaScript

- **后端**：
  - Deno (JavaScript/TypeScript运行时)
  - LangChain.js (AI开发框架)

- **AI集成**：
  - OpenAI API (提供AI问答功能)
  - LangChain (链式提示和响应处理)

- **开发工具**：
  - Jupyter Notebook (交互式开发)

## 实现细节

1. **前端应用**：
   - 使用Vue3 Composition API构建响应式用户界面
   - 实现简洁的聊天界面，支持历史记录显示

2. **Deno后端**：
   - 使用Deno提供HTTP服务
   - 处理静态文件服务和API请求
   - 集成LangChain.js与OpenAI交互

3. **LangChain集成**：
   - 利用ChatOpenAI模型处理用户输入
   - 使用LLMChain构建提示和响应链
   - 管理API密钥和环境变量

4. **Jupyter集成**：
   - 提供交互式测试环境
   - 演示API交互和服务器控制
   - 创建简单的Python客户端界面

## 自定义设置

你可以在`server.ts`文件中修改以下设置：

- OpenAI模型类型（默认：'gpt-3.5-turbo'）
- 温度参数（默认：0.7）
- 服务器端口（默认：3000）

## 可能的扩展

1. 添加用户认证功能
2. 支持文件上传和处理
3. 实现流式响应（Streaming Response）
4. 添加更多LangChain工具和代理
5. 集成向量数据库进行语义搜索

## 许可证

MIT 