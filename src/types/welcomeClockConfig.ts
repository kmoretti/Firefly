export type WelcomeClockConfig = {
	// 卡片标题，留空则走 i18n 默认标题
	title?: string;
	// 默认城市名称（用于 geo 城市查询），留空则不显示天气
	defaultCity?: string;
	// 默认城市的和风 Location ID（留空则通过 defaultCity 在线查询）
	locationId?: string;
	// 和风天气 API 主机（免费订阅使用 devapi.qweather.com，付费订阅使用 api.qweather.com）
	apiHost?: string;
	// 时间显示时区（IANA 时区名），默认东八区
	timezone?: string;
};
