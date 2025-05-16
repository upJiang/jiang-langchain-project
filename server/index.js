import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import documentRoutes from "./routes/documentRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";

// 加载环境变量
dotenv.config();

// ES Module中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 静态文件服务
app.use(express.static(path.join(__dirname, "..", "dist")));

// API路由
app.use("/api", documentRoutes);
app.use("/api", queryRoutes);

// 首页路由
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ success: false, message: "API端点不存在" });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error("服务器错误:", err);
  res.status(500).json({
    success: false,
    message: "服务器内部错误",
    error: err.message,
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口: ${PORT}`);
});
