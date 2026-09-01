// 友链配置
export type FriendLink = {
	title: string; // 友链标题
	imgurl: string; // 头像图片URL
	desc: string; // 友链描述
	siteurl: string; // 友链地址
	tags?: string[]; // 标签数组
	group?: string;
	weight: number; // 权重，数字越大排序越靠前
	enabled: boolean; // 是否启用
};

export type RemoteFriendsConfig = {
	enable: boolean;
	linkYmlUrl: string;
	latencyJsonUrl: string;
};

export type TombstoneConfig = {
	enable: boolean; // 是否启用友链墓碑
	url: string; // 墓碑数据源（link-false.yml）
	title: string; // 墓碑标题
};

export type FriendsPageConfig = {
	title?: string; // 页面标题，留空则使用 i18n 中的翻译
	description?: string; // 页面描述，留空则使用 i18n 中的翻译
	showCustomContent?: boolean; // 是否显示自定义内容（friends.mdx）
	showAllFriends?: boolean;
	showLocalFriends?: boolean; // 是否显示本地配置的友链
	showComment?: boolean; // 是否显示评论区，默认 true
	randomizeSort?: boolean; // 是否打乱排序，如果为 true，将忽略 weight，随机排序
};
