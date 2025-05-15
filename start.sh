#!/bin/bash

# 检测并释放3000端口（客户端）
echo "检测3000端口占用情况..."
PORT_3000_PID=$(lsof -ti:3000)
if [ ! -z "$PORT_3000_PID" ]; then
  echo "发现进程 $PORT_3000_PID 占用了3000端口，正在终止..."
  kill -9 $PORT_3000_PID
  echo "3000端口已释放"
else
  echo "3000端口未被占用"
fi

# 检测并释放3001端口（服务器）
echo "检测3001端口占用情况..."
PORT_3001_PID=$(lsof -ti:3001)
if [ ! -z "$PORT_3001_PID" ]; then
  echo "发现进程 $PORT_3001_PID 占用了3001端口，正在终止..."
  kill -9 $PORT_3001_PID
  echo "3001端口已释放"
else
  echo "3001端口未被占用"
fi

# 检查uploads目录是否存在
if [ ! -d "server/uploads" ]; then
  echo "创建uploads目录..."
  mkdir -p server/uploads
fi

# 启动服务器（后台运行）
echo "启动服务器..."
node server/index.js &
SERVER_PID=$!
echo "服务器进程ID: $SERVER_PID"

# 等待服务器启动
echo "等待服务器启动完成..."
sleep 3

# 启动客户端（前台运行）
echo "启动客户端..."
yarn dev

# 当客户端关闭时，终止服务器进程
echo "客户端已关闭，正在终止服务器..."
kill -9 $SERVER_PID
echo "服务器已终止" 