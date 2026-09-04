export type SkillItem = {
	name: string;
	icon?: string;
};

export type AboutIntroConfig = {
	tips: string;
	titleLines: [string, string];
	titleEnd: string;
	rotatingWords: string[];
};

export type AboutJourneyConfig = {
	tips: string;
	title: string;
	description: string;
};

export type AboutPageConfig = {
	enable: boolean;
	modules: {
		profile: boolean;
		intro: boolean;
		skills: boolean;
		journey: boolean;
	};
	authorTags: {
		left: string[];
		right: string[];
	};
	intro: AboutIntroConfig;
	skills: SkillItem[];
	journey: AboutJourneyConfig;
};
