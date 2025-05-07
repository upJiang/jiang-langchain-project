"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCityId = getCityId;
exports.get7DayWeatherForecast = get7DayWeatherForecast;
exports.getRealTimeWeather = getRealTimeWeather;
exports.getWeatherReport = getWeatherReport;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
// 和风天气 API 基础URL
const BASE_URL = 'https://devapi.qweather.com/v7';
/**
 * 获取城市ID
 * @param cityName 城市名称
 * @returns 城市信息
 */
async function getCityId(cityName) {
    try {
        const response = await axios_1.default.get('https://geoapi.qweather.com/v2/city/lookup', {
            params: {
                location: cityName,
                key: config_1.env.QWEATHER_KEY,
            },
        });
        const data = response.data;
        if (data.code !== '200' || !data.location || data.location.length === 0) {
            throw new Error(`未找到城市: ${cityName}`);
        }
        const cityInfo = {
            name: data.location[0].name,
            id: data.location[0].id,
            lat: data.location[0].lat,
            lon: data.location[0].lon,
            adm1: data.location[0].adm1,
            adm2: data.location[0].adm2,
        };
        return cityInfo;
    }
    catch (error) {
        console.error('获取城市ID失败:', error);
        throw error;
    }
}
/**
 * 获取7天天气预报
 * @param cityId 城市ID
 * @returns 天气数据列表
 */
async function get7DayWeatherForecast(cityId) {
    try {
        const response = await axios_1.default.get(`${BASE_URL}/weather/7d`, {
            params: {
                location: cityId,
                key: config_1.env.QWEATHER_KEY,
            },
        });
        const data = response.data;
        if (data.code !== '200' || !data.daily || data.daily.length === 0) {
            throw new Error(`获取天气预报失败: ${cityId}`);
        }
        // 转换数据格式
        const weatherDataList = data.daily.map((day) => ({
            date: day.fxDate,
            tempMax: day.tempMax,
            tempMin: day.tempMin,
            textDay: day.textDay,
            textNight: day.textNight,
            windDirDay: day.windDirDay,
            windScaleDay: day.windScaleDay,
            windDirNight: day.windDirNight,
            windScaleNight: day.windScaleNight,
            humidity: day.humidity,
            precip: day.precip,
            uvIndex: day.uvIndex,
        }));
        return weatherDataList;
    }
    catch (error) {
        console.error('获取天气预报失败:', error);
        throw error;
    }
}
/**
 * 获取实时天气
 * @param cityId 城市ID
 * @returns 实时天气数据
 */
async function getRealTimeWeather(cityId) {
    try {
        const response = await axios_1.default.get(`${BASE_URL}/weather/now`, {
            params: {
                location: cityId,
                key: config_1.env.QWEATHER_KEY,
            },
        });
        const data = response.data;
        if (data.code !== '200' || !data.now) {
            throw new Error(`获取实时天气失败: ${cityId}`);
        }
        return data.now;
    }
    catch (error) {
        console.error('获取实时天气失败:', error);
        throw error;
    }
}
/**
 * 根据城市名称获取天气报告
 * @param cityName 城市名称
 * @returns 格式化的天气报告
 */
async function getWeatherReport(cityName) {
    try {
        // 获取城市信息
        const cityInfo = await getCityId(cityName);
        // 获取实时天气
        const realTimeWeather = await getRealTimeWeather(cityInfo.id);
        // 获取7天天气预报
        const forecast = await get7DayWeatherForecast(cityInfo.id);
        // 今天和明天的天气数据
        const todayWeather = forecast[0];
        const tomorrowWeather = forecast[1];
        // 构建天气报告
        let report = `${cityInfo.name}天气预报\n\n`;
        // 实时天气
        report += `实时天气: ${realTimeWeather.text}, ${realTimeWeather.temp}°C, 体感温度 ${realTimeWeather.feelsLike}°C\n`;
        report += `相对湿度: ${realTimeWeather.humidity}%, 风向: ${realTimeWeather.windDir}, 风力等级: ${realTimeWeather.windScale}级\n\n`;
        // 今日天气预报
        report += `今日天气: ${todayWeather.textDay}转${todayWeather.textNight}, ${todayWeather.tempMin}°C ~ ${todayWeather.tempMax}°C\n`;
        report += `风向: 白天${todayWeather.windDirDay}${todayWeather.windScaleDay}级, 夜间${todayWeather.windDirNight}${todayWeather.windScaleNight}级\n`;
        report += `相对湿度: ${todayWeather.humidity}%, 降水量: ${todayWeather.precip}mm, 紫外线指数: ${todayWeather.uvIndex}\n\n`;
        // 明日天气预报
        report += `明日天气: ${tomorrowWeather.textDay}转${tomorrowWeather.textNight}, ${tomorrowWeather.tempMin}°C ~ ${tomorrowWeather.tempMax}°C\n`;
        report += `风向: 白天${tomorrowWeather.windDirDay}${tomorrowWeather.windScaleDay}级, 夜间${tomorrowWeather.windDirNight}${tomorrowWeather.windScaleNight}级\n`;
        report += `相对湿度: ${tomorrowWeather.humidity}%, 降水量: ${tomorrowWeather.precip}mm, 紫外线指数: ${tomorrowWeather.uvIndex}\n`;
        return report;
    }
    catch (error) {
        console.error('生成天气报告失败:', error);
        throw error;
    }
}
