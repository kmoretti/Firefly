import type { AboutPageConfig } from "../types/aboutConfig";

export const aboutConfig: AboutPageConfig = {
	enable: true,
	modules: {
		profile: true,
		greeting: true,
		introduction: true,
		skills: true,
		journey: true,
	},
	authorTags: {
		left: ["💻 拥抱开源", "🚀 追求极致", "📚 持续学习", "🧠 热爱思考"],
		right: ["☕ 咖啡续命", "🎵 灵感随行", "📷 记录美好", "🌱 保持好奇"],
	},
	greeting: "你好！欢迎来到我的小站。",
	introduction: "这里记录技术实践、阅读思考与数字世界里的日常探索。",
	motto: "保持好奇，持续生长。",
	skills: [
		{ name: "Astro", icon: "simple-icons:astro" },
		{ name: "TypeScript", icon: "simple-icons:typescript" },
		{ name: "Svelte", icon: "simple-icons:svelte" },
		{ name: "Tailwind CSS", icon: "simple-icons:tailwindcss" },
	],
};
