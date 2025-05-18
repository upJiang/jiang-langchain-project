import { BufferMemory } from "langchain/memory";

// 使用Map存储不同会话的记忆实例
const memoryInstances = new Map();

/**
 * 获取或创建一个会话记忆
 * @param {string} sessionId 会话ID
 * @returns {BufferMemory} 会话记忆实例
 */
export function getMemoryForSession(sessionId) {
  if (!sessionId) {
    return new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "question",
      outputKey: "text",
    });
  }

  // 如果会话ID已存在，返回现有的记忆
  if (memoryInstances.has(sessionId)) {
    return memoryInstances.get(sessionId);
  }

  // 否则创建新的记忆
  const memory = new BufferMemory({
    returnMessages: true,
    memoryKey: "chat_history",
    inputKey: "question",
    outputKey: "text",
  });

  memoryInstances.set(sessionId, memory);
  console.log(`为会话 ${sessionId} 创建了新的记忆实例`);

  return memory;
}

/**
 * 将新的对话轮次添加到记忆中
 * @param {string} sessionId 会话ID
 * @param {string} humanInput 用户输入
 * @param {string} aiOutput AI回答
 * @returns {Promise<void>}
 */
export async function addToMemory(sessionId, humanInput, aiOutput) {
  if (!sessionId) return;

  try {
    // 确保输入和输出都是字符串
    const inputText = humanInput ? String(humanInput).trim() : "";
    const outputText = aiOutput ? String(aiOutput).trim() : "";

    if (!inputText || !outputText) {
      console.log(`跳过记忆保存: 输入或输出为空 (sessionId: ${sessionId})`);
      return;
    }

    // 获取会话记忆
    const memory = getMemoryForSession(sessionId);

    // 添加新的消息到记忆，注意使用与BufferMemory配置中相同的键名
    await memory.saveContext({ question: inputText }, { text: outputText });

    console.log(`已将对话添加到会话 ${sessionId} 的记忆中`);
  } catch (error) {
    console.error(`向记忆添加对话失败:`, error);
  }
}

/**
 * 获取记忆中的对话历史
 * @param {string} sessionId 会话ID
 * @returns {Promise<Object>} 记忆变量
 */
export async function getMemoryVariables(sessionId) {
  if (!sessionId) {
    return { chat_history: [] };
  }

  const memory = getMemoryForSession(sessionId);
  return await memory.loadMemoryVariables({});
}

/**
 * 获取格式化的历史消息文本
 * @param {string} sessionId 会话ID
 * @returns {Promise<string>} 格式化的历史文本
 */
export async function getFormattedHistory(sessionId) {
  if (!sessionId) return "";

  try {
    const memory = getMemoryForSession(sessionId);
    const { chat_history } = await memory.loadMemoryVariables({});

    if (!chat_history || chat_history.length === 0) return "";

    // 将消息格式化为文本
    return chat_history
      .map((msg) => {
        const role = msg._getType() === "human" ? "用户" : "AI";
        return `${role}: ${msg.content}`;
      })
      .join("\n");
  } catch (error) {
    console.error("获取格式化历史失败:", error);
    return "";
  }
}

/**
 * 清除特定会话的记忆
 * @param {string} sessionId 会话ID
 */
export function clearMemory(sessionId) {
  if (!sessionId) return;

  if (memoryInstances.has(sessionId)) {
    memoryInstances.delete(sessionId);
    console.log(`已清除会话 ${sessionId} 的记忆`);
  }
}

/**
 * 清除所有会话记忆
 */
export function clearAllMemories() {
  memoryInstances.clear();
  console.log("已清除所有会话记忆");
}
