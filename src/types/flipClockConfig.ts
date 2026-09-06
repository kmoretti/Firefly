export type FlipClockConfig = {
	// 是否在页脚展示翻页时钟
	enable?: boolean;
	// 是否显示“建站时间”标题文字
	showTitle?: boolean;
	// 是否显示“秒”单位（false 时仅显示 日/时/分）
	showSeconds?: boolean;
	// 建站起始日期（格式: "YYYY-MM-DD"），独立于站点配置里的 siteStartDate
	startDate?: string;
};
