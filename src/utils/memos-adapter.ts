/**
 * Memos API 客户端适配器
 * 直接从 Memos API 获取数据并转换为动态系统格式
 * @author: CuteLeaf <xiaye@msn.com>
 */
import { Marked } from "marked";

interface MemoAttachment {
	name: string;
	filename: string;
	type: string;
	externalLink: string;
}

interface MemoLocation {
	placeholder?: string;
}

interface Memo {
	name: string;
	state: string;
	creator: string;
	createTime: string;
	updateTime: string;
	content: string;
	visibility: string;
	pinned: boolean;
	attachments: MemoAttachment[];
	location?: MemoLocation;
	tags?: string[];
}

interface MemosApiResponse {
	memos: Memo[];
	nextPageToken: string;
}

export interface DynamicImage {
	alt: string;
	src: string;
	title?: string;
}

export interface DynamicEntry {
	id: string;
	published: number;
	html: string;
	images: DynamicImage[];
	searchText: string;
	pinned?: boolean;
	location?: string;
	/** 说说携带的标签，供前端卡片展示与点击筛选 */
	tags?: string[];
}

/**
 * 专用的 marked 实例，用于把 Memos 的 Markdown 渲染为 HTML
 * 启用 GFM 与单换行转 <br>（贴近 Memos 的社交化渲染效果），
 * 链接默认新标签页打开并防止反向标签页劫持；
 * 图片由 extractImages 单独提取并追加到内容后，故此处直接渲染为空
 */
const memosMarked = new Marked({ gfm: true, breaks: true });
memosMarked.use({
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

/**
 * 将 Memos 的 Markdown 内容转换为 HTML
 * 图片语法由 marked 的 image 渲染器置空，避免重复渲染
 */
function markdownToHtml(markdown: string): string {
	return memosMarked.parse(markdown) as string;
}

/**
 * 从内容中提取纯文本用于搜索
 */
function extractPlainText(content: string): string {
	return content
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~[\]()-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * 转义正则表达式中的特殊字符，用于把标签名安全地嵌入匹配模式
 */
function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 从内容中移除与 Memos 标签精确匹配的 "#标签" 标记文本
 * 仅移除标签后紧跟空白、Unicode 标点或行尾的匹配，
 * 避免误删 "#吐槽了" 这类以标签名开头但并非标签的普通文本
 */
function stripTagsFromContent(content: string, tags: string[]): string {
	let result = content;
	for (const tag of tags) {
		const escaped = escapeRegExp(tag);
		result = result.replace(
			new RegExp(`#${escaped}(?=[\\s\\p{P}]|$)`, "gu"),
			"",
		);
	}
	return result;
}

/**
 * 从 Memos 内容中提取图片
 * 使用 marked 的词法分析器定位图片 token，可正确处理含括号的图片地址与可选标题
 */
function extractImages(memo: Memo, memosApiUrl: string): DynamicImage[] {
	const images: DynamicImage[] = [];

	// 从 Markdown 内容中提取图片
	const tokens = memosMarked.lexer(memo.content);
	memosMarked.walkTokens(tokens, (token) => {
		if (token.type !== "image") return;
		let src = token.href;
		// 处理相对路径
		if (!src.startsWith("http") && !src.startsWith("//")) {
			src = `${memosApiUrl}${src.startsWith("/") ? "" : "/"}${src}`;
		}
		images.push({
			alt: token.text || "",
			src,
			title: token.title || undefined,
		});
	});

	// 从 Memos 附件中提取图片
	if (memo.attachments) {
		for (const attachment of memo.attachments) {
			if (attachment.type.startsWith("image/")) {
				// Memos 文件服务路径: /file/attachments/{id}/{filename}
				const attachmentId = attachment.name.split("/").pop() || "";
				const src =
					attachment.externalLink ||
					`${memosApiUrl}/file/attachments/${attachmentId}/${attachment.filename}`;
				images.push({
					alt: attachment.filename,
					src,
					title: attachment.filename,
				});
			}
		}
	}

	return images;
}

// 请求去重缓存，避免同页面多个组件重复请求
const pendingRequests = new Map<string, Promise<DynamicEntry[]>>();

/**
 * 从 Memos API 获取数据并转换为动态格式
 */
export async function fetchMemos(
	memosApiUrl: string,
	options?: {
		pageSize?: number;
		maxPages?: number;
		parent?: string;
		tags?: string[];
		/** 是否在渲染前从内容中移除 "#标签" 标记文本，默认开启 */
		hideTagsInContent?: boolean;
	},
): Promise<DynamicEntry[]> {
	const cacheKey = `${memosApiUrl}:${options?.parent || ""}`;
	const pending = pendingRequests.get(cacheKey);
	if (pending) return pending;

	const promise = fetchMemosInternal(memosApiUrl, options);
	pendingRequests.set(cacheKey, promise);
	promise.finally(() => pendingRequests.delete(cacheKey));
	return promise;
}

async function fetchMemosInternal(
	memosApiUrl: string,
	options?: {
		pageSize?: number;
		maxPages?: number;
		parent?: string;
		tags?: string[];
		/** 是否在渲染前从内容中移除 "#标签" 标记文本，默认开启 */
		hideTagsInContent?: boolean;
	},
): Promise<DynamicEntry[]> {
	const pageSize = Math.min(options?.pageSize || 1000, 1000);
	const maxPages = options?.maxPages || 10;
	const parent = options?.parent || "";
	const hideTagsInContent = options?.hideTagsInContent ?? true;
	const allMemos: Memo[] = [];
	let pageToken = "";

	for (let page = 0; page < maxPages; page++) {
		const url = new URL(`${memosApiUrl}/api/v1/memos`);
		url.searchParams.set("pageSize", String(pageSize));
		if (parent) {
			// Memos 0.30 起 ListMemos 不再支持 parent 查询参数，改用官方 filter 表达式过滤指定用户
			url.searchParams.set("filter", `creator == "${parent}"`);
		}
		if (pageToken) {
			url.searchParams.set("pageToken", pageToken);
		}

		const response = await fetch(url.toString(), {
			headers: { Accept: "application/json" },
			// 单页请求超时，避免上游无响应时代理端点无限挂起
			signal: AbortSignal.timeout(15_000),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "");
			console.error(`[Memos API] ${response.status}: ${errorText}`);
			throw new Error(`Memos API error: ${response.status}`);
		}

		const data: MemosApiResponse = await response.json();
		allMemos.push(...(data.memos || []));

		if (!data.nextPageToken) break;
		pageToken = data.nextPageToken;
	}

	// filter 表达式已在服务端按 creator 过滤，这里仍按 creator 二次过滤兜底，
	// 避免不同 Memos 版本的 filter 行为差异导致显示其他用户的动态
	const userFilteredMemos = parent
		? allMemos.filter((memo) => memo.creator === parent)
		: allMemos;
	const tags = options?.tags?.map((tag) => tag.trim()).filter(Boolean) || [];
	const filteredMemos = tags.length
		? userFilteredMemos.filter((memo) =>
				tags.some((tag) => memo.tags?.includes(tag)),
			)
		: userFilteredMemos;

	return filteredMemos
		.filter((memo) => memo.state === "NORMAL")
		.map((memo) => {
			const id = memo.name.split("/").pop() || "";
			const published = new Date(memo.createTime).getTime();
			const memoTags = memo.tags || [];
			// 隐藏标签时在渲染前移除内容中的 "#标签" 文本，标签仍由独立 chips 展示
			const content = hideTagsInContent
				? stripTagsFromContent(memo.content, memoTags)
				: memo.content;
			const html = markdownToHtml(content);
			const images = extractImages(memo, memosApiUrl);
			const location = memo.location?.placeholder?.trim() || "";
			const searchText = [extractPlainText(memo.content), location]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase();
			const pinned = memo.pinned || false;
			const tags = memoTags;

			return {
				id,
				published,
				html,
				images,
				searchText,
				pinned,
				location,
				tags,
			};
		})
		.sort((a, b) => {
			// 置顶优先，然后按发布时间降序
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return b.published - a.published;
		});
}
