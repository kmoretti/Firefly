/**
 * Ech0 扩展卡片渲染器
 * 以 <dynamic-extension data-type data-payload> 自定义元素为宿主，
 * 按 type 渲染 WEBSITE / GITHUBPROJ / VIDEO / MUSIC / TWEET 卡片。
 * LOCATION 不经过此渲染器（适配时已映射到卡片位置元信息行）。
 */
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { musicPlayerConfig } from "@/config/musicConfig";

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

function createCard(
	label: string,
	bodyHtml: string,
	jumpHref?: string,
): HTMLElement {
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
		if (newSongMatch)
			return { server: "tencent", type: "song", id: newSongMatch[1] };
		const oldSongMatch = url.match(/[?&]songid=(\d+)/);
		if (oldSongMatch)
			return { server: "tencent", type: "song", id: oldSongMatch[1] };
		const playlistMatch = url.match(/\/playlist\/(\d+)/i);
		if (playlistMatch)
			return { server: "tencent", type: "playlist", id: playlistMatch[1] };
	}
	return null;
}

function metingApis(): string[] {
	const meting = musicPlayerConfig.meting;
	if (!meting) return [];
	return [meting.api, ...(meting.fallbackApis || [])].filter(
		(api): api is string => Boolean(api),
	);
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

function renderMusic(
	host: HTMLElement,
	payload: Record<string, unknown>,
): void {
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

		const audio = body.querySelector<HTMLAudioElement>(
			".dynamic-ext-music-audio",
		);
		const button = body.querySelector<HTMLButtonElement>(
			".dynamic-ext-music-play",
		);
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
				button
					.querySelector(".icon-play")
					?.setAttribute("style", "display:none");
				button
					.querySelector(".icon-pause")
					?.setAttribute("style", "display:inline");
			});
			audio.addEventListener("pause", () => {
				button
					.querySelector(".icon-play")
					?.setAttribute("style", "display:inline");
				button
					.querySelector(".icon-pause")
					?.setAttribute("style", "display:none");
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

function renderTweet(
	host: HTMLElement,
	payload: Record<string, unknown>,
): void {
	const url = String(payload.url ?? "");
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
