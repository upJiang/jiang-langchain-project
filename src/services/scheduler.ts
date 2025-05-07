import schedule from 'node-schedule';
import { getWeatherReport } from './weather';
import { sendWeatherReportEmail } from './email';

// 任务ID与任务实例的映射
const jobMap = new Map<string, schedule.Job>();

/**
 * 创建每日天气报告发送任务
 * @param cityName 城市名称
 * @param time 定时时间（cron格式）
 * @param email 接收邮件的地址（可选）
 * @returns 任务ID
 */
export function scheduleDailyWeatherReport(
  cityName: string,
  time: string = '0 7 * * *', // 默认每天早上7点
  email?: string
): string {
  // 生成任务ID
  const jobId = `weather_${cityName}_${Date.now()}`;
  
  // 创建定时任务
  const job = schedule.scheduleJob(time, async () => {
    try {
      console.log(`正在执行天气预报任务: ${cityName}`);
      // 获取天气报告
      const weatherReport = await getWeatherReport(cityName);
      
      // 发送邮件
      await sendWeatherReportEmail(email, weatherReport);
      
      console.log(`天气预报任务执行成功: ${cityName}`);
    } catch (error) {
      console.error(`天气预报任务执行失败: ${cityName}`, error);
    }
  });
  
  // 保存任务实例
  jobMap.set(jobId, job);
  
  console.log(`已创建天气预报任务: ${jobId}, 时间: ${time}, 城市: ${cityName}`);
  
  return jobId;
}

/**
 * 取消定时任务
 * @param jobId 任务ID
 * @returns 是否成功取消
 */
export function cancelJob(jobId: string): boolean {
  const job = jobMap.get(jobId);
  
  if (job) {
    job.cancel();
    jobMap.delete(jobId);
    console.log(`已取消任务: ${jobId}`);
    return true;
  }
  
  console.log(`任务不存在: ${jobId}`);
  return false;
}

/**
 * 获取所有活跃任务
 * @returns 任务ID列表
 */
export function getActiveJobs(): string[] {
  return Array.from(jobMap.keys());
}

/**
 * 立即执行天气报告任务（不等待定时器）
 * @param cityName 城市名称
 * @param email 接收邮件的地址（可选）
 */
export async function runWeatherReportNow(
  cityName: string,
  email?: string
): Promise<void> {
  try {
    console.log(`立即执行天气预报任务: ${cityName}`);
    
    // 获取天气报告
    const weatherReport = await getWeatherReport(cityName);
    
    // 发送邮件
    await sendWeatherReportEmail(email, weatherReport);
    
    console.log(`天气预报任务执行成功: ${cityName}`);
  } catch (error) {
    console.error(`天气预报任务执行失败: ${cityName}`, error);
    throw error;
  }
} 