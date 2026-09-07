import type { ContextMenuConfig } from "@/types/contextMenuConfig";

export const contextMenuConfig: ContextMenuConfig = {
	enable: true,
	minWidth: 1024,
	// 在输入框/文本域/可编辑元素内右键时展示原版菜单；false 时展示自定义菜单
	showNativeInEditable: true,
	searchEngine: "https://www.baidu.com/s?wd={query}",
	// 上下文感知扩展项逐项开关（全部显式列出，便于站长发现与改配；false 时禁用对应项）
	contextItems: {
		// 有选中文本时：复制选中文本
		copySelection: true,
		// 有选中文本时：搜索选中内容
		searchSelection: true,
		// 右键链接时：新窗口打开
		openLink: true,
		// 右键链接时：复制链接地址
		copyLink: true,
		// 右键图片时：新窗口打开图片
		openImage: true,
		// 右键图片时：复制图片地址
		copyImage: true,
	},
	items: [
		{ action: "history-back" },
		{ action: "history-forward" },
		{ action: "reload", divider: true },
		{ action: "music-toggle-play" },
		{ action: "music-prev" },
		{ action: "music-next" },
		{ action: "music-volume" },
		{ action: "toggle-theme", divider: true },
		{ action: "reading-mode" },
		{ action: "back-to-comment" },
		{ action: "back-to-top" },
		{ action: "copy-url" },
	],
};
