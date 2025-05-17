import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from "fs";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import path from "path";

/**
 * 根据文件类型选择合适的加载器
 * @param {string} filePath 文件路径
 * @param {string} originalFilename 原始文件名
 * @returns {Promise<Array>} 文档数组
 */
export async function loadDocument(filePath, originalFilename) {
  try {
    const ext = path.extname(originalFilename).toLowerCase();
    let loader;

    switch (ext) {
      case ".txt":
      case ".md":
        loader = new TextLoader(filePath);
        break;
      case ".pdf":
        loader = new PDFLoader(filePath);
        break;
      case ".csv":
        loader = new CSVLoader(filePath);
        break;
      case ".json":
        loader = new JSONLoader(filePath);
        break;
      case ".docx":
        loader = new DocxLoader(filePath);
        break;
      default:
        throw new Error(`不支持的文件类型: ${ext}`);
    }

    console.log(
      `使用 ${loader.constructor.name} 加载文件: ${originalFilename}`
    );
    const docs = await loader.load();
    return docs;
  } catch (error) {
    console.error(`加载文件 ${originalFilename} 失败:`, error);
    throw error;
  }
}

/**
 * 加载目录中的所有文档
 * @param {string} directoryPath 目录路径
 * @returns {Promise<Array>} 文档数组
 */
export async function loadDirectory(directoryPath) {
  try {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`目录不存在: ${directoryPath}`);
    }

    const loader = new DirectoryLoader(directoryPath, {
      ".txt": (path) => new TextLoader(path),
      ".md": (path) => new TextLoader(path),
      ".pdf": (path) => new PDFLoader(path),
      ".csv": (path) => new CSVLoader(path),
      ".json": (path) => new JSONLoader(path),
      ".docx": (path) => new DocxLoader(path),
    });

    console.log(`加载目录: ${directoryPath}`);
    const docs = await loader.load();
    return docs;
  } catch (error) {
    console.error(`加载目录 ${directoryPath} 失败:`, error);
    throw error;
  }
}

/**
 * 处理上传的文件并加载文档
 * @param {Array} files 上传的文件数组
 * @param {Object} filenameMap 文件名映射
 * @returns {Promise<Object>} 包含提取文本的对象
 */
export async function processUploadedFiles(files, filenameMap = {}) {
  if (!files || files.length === 0) {
    throw new Error("未上传文件");
  }

  // 根据文件扩展名过滤支持的文件
  const supportedExtensions = [".txt", ".md", ".pdf", ".csv", ".json", ".docx"];
  const validFiles = [];
  const invalidFiles = [];

  for (const file of files) {
    // 获取文件的原始文件名
    const originalFilename =
      filenameMap[file.originalname] || file.originalname;
    // 保存原始文件名供后续使用
    file.originalFilename = originalFilename;

    const ext = path.extname(originalFilename).toLowerCase();
    if (supportedExtensions.includes(ext)) {
      validFiles.push(file);
    } else {
      invalidFiles.push(originalFilename);
    }
  }

  if (validFiles.length === 0) {
    throw new Error(
      `不支持的文件类型: ${invalidFiles.join(
        ", "
      )}，仅支持以下格式: ${supportedExtensions.join(", ")}`
    );
  }

  // 处理所有上传的文件
  const extractedTexts = [];
  let allDocuments = [];

  for (const file of validFiles) {
    try {
      const displayFilename = file.originalFilename;
      console.log(`处理文件: ${displayFilename} (${file.size} 字节)`);

      // 使用LangChain加载器读取文件
      const docs = await loadDocument(file.path, displayFilename);
      allDocuments = allDocuments.concat(docs);

      // 将文档内容提取为文本
      let textContent = docs.map((doc) => doc.pageContent).join("\n\n");

      if (!textContent || textContent.trim().length === 0) {
        console.warn(`文件 ${displayFilename} 内容为空，跳过`);
        continue;
      }

      extractedTexts.push({
        filename: displayFilename,
        text: textContent,
        size: textContent.length,
        metadata: docs.length > 0 ? docs[0].metadata : {},
      });

      console.log(
        `成功提取 ${displayFilename} 的文本，长度: ${textContent.length} 字符`
      );
    } catch (error) {
      console.error(`处理文件 ${file.originalFilename} 失败:`, error);
      // 继续处理其他文件，而不是立即返回错误
    }
  }

  if (extractedTexts.length === 0) {
    throw new Error("未能从任何上传的文件中提取有效文本内容");
  }

  return {
    extractedTexts,
    documents: allDocuments,
  };
}
