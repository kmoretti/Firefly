<script lang="ts">
/**
 * 随便逛逛 - 随机文章入口（Svelte 5 岛屿）
 *
 * 复刻参考站两块能力：
 * 1. 图标墙按钮：hover/:focus-visible 时默认内容淡出、主题色渐变横幅滑入
 *    显示「随便逛逛 →」大字与纸飞机；(hover:none) 触屏设备常显横幅态并停用图标墙动画。
 *    普通态（有置顶文章）：图标斜向 -30° 无限横向滚动（50s 线性循环）。
 *    增强态（expanded，无置顶文章时占满整行）：改为竖向滚动图标墙（参考站
 *    tags-group-all 纵向版）——多列砖砌交错、整体上滚、上下渐隐，
 *    右上角显示文章计数徽章，hover 横幅居中横排。
 * 2. 转盘覆盖层：3D 圆环旋转抽选随机文章，定格后跳转目标页；
 *    prefers-reduced-motion 时直接跳转，不弹覆盖层。
 */

import Icon from "@/components/common/Icon.svelte";
import { siteConfig } from "@/config";

interface WanderPost {
	title: string;
	url: string;
	cover: string;
}

interface CarouselFace {
	src: string;
	title: string;
	url: string;
}

interface Props {
	/** 随机文章池 */
	posts: WanderPost[];
	/** 按钮标题，空串或未传时回退站点标题 */
	title?: string;
	/** 副文案 */
	desc?: string;
	/** 转盘面数（钳制 6-16） */
	faceCount?: number;
	/** 旋转时长（毫秒） */
	spinMs?: number;
	/** 缓动时长（毫秒） */
	easeMs?: number;
	/** 定格停留时长（毫秒） */
	holdMs?: number;
	/** 图标墙 [iconify 名, 背景色] */
	icons?: [string, string][];
	/** 增强态：无置顶文章时按钮占满整行，渲染竖向滚动图标墙与文章计数徽章 */
	expanded?: boolean;
}

/** 默认图标墙：12 个 simple-icons，带对应品牌背景色 */
const DEFAULT_ICONS: [string, string][] = [
	["simple-icons:github", "#358bff"],
	["simple-icons:markdown", "#15c6ff"],
	["simple-icons:typescript", "#3178c6"],
	["simple-icons:css", "#2965f1"],
	["simple-icons:python", "#3776ab"],
	["simple-icons:vuedotjs", "#42b883"],
	["simple-icons:hugo", "#ff4088"],
	["simple-icons:nodedotjs", "#339933"],
	["simple-icons:docker", "#2496ed"],
	["simple-icons:cloudflare", "#f38020"],
	["simple-icons:figma", "#a259ff"],
	["simple-icons:astro", "#ff5d01"],
];

let {
	posts,
	title = "",
	desc = "看点什么好呢",
	faceCount = 10,
	spinMs = 1600,
	easeMs = 800,
	holdMs = 700,
	icons = DEFAULT_ICONS,
	expanded = false,
}: Props = $props();

// ===== 转盘常量（与参考站一致） =====
/** 圆环半径系数（参考站 1 + 3 × 0.15） */
const RING_RADIUS_FACTOR = 1.45;
/** 圆环俯仰角（度） */
const RING_TILT_DEG = -2.5;
/** 舞台透视距离（像素） */
const STAGE_PERSPECTIVE_PX = 3000;
/** 面板圆角（像素） */
const FACE_RADIUS_PX = 18;
/** 背面亮度（对应 brightness(0.35)） */
const FACE_BACK_BRIGHTNESS = 0.35;

// ===== 派生状态 =====
/** 按钮标题：空串回退站点标题 */
const faceTitle = $derived(title.trim() || siteConfig.title);

/** 普通态斜向丝带列数据：每列 2 枚图标，整体重复两遍配合 -50% 平移实现无缝循环 */
const iconColumns = $derived.by(() => {
	const columns: [string, string][][] = [];
	for (let i = 0; i < icons.length; i += 2) {
		columns.push(icons.slice(i, i + 2));
	}
	return [...columns, ...columns];
});

/** 增强态竖向图标墙（参考站 tags-group-all 纵向版）：9 列砖砌交错，
 *  每列 8 枚图标按列起点轮转取样、重复两遍配合 -50% 平移实现无缝上滚 */
const wallColumns = $derived.by(() => {
	if (!expanded) return [];
	const columnCount = 9;
	const perColumn = 8;
	const columns: [string, string][][] = [];
	for (let c = 0; c < columnCount; c += 1) {
		const single: [string, string][] = [];
		for (let i = 0; i < perColumn; i += 1) {
			single.push(icons[(c * perColumn + i) % icons.length]);
		}
		columns.push([...single, ...single]);
	}
	return columns;
});

// ===== 覆盖层状态 =====
let open = $state(false);
let leaving = $state(false);
let locked = $state(false);
let selectedSlot = $state(-1);
let faces = $state<CarouselFace[]>([]);
let overlayEl = $state<HTMLElement | null>(null);
// 实时标题：跟随当前正对观察者的面板，锁定后固定为目标标题
let captionTitle = $state("");

// 触发时确定的转盘参数（在 open 置 true 前写入）
let targetFaceIndex = 0;
let targetUrl = "";

// ===== 工具函数（对应参考站 X7/C4/Y7/K7/U7/A4/bi） =====

function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}

/** 角度归一化到 (-180, 180] */
function normalizeAngle(deg: number): number {
	let t = deg % 360;
	if (t > 180) t -= 360;
	if (t < -180) t += 360;
	return t;
}

/** 分段缓动：前 72% 时间完成 58% 进程，后 28% 时间完成 42%，整体 easeInOutCubic */
function spinEase(t: number): number {
	const s = clamp(t, 0, 1);
	const split = 0.72;
	let x: number;
	if (s < split) {
		x = (s / split) * 0.58;
	} else {
		x = 0.58 + ((s - split) / (1 - split)) * 0.42;
	}
	return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** 目标角度：先把目标面板转回正面，再加 K 个整圈 */
function targetAngle(
	start: number,
	index: number,
	perFace: number,
	turns: number,
): number {
	const aligned = -index * perFace;
	let delta = normalizeAngle(aligned - start);
	if (delta <= 0) delta += 360;
	return start + delta + Math.max(0, turns) * 360;
}

/** 当前正对观察者的面板索引 */
function frontFaceIndex(rot: number, count: number, perFace: number): number {
	let best = 0;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (let i = 0; i < count; i += 1) {
		const distance = Math.abs(normalizeAngle(rot + i * perFace));
		if (distance < bestDistance) {
			bestDistance = distance;
			best = i;
		}
	}
	return best;
}

/** 面板尺寸：窄屏（<640px）取视口 68%（≤220px），否则 28%（≤300px），均为正方形 */
function computeFaceSize(): { width: number; height: number } {
	const vw = window.innerWidth || 800;
	if (vw < 640) {
		const width = Math.min(Math.round(vw * 0.68), 220);
		return { width, height: width };
	}
	const width = Math.min(Math.round(vw * 0.28), 300);
	return { width, height: width };
}

/** 设置面板封面背景图（转义反斜杠与引号） */
function setFaceBackground(el: HTMLElement, src: string): void {
	if (!src) return;
	el.style.backgroundImage = `url("${src.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

/** 归一化 URL：去尾斜杠与 hash、保留 search，用于排除当前页 */
function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url, window.location.origin);
		const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
		return pathname + parsed.search;
	} catch {
		return String(url || "");
	}
}

/** 随机取一项：优先 crypto 拒绝采样 */
function pickRandom<T>(list: T[]): T | null {
	if (!list.length) return null;
	if (list.length === 1) return list[0];
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.getRandomValues === "function"
	) {
		const range = 4294967296;
		const limit = range - (range % list.length);
		const buffer = new Uint32Array(1);
		let value = range;
		while (value >= limit) {
			crypto.getRandomValues(buffer);
			value = buffer[0];
		}
		return list[value % list.length];
	}
	return list[Math.floor(Math.random() * list.length)];
}

/** 将覆盖层挂到 body，脱离 overflow:hidden 的祖先容器 */
function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		},
	};
}

/** 点击触发：随机选取目标文章并弹出转盘 */
function handleTrigger() {
	if (open || !posts.length) return;

	const available = posts.filter((post) => post.url);
	if (!available.length) return;

	// 排除当前页；全部被排除时允许当前页
	const current = normalizeUrl(window.location.href);
	const pool = available.filter((post) => normalizeUrl(post.url) !== current);
	const target = pickRandom(pool.length ? pool : available);
	if (!target) return;

	// 减少动态效果：直接跳转，不弹覆盖层
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		location.assign(target.url);
		return;
	}

	// 构建转盘面板：faceCount 钳制 6-16，目标文章插入随机位置
	const count = clamp(Math.round(faceCount) || 10, 6, 16);
	const list: CarouselFace[] = [];
	for (let i = 0; i < count; i += 1) {
		const picked = pickRandom(available) ?? target;
		list.push({
			src: picked.cover || "",
			title: picked.title || "",
			url: picked.url || "",
		});
	}
	const index = Math.floor(Math.random() * count);
	list[index] = {
		src: target.cover || "",
		title: target.title || "",
		url: target.url || "",
	};

	// 重置上一次的展示状态
	leaving = false;
	locked = false;
	selectedSlot = -1;
	captionTitle = "";
	faces = list;
	targetFaceIndex = index;
	targetUrl = target.url;
	open = true;
}

/**
 * 运行转盘动画（对应参考站 openRandomPostCarousel/V7）：
 * 覆盖层已由模板渲染，这里负责面板尺寸、半径、旋转、定格与跳转。
 */
function runCarousel(root: HTMLElement): () => void {
	const stage = root.querySelector<HTMLElement>(".random-post-overlay__stage");
	const ring = root.querySelector<HTMLElement>(".random-post-overlay__ring");
	const slots = Array.from(
		root.querySelectorAll<HTMLElement>(".random-post-overlay__slot"),
	);
	const fronts = Array.from(
		root.querySelectorAll<HTMLElement>(".random-post-overlay__face--front"),
	);
	const backs = Array.from(
		root.querySelectorAll<HTMLElement>(".random-post-overlay__face--back"),
	);
	const count = faces.length;

	if (
		!stage ||
		!ring ||
		count === 0 ||
		slots.length !== count ||
		fronts.length !== count ||
		backs.length !== count
	) {
		return () => {};
	}

	const perFace = 360 / count;
	const target = ((targetFaceIndex % count) + count) % count;
	// 总时长 C = max(1200, spinMs + easeMs)；整圈数 K = clamp(round(C/850), 2, 5)
	const totalMs = Math.max(1200, Number(spinMs) + Number(easeMs) || 2400);
	const turns = clamp(Math.round(totalMs / 850), 2, 5);

	let size = computeFaceSize();
	// 半径 = 面板宽 × 1.45 / (2 × tan(π / max(3, n)))
	let radius =
		(size.width * RING_RADIUS_FACTOR) /
		(2 * Math.tan(Math.PI / Math.max(3, count)));

	stage.style.perspective = `${STAGE_PERSPECTIVE_PX}px`;
	ring.style.width = `${size.width}px`;
	ring.style.height = `${size.height}px`;

	const applySlotTransforms = () => {
		for (let i = 0; i < count; i += 1) {
			slots[i].style.transform =
				`rotateY(${i * perFace}deg) translateZ(${radius}px)`;
			fronts[i].style.borderRadius = `${FACE_RADIUS_PX}px`;
			backs[i].style.borderRadius = `${FACE_RADIUS_PX}px`;
			backs[i].style.filter = `brightness(${FACE_BACK_BRIGHTNESS})`;
		}
	};
	applySlotTransforms();

	// 旋转：起始角随机，目标角 = K7(start, targetIndex, perFace, K)
	const startRot = Math.random() * 360;
	const endRot = targetAngle(startRot, target, perFace, turns);
	let rot = startRot;
	let spinRaf = 0;
	let loadRaf = 0;
	let loadCursor = 0;
	let startTime = 0;
	let holdStartTime = 0;
	let phase: "motion" | "hold" = "motion";
	let active = true;
	let done = false;
	let lockedNow = false;
	let lastTitleIndex = -1;

	const applyRingTransform = () => {
		ring.style.transform = `translateZ(${-radius}px) rotateY(${rot}deg)`;
	};

	// 实时更新标题为当前正对观察者的面板；锁定后固定为目标标题
	function updateCaption(index?: number) {
		const current = lockedNow
			? target
			: (index ?? frontFaceIndex(rot, count, perFace));
		if (current === lastTitleIndex) return;
		lastTitleIndex = current;
		captionTitle = faces[current]?.title || "";
	}

	// 封面渐进加载：每帧预载一张，完成后同时写入正面/背面背景
	function loadNextCover() {
		if (!active || loadCursor >= count) return;
		const face = faces[loadCursor];
		const front = fronts[loadCursor];
		const back = backs[loadCursor];
		loadCursor += 1;
		if (face.src) {
			const img = new Image();
			img.decoding = "async";
			img.onload = () => {
				if (!active) return;
				setFaceBackground(front, face.src);
				setFaceBackground(back, face.src);
			};
			img.onerror = () => {
				if (!active) return;
				setFaceBackground(front, face.src);
				setFaceBackground(back, face.src);
			};
			img.src = face.src;
		}
		loadRaf = requestAnimationFrame(loadNextCover);
	}

	// 定格：目标面板加白描边与主题色光晕，其余面板降透明度
	function lockTarget() {
		lockedNow = true;
		locked = true;
		selectedSlot = target;
		rot = endRot;
		applyRingTransform();
		updateCaption(target);
	}

	// 收尾：completed 为真表示跳转目标页，否则取消（Escape）
	function finish(completed: boolean) {
		if (done) return;
		done = true;
		active = false;
		cancelAnimationFrame(spinRaf);
		cancelAnimationFrame(loadRaf);
		window.removeEventListener("resize", onResize);
		window.removeEventListener("keydown", onKeydown);
		leaving = true;
		window.setTimeout(() => {
			document.body.classList.remove("random-post-open");
			open = false;
			if (completed && targetUrl) {
				location.assign(targetUrl);
			}
		}, 220);
	}

	function onResize() {
		size = computeFaceSize();
		radius =
			(size.width * RING_RADIUS_FACTOR) /
			(2 * Math.tan(Math.PI / Math.max(3, count)));
		ring.style.width = `${size.width}px`;
		ring.style.height = `${size.height}px`;
		applySlotTransforms();
		applyRingTransform();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			e.preventDefault();
			finish(false);
		}
	}

	function spinFrame(now: number) {
		if (!active) return;
		if (!startTime) startTime = now;
		if (phase === "motion") {
			const progress = (now - startTime) / totalMs;
			rot = startRot + (endRot - startRot) * spinEase(progress);
			if (progress >= 1) {
				phase = "hold";
				holdStartTime = now;
				lockTarget();
			}
		} else if (phase === "hold" && now - holdStartTime >= holdMs) {
			finish(true);
			return;
		}
		applyRingTransform();
		if (!lockedNow) {
			updateCaption();
		}
		spinRaf = requestAnimationFrame(spinFrame);
	}

	// 挂载：锁定 body 滚动、应用初始姿态、启动旋转与渐进加载
	document.body.classList.add("random-post-open");
	applyRingTransform();
	updateCaption();
	window.addEventListener("resize", onResize);
	window.addEventListener("keydown", onKeydown);
	spinRaf = requestAnimationFrame(spinFrame);
	loadRaf = requestAnimationFrame(loadNextCover);

	// 覆盖层关闭或组件卸载时清理（幂等）
	return () => {
		active = false;
		done = true;
		cancelAnimationFrame(spinRaf);
		cancelAnimationFrame(loadRaf);
		window.removeEventListener("resize", onResize);
		window.removeEventListener("keydown", onKeydown);
		document.body.classList.remove("random-post-open");
	};
}

// 覆盖层挂载后启动转盘；open 置回 false 或组件销毁时走清理
$effect(() => {
	if (!open || !overlayEl) return;
	return runCarousel(overlayEl);
});
</script>

{#if posts.length > 0}
	<button
		type="button"
		class="wander-btn"
		class:wander-btn--expanded={expanded}
		data-random-post-trigger
		aria-label="随便逛逛"
		disabled={open}
		onclick={handleTrigger}
	>
		<span
			class="wander-face"
			class:wander-face--expanded={expanded}
			aria-hidden="true"
		>
			<span class="wander-face-title">{faceTitle}</span>
			<span class="wander-face-desc">{desc}</span>
			{#if expanded}
				<span class="wander-post-count">
					<Icon icon="material-symbols:casino" />
					<span>{posts.length} 篇文章</span>
				</span>
			{/if}
			{#if expanded}
				<!-- 增强态：竖向滚动图标墙（多列砖砌交错、整体上滚、上下渐隐） -->
				<div class="wander-wall" aria-hidden="true">
					{#each wallColumns as column}
						<div class="wander-wall-col">
							<div class="wander-wall-scroll">
								{#each column as [name, bg]}
									<span
										class="wander-wall-icon"
										style="--wander-icon-bg:{bg}"
									>
										<Icon icon={name} />
									</span>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- 普通态：斜向 -30° 横向滚动丝带 -->
				<div class="wander-tags" aria-hidden="true">
					<div class="wander-tags-group">
						<div class="wander-tags-scroll">
							{#each iconColumns as column}
								<div class="wander-tags-pair">
									{#each column as [name, bg]}
										<span
											class="wander-tags-icon"
											style="--wander-icon-bg:{bg}"
										>
											<Icon icon={name} />
										</span>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</span>
		<span class="wander-hover" class:wander-hover--expanded={expanded}>
			<span class="wander-plane">
				<Icon icon="material-symbols:send" />
			</span>
			<span class="wander-banner-text">
				随便逛逛
				<Icon icon="material-symbols:chevron-right" />
			</span>
		</span>
	</button>
{/if}

{#if open}
	<div
		bind:this={overlayEl}
		use:portal
		class="random-post-overlay"
		class:is-leaving={leaving}
		class:is-locked={locked}
		role="dialog"
		aria-modal="true"
		aria-label="随机文章"
	>
		<div
			class="random-post-overlay__stage"
			style="--random-post-tilt:{RING_TILT_DEG}deg"
		>
			<div class="random-post-overlay__tilt">
				<div class="random-post-overlay__ring">
					{#each faces as _face, i}
						<div
							class="random-post-overlay__slot"
							class:is-selected={selectedSlot === i}
						>
							<div class="random-post-overlay__face random-post-overlay__face--front"></div>
							<div class="random-post-overlay__face random-post-overlay__face--back"></div>
						</div>
					{/each}
				</div>
			</div>
		</div>
		<div class="random-post-overlay__caption">
			<h2 class="random-post-overlay__title">{captionTitle}</h2>
		</div>
	</div>
{/if}

<style>
	/* ===== 按钮本体（参考站 home-desktop-spotlight__random，改用本项目主题变量） ===== */
	.wander-btn {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: var(--wander-btn-height, 148px);
		padding: 0;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--line-color));
		border-radius: var(--wander-btn-radius, 14px);
		background: var(--card-bg);
		color: inherit;
		text-align: left;
		cursor: pointer;
		contain: layout paint style;
		isolation: isolate;
		box-shadow:
			0 3px 8px color-mix(in srgb, #000 8%, transparent),
			0 1px 3px color-mix(in srgb, #000 5%, transparent);
		transition:
			box-shadow 0.42s cubic-bezier(0.4, 0, 0.2, 1),
			border-color 0.42s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wander-btn:hover,
	.wander-btn:focus-visible {
		border-color: color-mix(in srgb, var(--primary) 40%, var(--line-color));
		box-shadow:
			0 5px 12px color-mix(in srgb, #000 10%, transparent),
			0 1px 4px color-mix(in srgb, #000 6%, transparent);
		transition:
			box-shadow 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			border-color 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.wander-btn:disabled {
		opacity: 0.65;
		pointer-events: none;
	}

	.wander-face {
		position: relative;
		display: block;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--card-bg);
	}

	.wander-face-title {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 1;
		max-width: calc(100% - 2rem);
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--deep-text);
		pointer-events: none;
		transform: translateY(0);
		transition:
			opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1) 0.3s,
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.28s;
	}

	/* 暗色下 --deep-text 仍为深色，需覆盖为亮色文字 */
	:global(.dark) .wander-face-title {
		color: var(--btn-content);
	}

	.wander-face-desc {
		position: absolute;
		top: calc(1rem + 1.35em);
		left: 1rem;
		z-index: 1;
		max-width: calc(100% - 2rem);
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--content-meta);
		pointer-events: none;
		transform: translateY(0);
		transition:
			opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1) 0.34s,
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.3s;
	}

	/* ===== 图标墙：斜向 -30° 无限横向滚动 ===== */
	.wander-tags {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		opacity: 1;
		visibility: visible;
		contain: strict;
		transition:
			opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1) 0.28s,
			visibility 0s linear 0.28s;
	}

	.wander-tags-group {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 175%;
		height: 175%;
		transform: translate3d(calc(-50% + 2.25rem), calc(-50% + 2.65rem), 0)
			rotate(-30deg);
		transform-origin: center center;
		overflow: visible;
		backface-visibility: hidden;
	}

	.wander-tags-scroll {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		align-items: flex-start;
		gap: 0.5rem;
		width: max-content;
		min-width: 100%;
		margin-top: 2.85rem;
		padding-left: 1.25rem;
		padding-right: 1.25rem;
		animation: wander-icon-rowup 50s linear infinite;
		transform: translateZ(0);
		backface-visibility: hidden;
	}

	.wander-tags-pair {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: 0.35rem;
		width: 3.15rem;
	}

	.wander-tags-icon {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 2.9rem;
		height: 2.9rem;
		border-radius: 0.7rem;
		color: #fff;
		background: var(--wander-icon-bg, #358bff);
		box-shadow: 0 2px 6px color-mix(in srgb, #000 12%, transparent);
		overflow: hidden;
		contain: layout paint;
	}

	.wander-tags-icon :global(.inline-icon) {
		display: block;
		width: 1.45rem;
		height: 1.45rem;
		color: inherit;
		flex-shrink: 0;
	}

	.wander-tags-pair .wander-tags-icon:nth-child(even) {
		margin-top: 0;
		transform: translateX(-0.85rem);
	}

	@keyframes wander-icon-rowup {
		0% {
			transform: translate3d(0, 0, 0);
		}
		100% {
			transform: translate3d(-50%, 0, 0);
		}
	}

	/* ===== hover 横幅态：主题色渐变自左滑入 ===== */
	.wander-hover {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.35rem;
		padding-left: 0.75rem;
		background: linear-gradient(
			145deg,
			color-mix(in srgb, var(--primary) 72%, #fff),
			color-mix(in srgb, var(--primary) 80%, #fff) 58%,
			color-mix(in srgb, var(--primary) 76%, #fff)
		);
		color: #fff;
		opacity: 0;
		visibility: hidden;
		transform: translateZ(0);
		backface-visibility: hidden;
		transition:
			opacity 0.36s cubic-bezier(0.4, 0, 0.2, 1),
			visibility 0s linear 0.36s,
			padding-left 0.36s cubic-bezier(0.4, 0, 0.2, 1);
		font-size: clamp(1.85rem, 4.2vw, 2.45rem);
		font-weight: 700;
		line-height: 1.1;
		pointer-events: none;
	}

	.wander-plane {
		display: block;
		margin-left: 8px;
		font-size: clamp(2.85rem, 5.8vw, 3.65rem);
		line-height: 1;
		transform: translateX(-14px);
		transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wander-banner-text {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: 8px;
		transform: translateX(-14px);
		transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wander-banner-text :global(.inline-icon) {
		font-size: 1.35em;
		line-height: 1;
	}

	.wander-btn:hover .wander-hover,
	.wander-btn:focus-visible .wander-hover {
		opacity: 1;
		visibility: visible;
		padding-left: 1.5rem;
		transition:
			opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 0s,
			padding-left 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.wander-btn:hover .wander-face-title,
	.wander-btn:hover .wander-face-desc,
	.wander-btn:focus-visible .wander-face-title,
	.wander-btn:focus-visible .wander-face-desc {
		opacity: 0;
		transform: translateX(-10px);
		transition:
			opacity 0.16s ease,
			transform 0.2s ease;
	}

	.wander-btn:hover .wander-tags,
	.wander-btn:hover .wander-wall,
	.wander-btn:focus-visible .wander-tags,
	.wander-btn:focus-visible .wander-wall {
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.16s ease,
			visibility 0s linear 0.16s;
	}

	.wander-btn:hover .wander-tags-scroll,
	.wander-btn:hover .wander-wall-scroll,
	.wander-btn:focus-visible .wander-tags-scroll,
	.wander-btn:focus-visible .wander-wall-scroll {
		animation-play-state: paused;
	}

	.wander-btn:hover .wander-plane,
	.wander-btn:focus-visible .wander-plane {
		transform: translateX(0);
		transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0.05s;
	}

	.wander-btn:hover .wander-banner-text,
	.wander-btn:focus-visible .wander-banner-text {
		transform: translateX(0);
		transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0.1s;
	}

	/* 触屏设备：常显横幅态并停用图标墙动画 */
	@media (hover: none) {
		.wander-hover {
			opacity: 1;
			visibility: visible;
			padding-left: 1.5rem;
		}

		.wander-face-title,
		.wander-face-desc,
		.wander-tags,
		.wander-wall {
			opacity: 0;
			visibility: hidden;
		}

		.wander-tags-scroll,
		.wander-wall-scroll {
			animation: none;
		}

		.wander-plane,
		.wander-banner-text {
			transform: none;
		}
	}

	/* ===== 增强态（无置顶文章，按钮占满整行） ===== */
	/* 右上角淡染主题色渐变，弱化大面积底色的单调感 */
	.wander-face--expanded {
		background:
			radial-gradient(
				90% 130% at 88% -12%,
				color-mix(in srgb, var(--primary) 9%, transparent),
				transparent 58%
			),
			var(--card-bg);
	}

	.wander-face--expanded .wander-face-title {
		font-size: 1.3rem;
		letter-spacing: 0.01em;
	}

	.wander-face--expanded .wander-face-desc {
		top: calc(1rem + 1.95em);
		font-size: 0.82rem;
	}

	/* 文章计数徽章：右上角胶囊 */
	.wander-post-count {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.32rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--primary) 26%, var(--line-color));
		border-radius: 999px;
		background: color-mix(in srgb, var(--card-bg) 78%, transparent);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1;
		color: var(--content-meta);
		white-space: nowrap;
		pointer-events: none;
		box-shadow: 0 2px 10px color-mix(in srgb, #000 8%, transparent);
		transition:
			opacity 0.18s ease,
			transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.wander-post-count :global(.inline-icon) {
		width: 0.95rem;
		height: 0.95rem;
		color: var(--primary);
	}

	/* hover 时随默认内容一起淡出 */
	.wander-btn:hover .wander-post-count,
	.wander-btn:focus-visible .wander-post-count {
		opacity: 0;
		transform: translateY(-8px);
	}

	/* ===== 竖向滚动图标墙（增强态，参考站 tags-group-all 纵向版） ===== */
	/* 多列铺满按钮，整体上滚，上下渐隐；偶数列下移半格形成砖砌交错 */
	.wander-wall {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: flex;
		justify-content: space-between;
		padding: 0 10px;
		overflow: hidden;
		pointer-events: none;
		contain: strict;
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent,
			#000 22%,
			#000 78%,
			transparent
		);
		mask-image: linear-gradient(
			to bottom,
			transparent,
			#000 22%,
			#000 78%,
			transparent
		);
		transition:
			opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1) 0.28s,
			visibility 0s linear 0.28s;
	}

	.wander-wall-col {
		flex: none;
		width: 3.5rem;
	}

	/* 偶数列静态下移半格（图标高 + 间距的一半），砖砌式交错 */
	.wander-wall-col:nth-child(even) {
		transform: translateY(2.1875rem);
	}

	.wander-wall-scroll {
		display: flex;
		flex-direction: column;
		animation: wander-wall-up 60s linear infinite;
		transform: translateZ(0);
		backface-visibility: hidden;
	}

	/* margin-bottom 计入高度（不用 gap），保证 translateY(-50%) 精确对齐一遍内容 */
	.wander-wall-icon {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		margin-bottom: 0.875rem;
		border-radius: 0.875rem;
		color: #fff;
		background: var(--wander-icon-bg, #358bff);
		box-shadow: 0 2px 6px color-mix(in srgb, #000 12%, transparent);
		overflow: hidden;
		contain: layout paint;
	}

	.wander-wall-icon :global(.inline-icon) {
		display: block;
		width: 1.75rem;
		height: 1.75rem;
		color: inherit;
		flex-shrink: 0;
	}

	@keyframes wander-wall-up {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(-50%);
		}
	}

	/* 增强态文字可读性：图标墙上叠一层自左向右的卡片底色渐变遮罩 */
	.wander-face--expanded::after {
		content: "";
		position: absolute;
		inset: 0;
		z-index: 0;
		background: linear-gradient(
			90deg,
			var(--card-bg) 4%,
			color-mix(in srgb, var(--card-bg) 72%, transparent) 32%,
			transparent 58%
		);
		pointer-events: none;
	}

	/* hover 横幅：增强态居中横排（纸飞机 + 文字一行） */
	.wander-hover--expanded {
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 0.85rem;
		padding-left: 0;
	}

	.wander-btn:hover .wander-hover--expanded,
	.wander-btn:focus-visible .wander-hover--expanded,
	.wander-hover--expanded {
		padding-left: 0;
	}

	.wander-hover--expanded .wander-plane {
		margin-left: 0;
		font-size: clamp(2.3rem, 4.4vw, 3rem);
	}

	.wander-hover--expanded .wander-banner-text {
		margin-left: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.wander-btn,
		.wander-hover,
		.wander-face-title,
		.wander-face-desc,
		.wander-tags,
		.wander-wall,
		.wander-plane,
		.wander-banner-text,
		.wander-post-count {
			transition: none;
			transform: none;
		}

		.wander-tags-scroll,
		.wander-wall-scroll {
			animation: none;
		}
	}

	/* ===== 转盘覆盖层（参考站 random-post.css，主题色换用 var(--primary)） ===== */
	:global(body.random-post-open) {
		overflow: hidden;
	}

	.random-post-overlay {
		position: fixed;
		inset: 0;
		z-index: 12000;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 28px;
		padding: 0;
		padding-top: calc(16px + env(safe-area-inset-top, 0px));
		padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
		background: rgba(8, 8, 10, 0.9);
		color: #f4f4f5;
		opacity: 1;
		visibility: visible;
		touch-action: none;
		user-select: none;
	}

	.random-post-overlay.is-leaving {
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity 0.22s ease,
			visibility 0.22s ease;
	}

	.random-post-overlay__stage {
		width: 100vw;
		max-width: none;
		height: min(58dvh, 520px);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		perspective: 3000px;
	}

	.random-post-overlay__tilt {
		transform-style: preserve-3d;
		transform: rotateX(var(--random-post-tilt, -2.5deg));
	}

	.random-post-overlay__ring {
		position: relative;
		transform-style: preserve-3d;
		will-change: transform;
	}

	.random-post-overlay__slot {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
	}

	.random-post-overlay__face {
		position: absolute;
		inset: 0;
		overflow: hidden;
		backface-visibility: hidden;
		background-color: #1c1c1f;
		background-size: cover;
		background-position: 50%;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
		transition:
			box-shadow 0.35s ease,
			transform 0.35s ease;
	}

	.random-post-overlay__face--back {
		transform: rotateY(180deg);
		background-color: #141416;
	}

	.random-post-overlay__slot.is-selected .random-post-overlay__face--front {
		box-shadow:
			0 0 0 3px rgba(255, 255, 255, 0.92),
			0 0 0 7px color-mix(in srgb, var(--primary) 88%, white),
			0 18px 48px rgba(0, 0, 0, 0.5),
			0 0 36px color-mix(in srgb, var(--primary) 55%, transparent);
		transform: scale(1.06);
		animation: random-post-selected-pulse 1.1s ease-in-out infinite;
	}

	.random-post-overlay.is-locked .random-post-overlay__slot:not(.is-selected) {
		opacity: 0.42;
		transition: opacity 0.35s ease;
	}

	@keyframes random-post-selected-pulse {
		0%,
		100% {
			box-shadow:
				0 0 0 3px rgba(255, 255, 255, 0.92),
				0 0 0 7px color-mix(in srgb, var(--primary) 88%, white),
				0 18px 48px rgba(0, 0, 0, 0.5),
				0 0 28px color-mix(in srgb, var(--primary) 45%, transparent);
		}
		50% {
			box-shadow:
				0 0 0 3px #fff,
				0 0 0 8px color-mix(in srgb, var(--primary) 95%, white),
				0 20px 52px rgba(0, 0, 0, 0.55),
				0 0 44px color-mix(in srgb, var(--primary) 70%, transparent);
		}
	}

	.random-post-overlay__caption {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: min(92vw, 520px);
		max-width: min(92vw, 520px);
		text-align: center;
		pointer-events: none;
	}

	.random-post-overlay__title {
		margin: 0;
		width: 100%;
		max-width: 100%;
		font-family:
			"lxgw wenkai screen",
			stzhongsong,
			kaiti,
			serif;
		font-size: clamp(1.15rem, 3.2vw, 1.55rem);
		font-weight: 600;
		line-height: 1.35;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 640px) {
		.random-post-overlay {
			gap: 20px;
		}

		.random-post-overlay__stage {
			height: min(48dvh, 360px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.random-post-overlay,
		.random-post-overlay__title,
		.random-post-overlay__face {
			transition: none;
		}

		.random-post-overlay__slot.is-selected .random-post-overlay__face--front {
			animation: none;
		}
	}
</style>
