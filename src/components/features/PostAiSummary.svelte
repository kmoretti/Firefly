<script lang="ts">
/**
 * AI 摘要卡片 - Svelte 5 岛屿组件
 *
 * 复刻参考站 Excerpt.vue 的样式与交互：
 * - AI 图标 + 标题 + badge
 * - 打字机逐字动画 + 闪烁光标
 * - 窄屏（≤768px）长摘要折叠展开
 * - prefers-reduced-motion 时直接完整展示
 */

import Icon from "@/components/common/Icon.svelte";

interface Props {
	summary: string;
	label?: string;
	badge?: string;
	typingSpeedMs?: number;
	foldThresholdChars?: number;
}

let {
	summary,
	label = "智能摘要",
	badge = "AI 生成后摘要",
	typingSpeedMs = 50,
	foldThresholdChars = 80,
}: Props = $props();

// SSR 先渲染完整文本，水合后再启动动画，避免空白与布局跳动
let displayed = $state(summary);
let caretVisible = $state(false);
let isFolded = $state(summary.length > foldThresholdChars);
let isNarrowScreen = $state(false);
let isReducedMotion = $state(false);

const showToggle = $derived(
	summary.length > foldThresholdChars && isNarrowScreen,
);

let narrowMedia: MediaQueryList | null = null;
let motionMedia: MediaQueryList | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function stopTyping() {
	if (timer !== null) {
		clearTimeout(timer);
		timer = null;
	}
}

function updateNarrowScreen() {
	isNarrowScreen = narrowMedia?.matches ?? false;
}

function updateReducedMotion() {
	isReducedMotion = motionMedia?.matches ?? false;
}

function runTypingAnimation() {
	stopTyping();
	displayed = "";
	caretVisible = true;
	let index = 0;

	const step = () => {
		if (index < summary.length) {
			displayed += summary.charAt(index);
			index += 1;
			timer = setTimeout(step, typingSpeedMs);
		} else {
			caretVisible = false;
			timer = null;
		}
	};

	timer = setTimeout(step, typingSpeedMs);
}

function renderSummary() {
	stopTyping();
	if (!isReducedMotion) {
		runTypingAnimation();
	} else {
		displayed = summary;
		caretVisible = false;
	}
}

function toggleFold() {
	isFolded = !isFolded;
}

$effect(() => {
	narrowMedia = window.matchMedia("(max-width: 768px)");
	motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
	updateNarrowScreen();
	updateReducedMotion();
	renderSummary();

	narrowMedia.addEventListener("change", updateNarrowScreen);
	motionMedia.addEventListener("change", updateReducedMotion);

	return () => {
		stopTyping();
		narrowMedia?.removeEventListener("change", updateNarrowScreen);
		motionMedia?.removeEventListener("change", updateReducedMotion);
	};
});
</script>

<div class="ai-summary-card onload-animation mb-5 rounded-(--radius-large) border border-(--line-divider) bg-(--card-bg) px-4 py-3 shadow-md">
	<div class="mb-2.5 flex items-center justify-between">
		<div class="flex items-center gap-1.5 font-bold text-(--primary)">
			<span
				class="inline-flex h-5 w-5 items-center justify-center rounded-md bg-linear-to-br from-(--primary) to-(--primary)/60 text-white"
				aria-hidden="true"
			>
				<Icon icon="material-symbols:smart-toy-outline" style="font-size: 13px" />
			</span>
			<span class="text-[0.95rem]">{label}</span>
		</div>
		<span
			class="rounded-full bg-(--primary)/10 px-2 py-0.5 text-xs font-semibold text-(--primary)"
		>
			{badge}
		</span>
	</div>

	<div
		id="ai-summary-content"
		class="ai-summary-content rounded-xl border border-(--line-divider) bg-(--bg-secondary) px-3 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-black/75 dark:text-white/75"
		class:ai-summary-content--folded={isFolded && isNarrowScreen}
		role="region"
		aria-expanded={!isFolded}
	>
		{displayed}{#if caretVisible}<span
				class="ai-summary-caret"
				aria-hidden="true"
			>|</span
		>{/if}
	</div>

	{#if showToggle}
		<div class="mt-2 flex justify-end md:hidden">
			<button
				type="button"
				class="cursor-pointer rounded-full border border-(--primary)/35 bg-(--primary)/10 px-3 py-1 text-xs font-bold text-(--primary) transition-colors hover:bg-(--primary)/20"
				aria-controls="ai-summary-content"
				aria-expanded={!isFolded}
				onclick={toggleFold}
			>
				{isFolded ? "展开全部" : "收起"}
			</button>
		</div>
	{/if}
</div>

<style>
	.ai-summary-content {
		max-height: none;
		overflow: hidden;
		transition:
			max-height 0.28s ease,
			opacity 0.22s ease;
	}

	.ai-summary-content--folded {
		max-height: 7.2em;
		opacity: 0.96;
	}

	.ai-summary-caret {
		display: inline-block;
		color: var(--primary);
		font-weight: 600;
		animation: ai-summary-blink 1s step-end infinite;
	}

	@keyframes ai-summary-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ai-summary-content,
		.ai-summary-card {
			transition: none;
		}

		.ai-summary-caret {
			animation: none;
		}
	}
</style>
