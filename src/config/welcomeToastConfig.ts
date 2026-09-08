import type { WelcomeToastConfig } from "../types/welcomeToastConfig";

// 腾讯位置服务 Key 从环境变量 TENCENT_MAPS_KEY 读取
// （Vite/Astro 走 import.meta.env，构建脚本回退 process.env；未配置时为空，功能自动停用）
function readTencentMapKeyEnv(): string {
	try {
		const raw = (import.meta.env as Record<string, unknown>).TENCENT_MAPS_KEY;
		if (typeof raw === "string" && raw.trim() !== "") {
			return raw.trim();
		}
	} catch {
		// tsx 构建脚本等 Node 环境没有 import.meta.env，走下方 process.env 回退
	}
	return typeof process === "undefined"
		? ""
		: (process.env.TENCENT_MAPS_KEY ?? "").trim();
}

export const welcomeToastConfig: WelcomeToastConfig = {
	// 是否启用欢迎 IP 提示功能
	enable: true,

	// 腾讯位置服务 Key（用于根据 IP 定位访客位置），在 .env 或 CI secret 中配置 TENCENT_MAPS_KEY
	tencentMapKey: readTencentMapKeyEnv(),

	// 提示冷却时间（分钟），同一访客在冷却期内不重复提示
	cooldownMinutes: 30,

	// 提示副标题，留空则使用 i18n 默认模板
	subtitle: "",
};
