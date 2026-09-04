import type { AboutPageConfig } from "../types/aboutConfig";

export const aboutConfig: AboutPageConfig = {
	enable: true,
	modules: {
		profile: true,
		intro: true,
		skills: true,
		journey: true,
	},
	authorTags: {
		left: ["💻 拥抱开源", "💻 ai编程", "📚 持续学习", "🧠 热爱思考"],
		right: ["🎬 静态博客", "📖 小说爱好者", "📷 记录美好", "🌱 保持好奇"],
	},
	intro: {
		tips: "追求",
		titleLines: ["源于", "热爱而去"],
		titleEnd: "感受",
		rotatingWords: ["学习", "生活", "程序", "体验"],
	},
	skills: [
		{ name: "Astro", icon: "simple-icons:astro" },
		{ name: "TypeScript", icon: "simple-icons:typescript" },
		{ name: "Svelte", icon: "simple-icons:svelte" },
		{ name: "Tailwind CSS", icon: "simple-icons:tailwindcss" },
	],
	journey: {
		tips: "心路历程",
		title: "为何而建站",
		description: "这里记录着我的技术实践、博客魔改经历与生活分享。",
	},
};
