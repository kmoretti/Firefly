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
		left: ["💻 拥抱开源", "💻 ai编程", "📚 持续学习", "🧠 热爱思考"],
		right: ["🎬 静态博客", "📖 小说爱好者", "📷 记录美好", "🌱 保持好奇"],
	},
	greeting: "你好！欢迎来到我的小站。",
	introduction: "这里记录者我的一些文字，包括技术实践、博客魔改经历和字样分享。",
	motto: "人生如逆旅，我亦是行人。",
	skills: [
		{ name: "Astro", icon: "simple-icons:astro" },
		{ name: "TypeScript", icon: "simple-icons:typescript" },
		{ name: "Svelte", icon: "simple-icons:svelte" },
		{ name: "Tailwind CSS", icon: "simple-icons:tailwindcss" },
	],
};
