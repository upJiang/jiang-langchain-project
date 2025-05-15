# 基于LangChain.js的智能客服系统

这是一个使用Vue3和LangChain.js构建的智能客服系统，支持文档上传、向量化处理和智能问答功能。

## 功能特点

- 支持文档上传和向量化处理
- 支持选择不同的embedding模型
- 自定义API端点和模型参数
- 基于文档内容的智能问答
- 直观的向量化结果展示

## 技术栈

- 前端：Vue 3
- 后端：Express.js
- AI框架：LangChain.js
- 向量数据库：MemoryVectorStore

## 快速开始

### 安装依赖

```bash
yarn 
```

### 启动前端开发服务器

```bash
yarn dev
```

### 启动后端服务器

```bash
yarn serve
```

## 使用方法

1. 访问 http://localhost:3000
2. 配置API密钥和相关参数
3. 上传文档文件
4. 查看向量化结果
5. 在对话界面中提问

## 项目结构

```
├── client/             # 前端代码
│   ├── App.vue         # Vue主组件
│   └── main.js         # 前端入口
├── server/             # 后端代码
│   ├── index.js        # 后端入口
│   └── uploads/        # 上传文件目录
├── public/             # 静态资源
├── index.html          # HTML入口
├── package.json        # 项目配置
├── vite.config.js      # Vite配置
├── study.md            # 学习总结
└── README.md           # 项目说明
```

## 注意事项

- 需要有效的OpenAI或Cohere API密钥
- 上传文件目前仅支持文本文件
- 所有处理都在内存中完成，大文件可能导致性能问题

## 学习资源

详细的项目原理和学习总结，请参阅[study.md](./study.md)。