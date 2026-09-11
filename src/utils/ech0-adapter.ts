/**
 * Ech0 API 客户端适配器
 * 从自部署 Ech0 实例获取说说并转换为动态系统格式（与 memos-adapter 同构）
 */
import { Marked } from "marked";
import type { DynamicEntry, DynamicImage } from "./memos-adapter";

interface EchoTag {
	id: string;
	name: string;
}

interface EchoFile {
	url: string;
	name?: string;
	contentType?: string;
}

interface EchoExtension {
	type: string;
	payload: Record<string, unknown>;
}

interface Echo {
	id: string;
	content: string;
	username?: string;
	echo_files?: EchoFile[];
	extension?: EchoExtension | null;
	tags?: EchoTag[];
	fav_count?: number;
	created_at: number;
}

interface EchoQueryResponse {
	code: number;
	msg: string;
	data: {
		total: number;
		items: Echo[];
	};
}

/**
 * 专用 marked 实例，与 memos-adapter 保持一致：
 * GFM + 单换行转 <br>，链接新标签页打开；图片置空、单独提取进画廊
 * 内嵌 HTML 由 marked 原样保留输出
 */
const ech0Marked = new Marked({ gfm: true, breaks: true });
ech0Marked.use({
	renderer: {
		link({ href, title, tokens }) {
			const text = this.parser.parseInline(tokens);
			const titleAttr = title ? ` title="${title}"` : "";
			return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
		},
		image() {
			return "";
		},
	},
});

/** 从内容中提取纯文本用于搜索 */
function extractPlainText(content: string): string {
	return content
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~[\]()-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** 从 Markdown 内容图片与 echo_files 附件中提取图片 */
function extractImages(echo: Echo, apiUrl: string): DynamicImage[] {
	const images: DynamicImage[] = [];

	const tokens = ech0Marked.lexer(echo.content);
	ech0Marked.walkTokens(tokens, (token) => {
		if (token.type !== "image") return;
		let src = token.href;
		if (!src.startsWith("http") && !src.startsWith("//")) {
			src = `${apiUrl.replace(/\/+$/, "")}${src.startsWith("/") ? "" : "/"}${src}`;
		}
		images.push({
			alt: token.text || "",
			src,
			title: token.title || undefined,
		});
	});

	for (const file of echo.echo_files || []) {
		images.push({
			alt: file.name || "",
			src: file.url.startsWith("http")
				? file.url
				: `${apiUrl.replace(/\/+$/, "")}${file.url}`,
			title: file.name || undefined,
		});
	}

	return images;
}

/**
 * 规整扩展字段：
 * - LOCATION 不走卡片，映射到卡片的位置元信息行
 * - 其余类型结构化透传给前端渲染器
 */
function resolveExtension(
	extension: EchoExtension | null | undefined,
): { extension?: { type: string; payload: Record<string, unknown> }; location: string } {
	const ext = extension;
	if (!ext?.type || !ext.payload) return { location: "" };

	if (ext.type === "LOCATION") {
		const placeholder = String(ext.payload.placeholder ?? "").trim();
		return { location: placeholder };
	}
	return { extension: { type: ext.type, payload: ext.payload }, location: "" };
}

/**
 * 单页查询，带瞬时网络故障自动重试（同 memos-adapter 策略）
 * 超时/中止错误不重试：上游响应过慢时重试只会成倍拖长代理端点等待时间
 */
async function fetchEchoPage(
	apiUrl: string,
	body: Record<string, unknown>,
): Promise<{ items: Echo[]; total: number }> {
	const maxAttempts = 3;
	for (let attempt = 1; ; attempt++) {
		try {
			const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/echo/query`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(15_000),
			});
			if (!response.ok) {
				const errorText = await response.text().catch(() => "");
				console.error(`[Ech0 API] ${response.status}: ${errorText}`);
				throw new Error(`Ech0 API error: ${response.status}`);
			}
			const data: EchoQueryResponse = await response.json();
			return { items: data.data?.items || [], total: data.data?.total || 0 };
		} catch (error) {
			const timeout =
				error instanceof DOMException &&
				(error.name === "TimeoutError" || error.name === "AbortError");
			if (attempt >= maxAttempts || timeout) throw error;
			console.warn(
				`[Ech0 API] 网络瞬时故障（第 ${attempt}/${maxAttempts - 1} 次重试）: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		}
	}
}

/**
 * 从 Ech0 实例全量拉取说说并转换为动态格式
 * 服务端单页上限 100，按页循环直至取满 total 或出现短页
 */
export async function fetchEch0(
	apiUrl: string,
	options?: { pageSize?: number; maxPages?: number },
): Promise<DynamicEntry[]> {
	const pageSize = Math.min(options?.pageSize || 100, 100);
	const maxPages = options?.maxPages || 10;

	let allEchos: Echo[] = [];
	let total = Infinity;
	for (let page = 1; page <= maxPages; page++) {
		const { items, total: queryTotal } = await fetchEchoPage(apiUrl, {
			page,
			pageSize,
			search: "",
			tagIds: [],
			sortBy: "created_at",
			sortOrder: "desc",
			dateFrom: 0,
			dateTo: 0,
		});
		allEchos = allEchos.concat(items);
		total = queryTotal || allEchos.length;
		if (allEchos.length >= total || items.length < pageSize) break;
	}

	return allEchos
		.map((echo): DynamicEntry => {
			const published = echo.created_at * 1000;
			const html = ech0Marked.parse(echo.content) as string;
			const images = extractImages(echo, apiUrl);
			const tags = (echo.tags || []).map((tag) => tag.name);
			const { extension, location } = resolveExtension(echo.extension);
			const searchText = [extractPlainText(echo.content), location]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase();
			return {
				id: echo.id,
				published,
				html,
				images,
				searchText,
				location: location || undefined,
				tags,
				extension,
				likes: echo.fav_count ?? undefined,
			};
		})
		.sort((a, b) => b.published - a.published);
}
