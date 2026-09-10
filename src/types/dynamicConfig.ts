export type DynamicConfig = {
	title?: string;
	description?: string;
	/** 动态头像和名称的跳转地址，支持站内路径或完整 URL */
	profileUrl?: string;
	showComment?: boolean;
	itemsPerPage?: number;
	// 动态数据 json 地址，本地默认 "/api/dynamic.json"
	// 可改为第三方接口地址，如 "https://b.kemeow.top/api/dynamic.json"
	// 数据结构可打开上方链接地址参考
	// 当 memos.enable 为 true 时，此配置会被忽略
	apiUrl?: string;
	// Memos 配置
	memos?: DynamicMemocsConfig;
	// 点赞配置（star-vote）；未配置或 enable 为 false 时不渲染点赞按钮
	like?: DynamicLikeConfig;
};

export type DynamicMemocsConfig = {
	/** 是否启用 Memos 数据源 */
	enable: boolean;
	/** Memos 实例地址，如 "https://memos.example.com" */
	apiUrl: string;
	/** Memos 用户标识，如 "users/xiaye"，用于过滤指定用户的动态 */
	parent?: string;
	/** 只保留包含任意一个标签的动态 */
	tags?: string[];
	/** 是否在渲染前从内容中移除 "#标签" 标记文本（标签仍由独立 chips 展示），默认开启 */
	hideTagsInContent?: boolean;
};

export type DynamicLikeConfig = {
	/** 是否启用动态点赞 */
	enable: boolean;
	/** 自部署 star-vote 实例地址，如 "https://vote.example.com" */
	apiUrl: string;
	/** 投票 id 前缀，最终投票 id 为 "<idPrefix>:<动态 id>"，默认 "dynamic" */
	idPrefix?: string;
};
