import type { FpsConfig } from "../types/fpsConfig";

// FPS 帧率监视器配置
// 用于在页面角落实时显示当前帧率，方便排查性能问题
// 可见性通过 localStorage 持久化，键名见 storageKey

export const fpsConfig: FpsConfig = {
	// 是否启用 FPS 帧率监视器，false 时完全不渲染任何输出
	enable: true,

	// 无 localStorage 记录时的默认可见性
	defaultVisible: true,

	// localStorage 键名，值为 "true"/"false" 字符串
	storageKey: "fps-monitor-visible",

	// 固定定位偏移（CSS 长度值）
	position: {
		// 距视口右侧的偏移
		right: "1rem",
		// 距视口底部的偏移
		bottom: "1rem",
	},

	// 帧率分级阈值：fps >= good 为良好，warn <= fps < good 为一般，fps < warn 为较差
	thresholds: {
		good: 55,
		warn: 30,
	},

	// 层叠顺序
	zIndex: 1000,
};
