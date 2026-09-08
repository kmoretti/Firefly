import type { DecennialConfig } from "../types/decennialConfig";

export const decennialConfig: DecennialConfig = {
	enable: true,
	siteStartDate: "2024-11-01",
	thresholds: {
		originalPosts: 10,
		posts: 100,
		words1: 100_000,
		words2: 1_000_000,
		days1: 100,
		days2: 1000,
		promiseMonths: 6,
	},
};
