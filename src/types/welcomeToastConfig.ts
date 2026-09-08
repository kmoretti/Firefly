export type WelcomeToastConfig = {
	// 是否启用欢迎 IP 提示功能
	enable: boolean;
	// 腾讯位置服务 Key（用于根据 IP 定位访客位置）
	tencentMapKey: string;
	// 提示冷却时间（分钟），同一访客在冷却期内不重复提示
	cooldownMinutes: number;
	// 提示副标题，留空则使用 i18n 默认模板
	subtitle: string;
};
