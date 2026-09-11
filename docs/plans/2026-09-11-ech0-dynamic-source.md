# Ech0 动态数据源接入实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为动态页面新增 Ech0（自部署于 https://m.081531.xyz）数据源，完整复用现有说说卡片流：Markdown/HTML 渲染、扩展卡片（音乐/推文/视频/网页/GitHub）、标签点击筛选、搜索、年份筛选、侧边栏组件、原生点赞。

**Architecture:** 完整复刻 memos 模式：新增服务端适配器 `ech0-adapter.ts` 把 Ech0 API 数据转换为统一的 `DynamicEntry` 格式，经同源代理端点 `/api/ech0.json`（运行时按需执行，60s 缓存 + SWR）供前端消费；扩展卡片数据结构化透传，由新增客户端渲染器 `<dynamic-extension>` 自定义元素统一绘制；点赞按数据源分流（ech0 走原生点赞，其余走 star-vote）。

**Tech Stack:** Astro API 端点、marked（Markdown 渲染，与 memos-adapter 一致）、原生 Web Component、Meting API（音乐解析）、Twitter widgets.js（推文嵌入）。

**已确认的设计决策（grill-me 收敛）：**

1. 服务端同源代理，复刻 memos 模式；部署后无需重建即近实时更新（缓存窗口内最多延迟约 1 分钟）。
2. 数据源优先级：`ech0.enable` > `memos.enable` > `apiUrl`，写入配置注释。
3. `DynamicEntry` 新增可选 `extension?: { type; payload }` 与 `likes?: number`，适配器透传，客户端统一渲染。
4. MUSIC 迷你播放卡：Meting API（复用 `musicConfig` 的 api 列表）解析封面/歌名/歌手/音频直链 + 原生 `<audio>`，失败降级链接卡；不做歌词。
5. TWEET 真实嵌入：懒加载 widgets.js，6 秒超时降级为 @username 链接卡。
6. 点赞：ech0 条目（带 `likes` 字段）走原生 `PUT /api/echo/like/{id}`，其他数据源回落 star-vote；localStorage 防重复统一生效。
7. LOCATION 扩展不渲染卡片：映射到现有卡片的位置元信息行（`entry.location`），避免重复展示。
8. GITHUBPROJ 用自绘卡片（跳转链接 + 仓库名），不依赖 GithubCardManager（其构建缓存与增强时序均不可靠）。

**Ech0 API 事实（已实测线上实例）：**

- `POST /api/echo/query`，body `{page, pageSize(≤100), search, tagIds, sortBy: "created_at", sortOrder: "desc", dateFrom: 0, dateTo: 0}` → `{code: 1, msg, data: {total, items}}`；匿名仅返回公开说说
- Echo: `{id, content(markdown+内嵌HTML), username, echo_files: [{url, name?, contentType?, width?, height?}], extension?: {type, payload}, tags: [{id, name}], fav_count, created_at(unix 秒)}`
- 扩展 payload：MUSIC `{url}`、VIDEO `{videoId}`（BV 号或 YouTube id）、GITHUBPROJ `{repoUrl}`、WEBSITE `{site, title}`、LOCATION `{latitude, longitude, placeholder}`、TWEET `{url, username}`
- CORS 开放，但走服务端代理后无需关心

---

### Task 1: 扩展类型定义

**Files:**
- Modify: `src/types/dynamicConfig.ts`
- Modify: `src/utils/memos-adapter.ts`（`DynamicEntry` 是动态系统的统一契约，新字段加在这里）

**Step 1: `src/types/dynamicConfig.ts` 末尾追加 Ech0 配置类型**

```ts
export type DynamicEch0Config = {
	/** 是否启用 Ech0 数据源（优先级高于 memos 与 apiUrl） */
	enable: boolean;
	/** 自部署 Ech0 实例地址，如 "https://m.081531.xyz" */
	apiUrl: string;
	/** 单页拉取条数，服务端上限 100，默认 100 */
	pageSize?: number;
	/** 最大翻页数，默认 10 */
	maxPages?: number;
};
```

在 `DynamicConfig` 的 `like?: DynamicLikeConfig;` 之后追加：

```ts
	// Ech0 数据源配置；enable 为 true 时优先于 memos 与 apiUrl 生效
	ech0?: DynamicEch0Config;
```

**Step 2: `src/utils/memos-adapter.ts` 的 `DynamicEntry` 增加两个可选字段**

在 `tags?: string[];` 之后追加：

```ts
	/** Ech0 扩展卡片（MUSIC/VIDEO/GITHUBPROJ/WEBSITE/TWEET），结构化透传给前端渲染 */
	extension?: { type: string; payload: Record<string, unknown> };
	/** 原生点赞数（Ech0 fav_count）；存在时点赞按钮走原生 provider */
	likes?: number;
```

**Step 3: 验证**

Run: `pnpm type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/types/dynamicConfig.ts src/utils/memos-adapter.ts
git commit -m "feat: add ech0 source types and dynamic entry extension fields"
```

---

### Task 2: 添加 Ech0 配置

**Files:**
- Modify: `src/config/dynamicConfig.ts`

**Step 1: 在 `like` 配置块之后追加**

```ts
	// ========== Ech0 数据源配置 ==========
	// 启用后动态页通过同源代理 /api/ech0.json 实时获取 Ech0 说说
	// 优先级：ech0.enable > memos.enable > apiUrl（本地/第三方 json）
	ech0: {
		// 是否启用 Ech0 数据源（启用后覆盖 Memos 数据源）
		enable: true,

		// 自部署 Ech0 实例地址
		apiUrl: "https://m.081531.xyz",

		// 单页拉取条数（服务端上限 100）
		pageSize: 100,

		// 最大翻页数
		maxPages: 10,
	},
```

**Step 2: 验证**

Run: `pnpm type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/config/dynamicConfig.ts
git commit -m "feat: enable ech0 dynamic source config"
```

---

### Task 3: 新建 `ech0-adapter.ts`

**Files:**
- Create: `src/utils/ech0-adapter.ts`

**Step 1: 写入完整实现**

```ts
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
			src: file.url.startsWith("http") ? file.url : `${apiUrl.replace(/\/+$/, "")}${file.url}`,
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

/** 单页查询，带瞬时网络故障重试（同 memos-adapter 策略） */
async function fetchEchoPage(
	apiUrl: string,
	body: Record<string, unknown>,
): Promise<Echo[]> {
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
			return data.data?.items || [];
		} catch (error) {
			const timeout =
				error instanceof DOMException &&
				(error.name === "TimeoutError" || error.name === "AbortError");
			if (attempt >= maxAttempts || timeout) throw error;
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
		const items = await fetchEchoPage(apiUrl, {
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
		if (allEchos.length >= total || items.length < pageSize) break;
		// total 在首页响应后更新，用于下一轮终止判定
		total = Math.max(total, 0);
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
```

**Step 2: 验证**

Run: `pnpm type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/utils/ech0-adapter.ts
git commit -m "feat: add ech0 api adapter for dynamic entries"
```

---

### Task 4: 同源代理端点 `/api/ech0.json`

**Files:**
- Create: `src/pages/api/ech0.json.ts`

**Step 1: 写入完整实现（镜像 memos.json.ts）**

```ts
import { dynamicConfig } from "@/config";
import { fetchEch0 } from "@/utils/ech0-adapter";

export async function GET(): Promise<Response> {
	const ech0 = dynamicConfig.ech0;
	if (!ech0?.enable || !ech0.apiUrl) {
		return new Response(JSON.stringify([]), {
			status: 404,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	}

	try {
		const data = await fetchEch0(ech0.apiUrl, {
			pageSize: ech0.pageSize,
			maxPages: ech0.maxPages,
		});
		return new Response(JSON.stringify(data), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const cause =
			error instanceof Error && error.cause instanceof Error
				? ` (${error.cause.message})`
				: "";
		console.error(`[ech0.json] 上游请求失败: ${message}${cause}`);
		return new Response(
			JSON.stringify({ error: "Ech0 service unavailable", detail: message }),
			{
				status: 502,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			},
		);
	}
}
```

**Step 2: 验证（直接实测代理输出）**

Run: `pnpm dev` 后请求 `http://localhost:4321/api/ech0.json`。
Expected: 返回数组，元素含 `id/published/html/images/tags/likes`，无 private 条目。

**Step 3: Commit**

```bash
git add src/pages/api/ech0.json.ts
git commit -m "feat: add ech0 same-origin proxy endpoint"
```

---

### Task 5: 扩展卡片 i18n 文案

**Files:**
- Modify: `src/i18n/i18nKey.ts`
- Modify: `src/i18n/languages/zh_CN.ts`、`zh_TW.ts`、`en.ts`、`ja.ts`、`ko.ts`、`ru.ts`

**Step 1: `i18nKey.ts` 在 `dynamicLike` 之后追加**

```ts
	dynamicExtWebsite = "dynamicExtWebsite",
	dynamicExtGithub = "dynamicExtGithub",
	dynamicExtVideo = "dynamicExtVideo",
	dynamicExtMusic = "dynamicExtMusic",
	dynamicExtTweet = "dynamicExtTweet",
	dynamicExtJump = "dynamicExtJump",
```

**Step 2: 六个语言文件各加六行**

| 文件 | Website | GitHub | Video | Music | Tweet | Jump |
|------|---------|--------|-------|-------|-------|------|
| `zh_CN.ts` | 网页 | GitHub | 视频 | 音乐 | 推文 | 跳转 |
| `zh_TW.ts` | 網頁 | GitHub | 影片 | 音樂 | 推文 | 跳轉 |
| `en.ts` | Website | GitHub | Video | Music | Tweet | Open |
| `ja.ts` | ウェブ | GitHub | 動画 | 音楽 | ポスト | 開く |
| `ko.ts` | 웹사이트 | GitHub | 동영상 | 음악 | 트윗 | 열기 |
| `ru.ts` | Сайт | GitHub | Видео | Музыка | Твит | Открыть |

**Step 3: 验证**

Run: `pnpm type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/i18n/i18nKey.ts src/i18n/languages/
git commit -m "feat: add extension card i18n strings"
```

---

### Task 6: 新建 `dynamic-extensions.ts` 渲染器

**Files:**
- Create: `src/components/pages/dynamic/dynamic-extensions.ts`

**Step 1: 写入完整实现**

```ts
/**
 * Ech0 扩展卡片渲染器
 * 以 <dynamic-extension data-type data-payload> 自定义元素为宿主，
 * 按 type 渲染 WEBSITE / GITHUBPROJ / VIDEO / MUSIC / TWEET 卡片。
 * LOCATION 不经过此渲染器（适配时已映射到卡片位置元信息行）。
 */
import { I18nKey } from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { musicConfig } from "@/config/musicConfig";

const TWEET_WIDGETS_SRC = "https://platform.twitter.com/widgets.js";
const TWEET_TIMEOUT_MS = 6_000;

/* ---------- 通用卡片骨架 ---------- */

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function createCard(label: string, bodyHtml: string, jumpHref?: string): HTMLElement {
	const root = document.createElement("div");
	root.className = "dynamic-ext-card";
	const jump = jumpHref
		? `<a class="dynamic-ext-jump" href="${escapeHtml(jumpHref)}" target="_blank" rel="noopener noreferrer">${i18n(I18nKey.dynamicExtJump)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M9 7h8v8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`
		: "";
	root.innerHTML = `
		<div class="dynamic-ext-header">
			<span class="dynamic-ext-label">${escapeHtml(label)}</span>
			${jump}
		</div>
		<div class="dynamic-ext-body">${bodyHtml}</div>`;
	return root;
}

/* ---------- WEBSITE / GITHUBPROJ：静态链接卡 ---------- */

function renderWebsite(payload: Record<string, unknown>): HTMLElement {
	const site = String(payload.site ?? "");
	const title = String(payload.title ?? site);
	const domain = (() => {
		try {
			return new URL(site).hostname.replace(/^www\./, "");
		} catch {
			return site;
		}
	})();
	const body = `
		<a class="dynamic-ext-linkcard" href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer">
			<span class="dynamic-ext-linkcard-title">${escapeHtml(title)}</span>
			<span class="dynamic-ext-linkcard-domain">${escapeHtml(domain)}</span>
		</a>`;
	return createCard(i18n(I18nKey.dynamicExtWebsite), body, site);
}

function renderGithubProj(payload: Record<string, unknown>): HTMLElement {
	const repoUrl = String(payload.repoUrl ?? "");
	const repoName = (() => {
		try {
			const path = new URL(repoUrl).pathname.replace(/^\/+|\/+$/g, "");
			return path || repoUrl;
		} catch {
			return repoUrl;
		}
	})();
	const body = `
		<a class="dynamic-ext-linkcard" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener noreferrer">
			<span class="dynamic-ext-linkcard-title">${escapeHtml(repoName)}</span>
			<span class="dynamic-ext-linkcard-domain">GitHub</span>
		</a>`;
	return createCard(i18n(I18nKey.dynamicExtGithub), body, repoUrl);
}

/* ---------- VIDEO：Bilibili / YouTube 内嵌 ---------- */

function renderVideo(payload: Record<string, unknown>): HTMLElement {
	const videoId = String(payload.videoId ?? "");
	const isBilibili = videoId.startsWith("BV");
	const src = isBilibili
		? `https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=${encodeURIComponent(videoId)}&as_wide=1&high_quality=1&danmaku=0`
		: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
	const body = `<div class="dynamic-ext-video"><iframe src="${escapeHtml(src)}" loading="lazy" allowfullscreen scrolling="no" frameborder="no" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div>`;
	return createCard(
		isBilibili ? "Bilibili" : "YouTube",
		body,
		isBilibili
			? `https://www.bilibili.com/video/${videoId}`
			: `https://www.youtube.com/watch?v=${videoId}`,
	);
}

/* ---------- MUSIC：Meting 解析 + 原生 audio 迷你播放卡 ---------- */

type MusicInfo = { server: string; type: string; id: string };

/** 与 Ech0 parseMusicURL 同源的解析规则（网易云音乐 / QQ 音乐） */
function parseMusicURL(raw: string): MusicInfo | null {
	const url = raw.trim();
	if (/^https:\/\/([a-z0-9-]+\.)*music\.163\.com/i.test(url)) {
		const idMatch = url.match(/[?&]id=(\d+)/);
		if (!idMatch) return null;
		let type: "song" | "playlist" | undefined;
		if (/(\/|#\/|\/m\/)song/.test(url)) type = "song";
		else if (/(\/|#\/|\/m\/)playlist/.test(url)) type = "playlist";
		if (!type) return null;
		return { server: "netease", type, id: idMatch[1] };
	}
	if (/^https:\/\/([a-z0-9-]+\.)*qq\.com/i.test(url)) {
		const newSongMatch = url.match(/songDetail\/([a-zA-Z0-9]+)/);
		if (newSongMatch) return { server: "tencent", type: "song", id: newSongMatch[1] };
		const oldSongMatch = url.match(/[?&]songid=(\d+)/);
		if (oldSongMatch) return { server: "tencent", type: "song", id: oldSongMatch[1] };
		const playlistMatch = url.match(/\/playlist\/(\d+)/i);
		if (playlistMatch) return { server: "tencent", type: "playlist", id: playlistMatch[1] };
	}
	return null;
}

function metingApis(): string[] {
	const meting = musicConfig.meting;
	if (!meting) return [];
	return [meting.api, ...(meting.fallbackApis || [])].filter(Boolean);
}

async function resolveMusic(
	info: MusicInfo,
): Promise<{ title: string; artist: string; url: string; pic: string } | null> {
	for (const base of metingApis()) {
		try {
			const fetchUrl = base
				.replace(":server", info.server)
				.replace(":type", info.type)
				.replace(":id", info.id)
				.replace(":r", String(Math.random()));
			const response = await fetch(fetchUrl);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = (await response.json()) as Array<Record<string, string>>;
			const item = data?.[0];
			if (item?.url) {
				return {
					title: item.title || item.name || "Unknown",
					artist: item.author || item.artist || "",
					url: item.url,
					pic: item.pic || item.cover || "",
				};
			}
		} catch {
			// 尝试下一个 Meting API
		}
	}
	return null;
}

function renderMusicFallback(url: string): HTMLElement {
	const body = `
		<a class="dynamic-ext-linkcard" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
			<span class="dynamic-ext-linkcard-title">${escapeHtml(url)}</span>
		</a>`;
	return createCard(i18n(I18nKey.dynamicExtMusic), body, url);
}

function renderMusic(host: HTMLElement, payload: Record<string, unknown>): void {
	const url = String(payload.url ?? "");
	const info = url ? parseMusicURL(url) : null;
	if (!info) {
		host.replaceChildren(renderMusicFallback(url));
		return;
	}

	// 先渲染加载态，异步解析 Meting 后填充
	const root = createCard(
		i18n(I18nKey.dynamicExtMusic),
		`<div class="dynamic-ext-music is-loading">${i18n(I18nKey.dynamicLoading)}</div>`,
		url,
	);
	host.replaceChildren(root);

	void resolveMusic(info).then((track) => {
		if (!track) {
			host.replaceChildren(renderMusicFallback(url));
			return;
		}
		const body = root.querySelector<HTMLElement>(".dynamic-ext-body");
		if (!body) return;
		body.innerHTML = `
			<div class="dynamic-ext-music">
				${track.pic ? `<img class="dynamic-ext-music-cover" src="${escapeHtml(track.pic)}" alt="${escapeHtml(track.title)}" loading="lazy" referrerpolicy="no-referrer" />` : ""}
				<div class="dynamic-ext-music-meta">
					<span class="dynamic-ext-music-title">${escapeHtml(track.title)}</span>
					<span class="dynamic-ext-music-artist">${escapeHtml(track.artist)}</span>
				</div>
				<button type="button" class="dynamic-ext-music-play" aria-label="${escapeHtml(i18n(I18nKey.dynamicExtMusic))}">
					<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
					<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
				</button>
			</div>
			<audio class="dynamic-ext-music-audio" preload="none" src="${escapeHtml(track.url)}"></audio>`;

		const audio = body.querySelector<HTMLAudioElement>(".dynamic-ext-music-audio");
		const button = body.querySelector<HTMLButtonElement>(".dynamic-ext-music-play");
		button?.addEventListener("click", () => {
			if (!audio) return;
			if (audio.paused) {
				void audio.play();
			} else {
				audio.pause();
			}
		});
		if (audio && button) {
			audio.addEventListener("play", () => {
				button.querySelector(".icon-play")?.setAttribute("style", "display:none");
				button.querySelector(".icon-pause")?.setAttribute("style", "display:inline");
			});
			audio.addEventListener("pause", () => {
				button.querySelector(".icon-play")?.setAttribute("style", "display:inline");
				button.querySelector(".icon-pause")?.setAttribute("style", "display:none");
			});
			audio.addEventListener("error", () => {
				host.replaceChildren(renderMusicFallback(url));
			});
		}
	});
}

/* ---------- TWEET：widgets.js 嵌入 + 超时降级 ---------- */

let widgetsPromise: Promise<void> | null = null;

function loadTwitterWidgets(): Promise<void> {
	if (widgetsPromise) return widgetsPromise;
	widgetsPromise = new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = TWEET_WIDGETS_SRC;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("twitter widgets load failed"));
		document.head.append(script);
	});
	return widgetsPromise;
}

function renderTweetFallback(payload: Record<string, unknown>): HTMLElement {
	const url = String(payload.url ?? "");
	const username = String(payload.username ?? "");
	const body = `
		<a class="dynamic-ext-linkcard" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
			<span class="dynamic-ext-linkcard-title">@${escapeHtml(username)}</span>
			<span class="dynamic-ext-linkcard-domain">X (Twitter)</span>
		</a>`;
	return createCard(i18n(I18nKey.dynamicExtTweet), body, url);
}

function renderTweet(host: HTMLElement, payload: Record<string, unknown>): void {
	const url = String(payload.url ?? "");
	const username = String(payload.username ?? "");
	const dark = document.documentElement.classList.contains("dark");

	const root = createCard(
		i18n(I18nKey.dynamicExtTweet),
		`<blockquote class="twitter-tweet" data-theme="${dark ? "dark" : "light"}" data-dnt="true" data-conversation="none"><a href="${escapeHtml(url)}"></a></blockquote>`,
		url,
	);
	host.replaceChildren(root);
	const quote = root.querySelector<HTMLElement>(".twitter-tweet");
	if (!quote) return;

	void loadTwitterWidgets()
		.then(() => {
			const widgets = (
				window as { twttr?: { widgets?: { load: (el?: Element) => void } } }
			).twttr?.widgets;
			widgets?.load(quote);
		})
		.catch(() => {});

	// 超时降级：widgets 脚本被墙或渲染失败时退回链接卡
	window.setTimeout(() => {
		if (!host.isConnected) return;
		if (!root.querySelector("iframe")) {
			host.replaceChildren(renderTweetFallback(payload));
		}
	}, TWEET_TIMEOUT_MS);
}

/* ---------- 自定义元素入口 ---------- */

export function registerDynamicExtensions(): void {
	if (customElements.get("dynamic-extension")) return;

	class DynamicExtension extends HTMLElement {
		connectedCallback() {
			if (this.dataset.ready) return;
			this.dataset.ready = "true";
			const type = this.dataset.type || "";
			let payload: Record<string, unknown> = {};
			try {
				payload = JSON.parse(this.dataset.payload || "{}") as Record<
					string,
					unknown
				>;
			} catch {
				payload = {};
			}

			switch (type) {
				case "WEBSITE":
					this.replaceChildren(renderWebsite(payload));
					break;
				case "GITHUBPROJ":
					this.replaceChildren(renderGithubProj(payload));
					break;
				case "VIDEO":
					this.replaceChildren(renderVideo(payload));
					break;
				case "MUSIC":
					renderMusic(this, payload);
					break;
				case "TWEET":
					renderTweet(this, payload);
					break;
				default:
					this.remove();
			}
		}
	}

	customElements.define("dynamic-extension", DynamicExtension);
}
```

**Step 2: 验证**

Run: `pnpm check && pnpm type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/pages/dynamic/dynamic-extensions.ts
git commit -m "feat: add ech0 extension card renderer"
```

---

### Task 7: 模板与 DynamicFeed 接线

**Files:**
- Modify: `src/components/pages/dynamic/DynamicItemTemplate.astro`
- Modify: `src/components/pages/dynamic/DynamicFeed.svelte`
- Modify: `src/pages/dynamic/index.astro`

**Step 1: `DynamicItemTemplate.astro`**

frontmatter 中 `likeIdPrefix` 附近追加：

```ts
const ech0Config = dynamicConfig.ech0;
const ech0Enabled = Boolean(ech0Config?.enable && ech0Config.apiUrl);
const showLike = likeApiUrl !== "" || ech0Enabled;
```

把点赞按钮外层条件 `{likeApiUrl && (` 改为 `{showLike && (`，并在 `<dynamic-like` 上新增属性 `data-vote-enabled={likeApiUrl !== "" ? "true" : undefined}`。

在正文 div 与画廊之间插入扩展卡宿主：

```astro
			<div class="dynamic-content custom-md" data-dynamic-content></div>
			<dynamic-extension class="dynamic-extension" hidden></dynamic-extension>
			<DynamicGallery sourceId="dynamic-template-content" />
```

**Step 2: `DynamicFeed.svelte`**

1. Props 增加：

```ts
interface Ech0Config {
	enable: boolean;
}
// Props 接口中追加：
	ech0?: Ech0Config;
	ech0ApiUrl?: string;
```

并从 `$props()` 解构。`DynamicData` 类型追加 `extension?: { type: string; payload: Record<string, unknown> }; likes?: number;`

2. 导入并注册扩展渲染器：`import { registerDynamicExtensions } from "./dynamic-extensions";`，onMount 中 `registerDynamicLike();` 之后加 `registerDynamicExtensions();`

3. `load()` 数据源分支改为：

```ts
			if (ech0?.enable) {
				const data = (await fetchWithDedup(url("/api/ech0.json"))) as unknown;
				if (!Array.isArray(data)) throw new Error("Invalid ech0 payload");
				entries = data;
			} else if (memos?.enable) {
				// ……原有 memos 分支不变
```

4. 时间渲染分支 `if (source.startsWith("http") || memos?.enable)` 改为 `if (source.startsWith("http") || memos?.enable || ech0?.enable)`。

5. `createItem` 中原点赞块整体替换为（含扩展卡注入）：

```ts
	// Ech0 扩展卡片：写入类型与 payload，由 <dynamic-extension> 渲染
	const extEl = root.querySelector<HTMLElement>("dynamic-extension");
	if (extEl) {
		const ext = entry.extension;
		if (ext) {
			extEl.dataset.type = ext.type;
			extEl.dataset.payload = JSON.stringify(ext.payload);
			extEl.removeAttribute("hidden");
		} else {
			extEl.remove();
		}
	}

	// 点赞 provider：ech0 条目走原生点赞，其余走 star-vote，都没有则移除按钮
	const like = root.querySelector<HTMLElement>("dynamic-like");
	if (like) {
		if (entry.likes != null && ech0ApiUrl) {
			like.dataset.voteId = `ech0:${entry.id}`;
			like.dataset.provider = "ech0";
			like.dataset.likeEndpoint = `${ech0ApiUrl.replace(/\/+$/, "")}/api/echo/like/${entry.id}`;
			like.dataset.likeCount = String(entry.likes);
		} else if (like.dataset.voteEnabled === "true") {
			like.dataset.voteId = `${like.dataset.idPrefix || "dynamic"}:${entry.id}`;
		} else {
			like.remove();
		}
	}
```

**Step 3: `index.astro`**

frontmatter 增加：

```ts
const ech0Config = dynamicConfig.ech0;
const ech0 =
	ech0Config?.enable && ech0Config.apiUrl ? { enable: true } : undefined;
```

`<DynamicFeed` 上新增 props：`ech0={ech0} ech0ApiUrl={ech0Config?.apiUrl}`。

**Step 4: 验证**

Run: `pnpm check && pnpm type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/pages/dynamic/DynamicItemTemplate.astro src/components/pages/dynamic/DynamicFeed.svelte src/pages/dynamic/index.astro
git commit -m "feat: wire ech0 source and extension cards into dynamic feed"
```

---

### Task 8: `dynamic-like.ts` 支持原生点赞 provider

**Files:**
- Modify: `src/components/pages/dynamic/dynamic-like.ts`

**Step 1: `init()` 开头改为双 provider 分流，并新增 `likeNative` 方法**

```ts
		private async init() {
			const button = this.querySelector<HTMLButtonElement>("[data-like-button]");
			if (!button) return;

			if (this.dataset.provider === "ech0") {
				// 原生点赞：计数直接来自 fav_count，点击 PUT Ech0 like 接口
				const endpoint = this.dataset.likeEndpoint || "";
				const voteId = this.dataset.voteId || "";
				if (!endpoint || !voteId) return;
				this.dataset.liked = String(getLikedIds().has(voteId));
				const count = this.querySelector("[data-like-count]");
				if (count) count.textContent = this.dataset.likeCount || "0";
				button.disabled = false;
				button.addEventListener("click", () => this.likeNative(endpoint, voteId));
				return;
			}

			// ……以下保留原有 star-vote 逻辑不变
		}

		private async likeNative(endpoint: string, voteId: string) {
			const button = this.querySelector<HTMLButtonElement>("[data-like-button]");
			if (!button || button.dataset.busy === "true") return;
			const likedIds = getLikedIds();
			if (likedIds.has(voteId)) return;

			const countEl = this.querySelector("[data-like-count]");
			const previous = countEl?.textContent ?? "0";

			button.dataset.busy = "true";
			this.dataset.liked = "true";
			if (countEl) countEl.textContent = String(Number(previous) + 1);
			likedIds.add(voteId);
			persistLikedIds(likedIds);

			try {
				const response = await fetch(endpoint, { method: "PUT" });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
			} catch {
				likedIds.delete(voteId);
				persistLikedIds(likedIds);
				this.dataset.liked = "false";
				if (countEl) countEl.textContent = previous;
			} finally {
				button.dataset.busy = "false";
			}
		}
```

localStorage 复用同一键 `firefly-dynamic-liked`（ech0 的 voteId 带 `ech0:` 前缀，天然不与 star-vote 的 `dynamic:<id>` 冲突）。

**Step 2: 验证**

Run: `pnpm check && pnpm type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/pages/dynamic/dynamic-like.ts
git commit -m "feat: support native ech0 like provider in like button"
```

---

### Task 9: 侧边栏动态组件适配

**Files:**
- Modify: `src/components/widget/Dynamic.astro`
- Modify: `src/components/widget/DynamicSidebar.svelte`

**Step 1: `Dynamic.astro`**

frontmatter 增加：

```ts
const ech0 = dynamicConfig.ech0?.enable ? { enable: true } : undefined;
```

`<DynamicSidebar` 新增 prop `ech0={ech0}`。

**Step 2: `DynamicSidebar.svelte`**

1. Props 增加 `ech0?: { enable: boolean };` 并解构。
2. `onMount` 的取数分支改为：

```ts
		const data = (await fetchWithDedup(
			ech0?.enable
				? url("/api/ech0.json")
				: memos?.enable
					? url("/api/memos.json")
					: apiUrl,
		)) as unknown;
```

3. `formatDate` 分支 `if (apiUrl.startsWith("http") || memos?.enable)` 改为 `if (apiUrl.startsWith("http") || memos?.enable || ech0?.enable)`。

**Step 3: 验证**

Run: `pnpm check && pnpm type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/widget/Dynamic.astro src/components/widget/DynamicSidebar.svelte
git commit -m "feat: adapt dynamic sidebar widget to ech0 source"
```

---

### Task 10: 扩展卡片样式

**Files:**
- Modify: `src/styles/dynamic.css`

**Step 1: 追加扩展卡片样式（全部主题变量，无硬编码颜色）**

```css
.dynamic-extension {
	display: block;
	margin: 0.625rem 0 0 3.75rem;
}

.dynamic-extension[hidden] {
	display: none;
}

.dynamic-ext-card {
	border: 1px solid var(--line-divider);
	border-radius: calc(var(--radius-large) - 0.35rem);
	background: var(--card-bg);
	overflow: hidden;
	font-size: 0.85rem;
}

.dynamic-ext-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	padding: 0.4rem 0.75rem;
	border-bottom: 1px solid color-mix(in srgb, var(--content-meta) 16%, transparent);
	color: var(--content-meta);
	font-size: 0.75rem;
}

.dynamic-ext-jump {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	color: var(--content-meta);
	transition: color 150ms ease;
}

.dynamic-ext-jump svg {
	width: 0.85rem;
	height: 0.85rem;
}

.dynamic-ext-jump:hover {
	color: var(--primary);
}

.dynamic-ext-body {
	padding: 0.75rem;
}

.dynamic-ext-linkcard {
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
	color: var(--primary);
}

.dynamic-ext-linkcard-title {
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dynamic-ext-linkcard-domain {
	color: var(--content-meta);
	font-size: 0.75rem;
}

.dynamic-ext-video iframe {
	display: block;
	width: 100%;
	aspect-ratio: 16 / 9;
	border: 0;
	border-radius: calc(var(--radius-large) - 0.5rem);
}

.dynamic-ext-music {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.dynamic-ext-music.is-loading {
	color: var(--content-meta);
}

.dynamic-ext-music-cover {
	width: 3.25rem;
	height: 3.25rem;
	border-radius: calc(var(--radius-large) - 0.5rem);
	object-fit: cover;
}

.dynamic-ext-music-meta {
	display: flex;
	min-width: 0;
	flex: 1;
	flex-direction: column;
	gap: 0.1rem;
}

.dynamic-ext-music-title {
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dynamic-ext-music-artist {
	color: var(--content-meta);
	font-size: 0.75rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dynamic-ext-music-play {
	display: inline-flex;
	width: 2.5rem;
	height: 2.5rem;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	border: 1px solid var(--line-divider);
	border-radius: 999px;
	background: color-mix(in srgb, var(--primary) 10%, transparent);
	color: var(--primary);
	cursor: pointer;
	transition: background 150ms ease;
}

.dynamic-ext-music-play:hover {
	background: color-mix(in srgb, var(--primary) 18%, transparent);
}

.dynamic-ext-music-play svg {
	width: 1.25rem;
	height: 1.25rem;
}

.dynamic-ext-tweet blockquote {
	margin: 0;
}
```

**Step 2: 移动端断点适配**

768px 媒体查询的 `margin-left: 0` 列表追加 `.dynamic-extension`：

```css
	.dynamic-content,
	.dynamic-gallery,
	.dynamic-tags,
	.dynamic-actions,
	.dynamic-extension {
		margin-left: 0;
	}
```

**Step 3: 验证与提交**

Run: `pnpm check && pnpm type-check && pnpm build`
Expected: 全部 PASS；`lqips.json` 若出现无关 diff 则还原。

```bash
git add src/styles/dynamic.css
git commit -m "feat: style ech0 extension cards with theme variables"
```

---

### Task 11: 全量验证与手动检查

**Step 1: 静态验证**

Run: `pnpm check && pnpm type-check && pnpm lint && pnpm build`
Expected: 全部 PASS。

**Step 2: 手动检查清单（`pnpm dev`；服务端代理无 CORS/Referer 问题，本地可直接联调真实数据）**

1. `/dynamic/` 列表展示 Ech0 说说：Markdown 加粗/链接正常、内嵌 HTML 保留、图片进画廊。
2. 扩展卡片：WEBSITE 链接卡、GITHUBPROJ 仓库名卡、VIDEO（B 站/YouTube iframe 可播）、MUSIC（Meting 解析出封面歌名，可播放，失败降级）、TWEET（能加载则嵌入，超时 6 秒降级 @username 卡）；LOCATION 显示在卡片 meta 位置行而非扩展卡。
3. 标签 chips 点击可筛选对应说说，再次点击取消；搜索框、年份筛选正常。
4. 点赞：ech0 条目点击后计数 +1、图标实心；到 m.081531.xyz 确认对应说说 `fav_count` 同步 +1；刷新后保持已赞；连续快速点击被忽略。
5. 侧边栏"最新动态"展示 Ech0 内容，时间格式与主列表一致。
6. 明暗模式切换扩展卡配色正常；375px 宽度下扩展卡无溢出、无左侧缩进。
7. 把 `ech0.enable` 改回 `false`：动态页回落 Memos 数据源，点赞回落 star-vote，无残留请求。（验证完还原为 `true`。）

如全部通过，向用户汇报；是否推送由用户决定。
