#!/bin/bash
echo "====== 启动LangChain项目 ======"
echo "1. 编译TypeScript代码..."
npm run build
echo "2. 启动服务器..."
node server.js
