import type {
	FriendLink,
	FriendsPageConfig,
	RemoteFriendsConfig,
	TombstoneConfig,
} from "../types/friendsConfig";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const remoteFriendsConfig: RemoteFriendsConfig = {
	enable: true,
	linkYmlUrl:
		"https://jsd.268682.xyz/gh/kmoretti/butterfly-link-check@main/link.yml",
	latencyJsonUrl: "https://fc.081531.xyz/link.json",
};

// 友链墓碑配置
export const tombstoneConfig: TombstoneConfig = {
	// 是否启用友链墓碑
	enable: true,
	// 墓碑数据源（友链检测失败/失效的站点列表）
	url: "https://jsd.268682.xyz/gh/kmoretti/butterfly-link-check@main/link-false.yml",
	// 墓碑标题
	title: "🪵 友链墓碑 · 相逢何必曾相识",
};

export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	showAllFriends: true,

	// 是否显示本地配置的友链
	showLocalFriends: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,
};

// 友链配置
export const friendsConfig: FriendLink[] = [
	{
		title: "夏夜流萤",
		imgurl:
			"https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640",
		desc: "飞萤之火自无梦的长夜亮起，绽放在终竟的明天。",
		siteurl: "https://blog.cuteleaf.cn",
		tags: ["Blog"],
		group: "个人博客",
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Firefly Docs",
		imgurl: "https://docs-b.kemeow.top/logo.png",
		desc: "Firefly主题模板文档",
		siteurl: "https://docs-b.kemeow.top",
		tags: ["Docs"],
		group: "文档与资源",
		weight: 9,
		enabled: true,
	},
	{
		title: "Astro",
		imgurl: "https://avatars.githubusercontent.com/u/44914786?v=4&s=640",
		desc: "The web framework for content-driven websites. ⭐️ Star to support our work!",
		siteurl: "https://github.com/withastro/astro",
		tags: ["Framework"],
		group: "技术项目",
		weight: 8,
		enabled: true,
	},
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
