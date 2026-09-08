export type FcircleArticle = {
	title: string;
	link: string;
	author: string;
	avatar: string;
	siteHost: string;
	created?: string;
	published?: number;
	summary?: string;
	images?: string[];
};

export type FcircleLinkStatus = {
	name: string;
	link: string;
	siteHost: string;
	avatar?: string;
	reachable?: boolean;
	crawlable?: boolean;
	latency?: number;
	updated?: string;
	staleDays?: number | null;
};

export type FcircleStats = {
	friendsNum: number;
	activeNum: number;
	articleNum: number;
	errorNum: number;
	lastUpdatedTime?: string;
};

export function normalizeStats(raw: unknown): FcircleStats | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const stat = (raw as Record<string, unknown>).statistical_data;
	if (!stat || typeof stat !== "object") return undefined;
	const record = stat as Record<string, unknown>;
	const num = (value: unknown): number =>
		typeof value === "number" && Number.isFinite(value) ? value : 0;
	return {
		friendsNum: num(record.friends_num),
		activeNum: num(record.active_num),
		articleNum: num(record.article_num),
		errorNum: num(record.error_num),
		lastUpdatedTime: safeString(record.last_updated_time),
	};
}

function safeString(value: unknown): string | undefined {
	return typeof value === "string" ? value.trim() : undefined;
}

function safeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function safeUrl(value: unknown): string | undefined {
	const raw = safeString(value);
	if (!raw) return undefined;
	try {
		const parsed = new URL(raw);
		return parsed.href;
	} catch {
		return undefined;
	}
}

export function extractHostname(url: string): string {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return url
			.replace(/^[a-z]+:\/\//i, "")
			.replace(/\/.*$/, "")
			.replace(/:.*$/, "")
			.toLowerCase();
	}
}

export function normalizeArticles(raw: unknown): FcircleArticle[] {
	if (!raw || typeof raw !== "object") return [];
	const root = raw as Record<string, unknown>;
	const list = Array.isArray(root.article_data)
		? root.article_data
		: Array.isArray(root)
			? (root as unknown[])
			: [];
	const articles: FcircleArticle[] = [];
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const link = safeUrl(record.link);
		const title = safeString(record.title);
		if (!link || !title) continue;
		const created = safeString(record.created);
		const summary =
			safeString(record.summary) ??
			safeString(record.excerpt) ??
			safeString(record.description);
		const images = safeStringArray(record.images);
		const singleImage = safeUrl(record.image);
		if (singleImage) images.push(singleImage);
		articles.push({
			title,
			link,
			author: safeString(record.author) || title,
			avatar: safeString(record.avatar) || "",
			siteHost: extractHostname(link),
			created,
			published: created
				? new Date(created.replace(" ", "T")).getTime()
				: undefined,
			summary: summary || undefined,
			images: images.length ? images : undefined,
		});
	}
	return articles.sort((a, b) => (b.published || 0) - (a.published || 0));
}

export function normalizeLinks(raw: unknown): FcircleLinkStatus[] {
	if (!raw || typeof raw !== "object") return [];
	const root = raw as Record<string, unknown>;
	const list = Array.isArray(root.link_data)
		? root.link_data
		: Array.isArray(root)
			? (root as unknown[])
			: [];
	const links: FcircleLinkStatus[] = [];
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const link = safeUrl(record.link);
		const name = safeString(record.name);
		if (!link || !name) continue;
		const latency = record.latency;
		const staleDays = record.stale_days;
		links.push({
			name,
			link,
			siteHost: extractHostname(link),
			avatar: safeString(record.avatar),
			reachable:
				typeof record.reachable === "boolean" ? record.reachable : undefined,
			crawlable:
				typeof record.crawlable === "boolean" ? record.crawlable : undefined,
			latency:
				typeof latency === "number" && Number.isFinite(latency)
					? latency
					: undefined,
			updated: safeString(record.updated),
			staleDays:
				typeof staleDays === "number" && Number.isFinite(staleDays)
					? staleDays
					: null,
		});
	}
	return links;
}

export async function fetchJson(
	url: string,
	timeoutMs: number,
): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		return (await response.json()) as unknown;
	} finally {
		clearTimeout(timer);
	}
}
