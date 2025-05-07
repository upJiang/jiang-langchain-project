import nodemailer from 'nodemailer';
import { env } from '../config/config';

// 创建邮件传输器
const createTransporter = () => {
  // 检查是否配置了邮件发送
  if (!env.EMAIL_HOST || !env.EMAIL_PORT || !env.EMAIL_USER || !env.EMAIL_PASS) {
    throw new Error('邮件配置不完整，请检查环境变量');
  }

  return nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465, // 如果端口是465，则使用安全连接
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
  });
};

/**
 * 发送普通文本邮件
 * @param to 收件人
 * @param subject 邮件主题
 * @param text 邮件内容
 */
export async function sendTextEmail(
  to: string = env.EMAIL_TO || '',
  subject: string, 
  text: string
): Promise<void> {
  try {
    // 创建邮件传输器
    const transporter = createTransporter();
    
    // 发送邮件
    await transporter.sendMail({
      from: env.EMAIL_USER,
      to,
      subject,
      text,
    });
    
    console.log('邮件发送成功');
  } catch (error) {
    console.error('邮件发送失败:', error);
    throw error;
  }
}

/**
 * 发送HTML邮件
 * @param to 收件人
 * @param subject 邮件主题
 * @param html HTML内容
 */
export async function sendHtmlEmail(
  to: string = env.EMAIL_TO || '',
  subject: string, 
  html: string
): Promise<void> {
  try {
    // 创建邮件传输器
    const transporter = createTransporter();
    
    // 发送邮件
    await transporter.sendMail({
      from: env.EMAIL_USER,
      to,
      subject,
      html,
    });
    
    console.log('HTML邮件发送成功');
  } catch (error) {
    console.error('HTML邮件发送失败:', error);
    throw error;
  }
}

/**
 * 将文本内容格式化为HTML
 * @param text 文本内容
 * @returns 格式化后的HTML
 */
export function formatTextToHtml(text: string): string {
  // 替换换行符为<br>标签
  return `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #eee;
            border-radius: 5px;
            padding: 20px;
          }
          h1 {
            color: #0066cc;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            ${text.replace(/\n/g, '<br>')}
          </div>
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 发送天气报告邮件
 * @param to 收件人
 * @param weatherReport 天气报告内容
 */
export async function sendWeatherReportEmail(
  to: string = env.EMAIL_TO || '',
  weatherReport: string
): Promise<void> {
  // 为邮件创建一个标题
  const subject = '每日天气预报 - ' + new Date().toLocaleDateString('zh-CN');
  
  // 将文本格式化为HTML
  const html = formatTextToHtml(weatherReport);
  
  // 发送HTML邮件
  await sendHtmlEmail(to, subject, html);
} 