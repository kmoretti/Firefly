import type { DynamicConfig } from "@/types/dynamicConfig";

export const dynamicConfig: DynamicConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 动态头像和名称的跳转地址，支持站内路径或完整 URL
	profileUrl: "/about/",

	// 是否为每条动态启用评论，需要先在 commentConfig.ts 启用评论系统
	showComment: true,

	// 每页显示的动态数量
	itemsPerPage: 20,

	// 动态数据 json 地址，本地默认 "/api/dynamic.json"
	// 可改为第三方接口地址，如 "https://firefly.cuteleaf.cn/api/dynamic.json"
	// 数据结构可打开上方链接地址参考
	// 当 memos.enable 为 true 时，此配置会被忽略
	apiUrl: "/api/dynamic.json",

	// ========== Memos 配置 ==========
	// 启用后客户端通过 /api/memos.json 同源代理实时获取数据，apiUrl 配置将被忽略
	// 注意：Memos 0.30+ 需为实例设置 --instance-url 或环境变量 MEMOS_INSTANCE_URL，
	// 否则实例运行在私有模式，匿名 API 访问会返回 authentication required
	memos: {
		// 是否启用 Memos 数据源
		enable: true,

		// Memos 实例地址
		apiUrl: "https://mm.2005815.xyz",

		// Memos 用户标识，如 "users/你的memos用户名"，用于过滤指定用户的动态
		// 注意：需与 Memos API 返回的 creator 字段完全一致（区分大小写），例如实际用户名为 admin 时应为 "users/admin"，而非"users/Admin"
		parent: "users/kemiao",

		// 服务端预过滤：只保留包含任意一个标签的动态，留空则不筛选
		// 注意：与前端卡片标签点击筛选是两层机制——
		// 此处留空让全部数据进入前端，点击卡片上的标签即可交互式筛选
		tags: [],

		// 是否在正文中隐藏 "#标签" 文本（标签仍以独立 chips 形式展示在卡片上）
		// 开启后，说说正文里不会出现 "#项目" 这类标签文本；关闭则原样保留
		hideTagsInContent: true,
	},
};
