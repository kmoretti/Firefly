export type DecennialThresholds = {
	originalPosts: number; // 履约事项：至少 N 篇原创
	posts: number; // 成就：发布 N 篇原创文章
	words1: number; // 成就：总字数达 N 字
	words2: number; // 成就：总字数达 N 字
	days1: number; // 成就：正常运行 N 天
	days2: number; // 成就：正常运行 N 天
	promiseMonths: number; // 履约事项：N 个月内有新文章
};

export type DecennialConfig = {
	enable: boolean;
	siteStartDate: string; // YYYY-MM-DD
	thresholds: DecennialThresholds;
};
