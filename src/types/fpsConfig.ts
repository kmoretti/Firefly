/** FPS 帧率监视器配置 */
export interface FpsConfig {
	/** 是否启用 FPS 帧率监视器；false 时完全不渲染任何输出 */
	enable: boolean;
	/** 无 localStorage 记录时的默认可见性 */
	defaultVisible: boolean;
	/** localStorage 键名，值为 "true"/"false" 字符串 */
	storageKey: string;
	/** 固定定位偏移（CSS 长度值） */
	position: {
		/** 距视口右侧的偏移 */
		right: string;
		/** 距视口底部的偏移 */
		bottom: string;
	};
	/** 帧率分级阈值：fps >= good 为良好，warn <= fps < good 为一般，fps < warn 为较差 */
	thresholds: {
		good: number;
		warn: number;
	};
	/** 层叠顺序 */
	zIndex: number;
}
