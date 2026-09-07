/** 右键菜单内置动作类型 */
export type ContextMenuActionType =
	| "history-back"
	| "history-forward"
	| "reload"
	| "back-to-top"
	| "back-to-comment"
	| "copy-url"
	| "toggle-theme"
	| "reading-mode"
	| "music-toggle-play"
	| "music-prev"
	| "music-next"
	| "music-volume"
	| "custom";

/** 右键菜单单项配置 */
export interface ContextMenuItemConfig {
	/** 内置动作类型；为 "custom" 或缺省时需提供 link 或 handler */
	action?: ContextMenuActionType;
	/** 自定义菜单文案；缺省时按 action 使用内置 i18n 文案 */
	label?: string;
	/** 自定义图标（astro-icon 图标名，如 "material-symbols:refresh-rounded"）；缺省时按 action 使用默认图标 */
	icon?: string;
	/** 自定义跳转链接（默认当前窗口打开，可配 newTab 改为新窗口打开） */
	link?: string;
	/** link 项是否新窗口打开，默认当前窗口 */
	newTab?: boolean;
	/** 自定义 JS 表达式，点击时在页面上下文执行（如 window.open("https://example.com")） */
	handler?: string;
	/** 该菜单项之前是否渲染分隔线 */
	divider?: boolean;
	/** 设为 false 时该项不渲染，默认显示 */
	show?: boolean;
}

/** 上下文感知扩展项开关 */
export interface ContextMenuContextItemsConfig {
	/** 设为 false 时禁用对应上下文扩展项，默认启用 */
	copySelection?: boolean;
	/** 设为 false 时禁用对应上下文扩展项，默认启用 */
	searchSelection?: boolean;
	/** 设为 false 时禁用对应上下文扩展项，默认启用 */
	openLink?: boolean;
	/** 设为 false 时禁用对应上下文扩展项，默认启用 */
	copyLink?: boolean;
	/** 设为 false 时禁用对应上下文扩展项，默认启用 */
	openImage?: boolean;
	/** 设为 false 时禁用对应上下文扩展项，默认启用 */
	copyImage?: boolean;
}

/** 右键菜单配置 */
export interface ContextMenuConfig {
	/** 是否启用自定义右键菜单；false 时组件完全不渲染 */
	enable: boolean;
	/** 启用自定义菜单的最小视口宽度（px），低于该宽度（移动端）使用浏览器原版菜单 */
	minWidth: number;
	/** 在输入类元素（input/textarea/contenteditable）内右键时是否展示原版菜单；true=原版菜单，false=自定义菜单 */
	showNativeInEditable: boolean;
	/** "搜索选中文本"的搜索引擎地址模板，{query} 会被替换为编码后的搜索词 */
	searchEngine: string;
	/** 上下文感知扩展项开关，缺省时全部启用 */
	contextItems?: ContextMenuContextItemsConfig;
	/** 菜单项列表，按声明顺序渲染 */
	items: ContextMenuItemConfig[];
}
