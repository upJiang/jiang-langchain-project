import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { processUploadedFiles } from "../services/documentLoader.js";
import { createEmbeddingModel } from "../services/embeddings.js";
import {
  addToVectorStore,
  createVectorStore,
  getDefaultVectorStorePath,
  splitDocuments,
} from "../services/vectorStore.js";

// 创建路由
const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), "server", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成安全的文件名
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedExtensions = [".txt", ".md", ".pdf", ".csv", ".json", ".docx"];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `不支持的文件类型: ${fileExt}，仅支持以下格式: ${allowedExtensions.join(
          ", "
        )}`
      )
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 限制文件大小为10MB
});

// 文件上传和文本提取API
router.post("/extractText", upload.array("files", 10), async (req, res) => {
  console.log("收到文件上传请求");
  try {
    const files = req.files;
    console.log(`收到 ${files ? files.length : 0} 个文件`);

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "未上传文件" });
    }

    // 获取文件名映射信息
    let fileDetails = [];
    try {
      if (req.body.fileDetails) {
        fileDetails = JSON.parse(req.body.fileDetails);
        console.log("收到文件详情映射:", fileDetails);
      }
    } catch (e) {
      console.error("解析文件详情失败:", e);
    }

    // 创建安全文件名到原始文件名的映射
    const filenameMap = {};
    fileDetails.forEach((detail) => {
      filenameMap[detail.safeFilename] = detail.originalFilename;
    });

    // 使用文档加载器处理上传的文件
    const { extractedTexts, documents } = await processUploadedFiles(
      files,
      filenameMap
    );

    res.json({
      success: true,
      message: `成功从 ${extractedTexts.length} 个文件中提取文本`,
      extractedTexts: extractedTexts,
      // 不返回documents，因为可能很大
      documentCount: documents.length,
    });
  } catch (error) {
    console.error("文件上传处理错误:", error);
    res.status(500).json({
      success: false,
      message: "文件处理失败",
      error: error.message,
    });
  }
});

// 向量化处理API
router.post("/vectorize", async (req, res) => {
  try {
    const { extractedTexts, appendToExisting, vectorStorePath } = req.body;

    if (
      !extractedTexts ||
      !Array.isArray(extractedTexts) ||
      extractedTexts.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: "未提供文本内容" });
    }

    console.log(`正在处理向量化，使用硅基流动嵌入模型`);
    console.log(`提供的文本数量: ${extractedTexts.length}`);
    console.log(`追加到现有向量: ${appendToExisting ? "是" : "否"}`);

    // 收集所有文档的文件名
    const processedDocumentNames = extractedTexts.map((item) => item.filename);

    // 转换extractedTexts为LangChain文档格式
    const documents = extractedTexts.map((item) => ({
      pageContent: item.text,
      metadata: {
        source: item.filename,
        ...item.metadata,
      },
    }));

    // 创建嵌入模型
    let embeddings;
    try {
      embeddings = createEmbeddingModel();
      console.log("成功创建嵌入模型实例");
    } catch (error) {
      console.error("创建嵌入模型失败:", error);
      return res.status(500).json({
        success: false,
        message: `创建嵌入模型失败: ${error.message}`,
      });
    }

    // 分割文档
    const splitDocs = await splitDocuments(documents);
    console.log(`文档已分割成 ${splitDocs.length} 个块`);

    let resultVectorStorePath;
    let result;

    // 根据是否追加到现有向量来处理
    if (appendToExisting && vectorStorePath) {
      // 追加到现有向量存储
      console.log(`向量将追加到现有存储: ${vectorStorePath}`);
      result = await addToVectorStore(vectorStorePath, splitDocs, embeddings);
      resultVectorStorePath = vectorStorePath;
      console.log(
        `成功添加 ${result.addedCount} 个向量，当前总计 ${result.totalCount} 个向量`
      );
    } else {
      // 创建新的向量存储
      resultVectorStorePath = vectorStorePath || getDefaultVectorStorePath();
      console.log(`创建新的向量存储: ${resultVectorStorePath}`);
      const vectorStore = await createVectorStore(
        splitDocs,
        embeddings,
        resultVectorStorePath
      );
      console.log(`成功创建新的向量存储，包含 ${splitDocs.length} 个文档片段`);
      result = {
        addedCount: splitDocs.length,
        totalCount: splitDocs.length,
      };
    }

    res.json({
      success: true,
      message: appendToExisting
        ? `成功将 ${extractedTexts.length} 个文档追加到向量存储，添加了 ${result.addedCount} 个向量`
        : `成功向量化 ${extractedTexts.length} 个文档，生成 ${splitDocs.length} 个向量`,
      vectorStorePath: resultVectorStorePath,
      documentsProcessed: extractedTexts.length,
      processedDocumentNames: processedDocumentNames,
      chunksGenerated: splitDocs.length,
      appendedToExisting: appendToExisting || false,
      totalVectors: result.totalCount,
    });
  } catch (error) {
    console.error("向量化处理错误:", error);
    res.status(500).json({
      success: false,
      message: "向量化处理失败",
      error: error.message,
    });
  }
});

export default router;
