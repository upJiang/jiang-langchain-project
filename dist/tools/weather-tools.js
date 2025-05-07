"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWeatherQueryTool = createWeatherQueryTool;
exports.createWeatherComparisonTool = createWeatherComparisonTool;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const weather_1 = require("../services/weather");
/**
 * 创建天气查询工具
 * @returns 天气查询工具实例
 */
function createWeatherQueryTool() {
    return new tools_1.DynamicStructuredTool({
        name: 'get_weather',
        description: '获取指定城市的天气预报信息',
        schema: zod_1.z.object({
            city: zod_1.z.string().describe('要查询的城市名称，例如"北京"、"上海"、"广州"等'),
        }),
        func: async ({ city }) => {
            try {
                console.log(`正在查询城市天气: ${city}`);
                const weatherReport = await (0, weather_1.getWeatherReport)(city);
                return weatherReport;
            }
            catch (error) {
                console.error(`天气查询失败: ${city}`, error);
                return `抱歉，无法获取 ${city} 的天气信息。请检查城市名称是否正确或稍后再试。`;
            }
        },
    });
}
/**
 * 创建多城市天气对比工具
 * @returns 多城市天气对比工具实例
 */
function createWeatherComparisonTool() {
    return new tools_1.DynamicStructuredTool({
        name: 'compare_weather',
        description: '对比多个城市的天气情况',
        schema: zod_1.z.object({
            cities: zod_1.z.array(zod_1.z.string()).describe('要对比的城市名称列表，例如["北京", "上海", "广州"]'),
        }),
        func: async ({ cities }) => {
            try {
                console.log(`正在对比城市天气: ${cities.join(', ')}`);
                const weatherReports = await Promise.all(cities.map(async (city) => {
                    try {
                        return await (0, weather_1.getWeatherReport)(city);
                    }
                    catch (error) {
                        return `无法获取 ${city} 的天气信息`;
                    }
                }));
                // 合并天气报告
                const comparisonReport = `多城市天气对比:\n\n${weatherReports.join('\n\n---\n\n')}`;
                return comparisonReport;
            }
            catch (error) {
                console.error(`天气对比失败`, error);
                return `抱歉，无法对比城市天气信息。请稍后再试。`;
            }
        },
    });
}
