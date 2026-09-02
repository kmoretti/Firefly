export type SkillItem = {
	name: string;
	icon?: string;
};

export type AboutPageConfig = {
	enable: boolean;
	modules: {
		profile: boolean;
		greeting: boolean;
		introduction: boolean;
		skills: boolean;
		journey: boolean;
	};
	authorTags: {
		left: string[];
		right: string[];
	};
	greeting: string;
	introduction: string;
	motto: string;
	skills: SkillItem[];
};
