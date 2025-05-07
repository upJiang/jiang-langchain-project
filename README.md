# LangChain.js 演示项目

这是一个基于 LangChain.js 的演示项目，用于展示大语言模型在各种场景下的应用，包括基本对话、代理工具使用、RAG检索、数据库集成及天气预报功能。

## 功能特点

- **基本对话链**：简单的聊天机器人功能，支持连续对话
- **代理与工具**：支持使用天气查询、数据库查询等工具的智能代理
- **RAG检索**：基于文档的问答系统，可从文档中检索信息回答问题
- **数据库集成**：通过自然语言与数据库交互，执行查询操作
- **天气预报**：实时查询城市天气，并支持定时推送功能

## 项目结构

```
├── dist/              # TypeScript编译输出目录
├── frontend/          # 前端代码
│   ├── css/           # 样式文件
│   ├── js/            # JavaScript脚本
│   └── index.html     # 主页面
├── src/               # 源代码目录
│   ├── chains/        # 各种链的实现
│   ├── config/        # 配置文件
│   ├── embeddings/    # 嵌入和向量存储相关
│   ├── models/        # LLM模型工厂
│   ├── services/      # 服务模块
│   ├── tools/         # 工具实现
│   └── utils/         # 工具函数
├── .env               # 环境变量
├── package.json       # 项目依赖
├── server.js          # Express服务器
└── tsconfig.json      # TypeScript配置
```

## 环境要求

- Node.js 18+
- TypeScript
- 和风天气API密钥（可选）
- OpenAI API密钥（如需使用真实LLM）

## 安装步骤

1. 克隆项目

```bash
git clone <项目地址>
cd langchain-project
```

2. 安装依赖

```bash
yarn install
```

3. 配置环境变量

复制`.env.example`文件为`.env`，并填写相关API密钥：

```bash
cp .env.example .env
# 编辑.env文件填写API密钥
```

4. 编译TypeScript代码

```bash
yarn build
```

5. 启动项目

```bash
# 启动Express服务器
node server.js
```

6. 在浏览器中访问

```
http://localhost:3000
```

## 使用方法

1. **基本对话链**：直接输入文本与AI助手对话
2. **代理与工具**：尝试询问天气相关问题（如"北京今天天气怎么样"）或数据库问题
3. **RAG检索**：询问关于LangChain的问题，系统会从文档中检索相关信息
4. **数据库集成**：使用自然语言查询数据库，如"查询所有用户信息"
5. **天气预报**：查询城市天气，或设置定时推送

## 开发说明

- 前端使用Vue 3和Element Plus构建，无需构建工具直接通过CDN引入
- 后端使用Express提供API服务
- LangChain.js用于构建各种AI链和工具

## 关键技术

- **LangChain.js**：用于构建各种AI应用链和工具
- **Vue 3**：前端框架
- **Element Plus**：UI组件库
- **Express**：后端服务器
- **内存/JSON数据库**：用于存储数据，无需安装数据库

## 许可证

MIT

## 鸣谢

- LangChain团队提供的优秀框架
- 和风天气API提供天气数据 