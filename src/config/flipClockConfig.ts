import type { FlipClockConfig } from "../types/flipClockConfig";

// 页脚翻页时钟组件配置
export const flipClockConfig: FlipClockConfig = {
	// 是否在页脚展示翻页时钟
	enable: true,

	// 是否显示“建站时间”标题文字
	showTitle: true,

	// 是否显示“秒”单位（false 时仅显示 日/时/分）
	showSeconds: true,

	// 建站起始时间（北京时间 UTC+8）。
	// 支持格式："YYYY-MM-DD" 或 "YYYY-MM-DD HH:mm"，如 "2024-11-01 12:00"。
	// 此处是翻页时钟专属的建站时间，与站点配置里的 siteStartDate 相互独立：
	// 留空（""）则回退读取 siteConfig.siteStartDate，填了则以这里为准。
	startDate: "2024-11-01 12:00",
};
