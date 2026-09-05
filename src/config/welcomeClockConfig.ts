import type { WelcomeClockConfig } from "../types/welcomeClockConfig";

export const welcomeClockConfig: WelcomeClockConfig = {
	// 卡片标题，留空则使用 i18n 默认标题
	title: "",

	// 默认城市（用于显示与 geo 查询的兜底）
	defaultCity: "南京",

	// 默认城市的和风天气 Location ID（已知 ID 时可跳过城市查询接口）
	locationId: "101190101",

	// 和风天气 API Host（免费订阅：https://devapi.qweather.com，付费订阅：https://api.qweather.com）
	apiHost: "https://devapi.qweather.com",

	// 时钟时区（IANA Time Zone）
	timezone: "Asia/Shanghai",
};
