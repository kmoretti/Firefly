<script lang="ts">
import { onMount } from "svelte";
import ClientPagination from "@/components/common/ClientPagination.svelte";
import type {
	FcircleArticle,
	FcircleLinkStatus,
	FcircleStats,
} from "@/utils/fcircle-adapter";
import { fetchWithDedup } from "@/utils/fetch-dedup";

interface Props {
	articlesUrl: string;
	linksUrl: string;
	externalUrl: string;
	itemsPerPage: number;
	showStatus: boolean;
	showStats: boolean;
	showRandom: boolean;
	loadingText: string;
	emptyText: string;
	errorText: string;
	errorDesc: string;
	openExternalText: string;
	retryText: string;
	unreachableText: string;
	statsSubscribedText: string;
	statsActiveText: string;
	statsArticlesText: string;
	statsFailedText: string;
	lastUpdatedText: string;
	randomTitle: string;
	randomNext: string;
	randomRead: string;
}

const {
	articlesUrl,
	linksUrl,
	externalUrl,
	itemsPerPage,
	showStatus,
	showStats,
	showRandom,
	loadingText,
	emptyText,
	errorText,
	errorDesc,
	openExternalText,
	retryText,
	unreachableText,
	statsSubscribedText,
	statsActiveText,
	statsArticlesText,
	statsFailedText,
	lastUpdatedText,
	randomTitle,
	randomNext,
	randomRead,
}: Props = $props();

let articles = $state<FcircleArticle[]>([]);
let linkStatuses = $state<FcircleLinkStatus[]>([]);
let stats = $state<FcircleStats | undefined>(undefined);
let randomIndex = $state(0);
let currentPage = $state(1);
let loading = $state(true);
let failed = $state(false);

const statusByHost = $derived(
	new Map(linkStatuses.map((status) => [status.siteHost, status])),
);

const pagedArticles = $derived(
	articles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
);

const randomArticle = $derived(
	articles.length > 0 ? articles[randomIndex] : undefined,
);

const statItems = $derived(
	stats
		? [
				{ num: stats.friendsNum, label: statsSubscribedText },
				{ num: stats.activeNum, label: statsActiveText },
				{ num: stats.articleNum, label: statsArticlesText },
				{ num: stats.errorNum, label: statsFailedText },
			]
		: [],
);

function isUnreachable(article: FcircleArticle): boolean {
	return (
		showStatus && statusByHost.get(article.siteHost)?.reachable === false
	);
}

function pickRandom() {
	if (articles.length < 2) return;
	let next = randomIndex;
	while (next === randomIndex) {
		next = Math.floor(Math.random() * articles.length);
	}
	randomIndex = next;
}

function pageFromUrl(): number {
	return Math.max(
		1,
		Number(new URL(window.location.href).searchParams.get("page")) || 1,
	);
}

function updateUrl() {
	const current = new URL(window.location.href);
	if (currentPage > 1) current.searchParams.set("page", String(currentPage));
	else current.searchParams.delete("page");
	history.replaceState(history.state, "", current);
}

function goToPage(page: number) {
	currentPage = page;
	updateUrl();
	document
		.querySelector(".fcircle-page")
		?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function load() {
	loading = true;
	failed = false;
	try {
		const [articlesResult, linksResult] = await Promise.allSettled([
			fetchWithDedup<{
				stats?: FcircleStats;
				articles?: FcircleArticle[];
			}>(articlesUrl),
			fetchWithDedup<FcircleLinkStatus[]>(linksUrl),
		]);
		if (
			articlesResult.status === "fulfilled" &&
			articlesResult.value &&
			Array.isArray(articlesResult.value.articles)
		) {
			articles = articlesResult.value.articles;
			stats = articlesResult.value.stats;
			randomIndex = Math.floor(
				Math.random() * Math.max(1, articles.length),
			);
		} else {
			failed = true;
		}
		if (
			linksResult.status === "fulfilled" &&
			Array.isArray(linksResult.value)
		) {
			linkStatuses = linksResult.value;
		}
		currentPage = pageFromUrl();
		const totalPages = Math.max(1, Math.ceil(articles.length / itemsPerPage));
		currentPage = Math.min(currentPage, totalPages);
	} catch (error) {
		console.error("Failed to load friend circle", error);
		failed = true;
	} finally {
		loading = false;
	}
}

onMount(() => {
	void load();
});
</script>

{#if loading}
	<div
		class="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2"
		aria-label={loadingText}
		aria-busy="true"
	>
		{#each Array(4) as _}
			<div class="rounded-xl border border-(--line-divider) bg-(--card-bg) p-4">
				<div class="h-5 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800"></div>
				<div class="mt-3 flex items-center gap-2">
					<div class="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800"></div>
					<div class="h-3 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800"></div>
				</div>
			</div>
		{/each}
	</div>
{:else if failed}
	<div class="mt-8 flex flex-col items-center justify-center py-16 text-center">
		<svg class="mb-4 h-14 w-14 text-neutral-300 dark:text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
		</svg>
		<h2 class="text-lg font-bold text-neutral-900 dark:text-neutral-100">{errorText}</h2>
		<p class="mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">{errorDesc}</p>
		<div class="mt-6 flex flex-wrap items-center justify-center gap-3">
			<button type="button" class="btn-regular rounded-lg px-4 py-2 text-sm" onclick={() => load()}>{retryText}</button>
			<a href={externalUrl} target="_blank" rel="noopener noreferrer" class="btn-regular rounded-lg px-4 py-2 text-sm text-(--primary)">{openExternalText}</a>
		</div>
	</div>
{:else if articles.length === 0}
	<div class="mt-8 flex flex-col items-center justify-center py-16 text-center">
		<svg class="mb-4 h-14 w-14 text-neutral-300 dark:text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" d="M6.115 5.19 7.74 3.575a1.33 1.33 0 0 1 1.878 0l1.282 1.28h4.146a1.33 1.33 0 0 1 1.33 1.33v4.147l1.282 1.281a1.33 1.33 0 0 1 0 1.878l-1.575 1.575M3 4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13.586M16.5 11.5 20 8m0 0 1.293 1.293A1 1 0 0 1 21 10v2a1 1 0 0 1-1 1h-2l-1.5-1.5" />
		</svg>
		<p class="text-sm text-neutral-500 dark:text-neutral-400">{emptyText}</p>
		<a href={externalUrl} target="_blank" rel="noopener noreferrer" class="btn-regular mt-6 rounded-lg px-4 py-2 text-sm text-(--primary)">{openExternalText}</a>
	</div>
{:else}
	{#if showStats && statItems.length > 0}
		<section class="card-base mt-8 px-6 py-6">
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{#each statItems as item}
					<div class="text-center">
						<p class="text-3xl font-bold text-(--primary)">{item.num}</p>
						<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{item.label}</p>
					</div>
				{/each}
			</div>
			{#if stats?.lastUpdatedTime}
				<p class="mt-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
					{lastUpdatedText}: {stats.lastUpdatedTime}
				</p>
			{/if}
		</section>
	{/if}

	{#if showRandom && randomArticle}
		<section class="card-base mt-4 px-6 py-6">
			<h2 class="text-base font-bold text-neutral-900 dark:text-neutral-100">{randomTitle}</h2>
			<a
				href={randomArticle.link}
				target="_blank"
				rel="noopener noreferrer"
				class="mt-3 line-clamp-2 text-lg font-bold text-neutral-900 transition-colors dark:text-neutral-100 hover:text-(--primary)"
			>
				{randomArticle.title}
			</a>
			<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
				<p class="min-w-0 text-xs text-neutral-500 dark:text-neutral-400">
					✍️ {randomArticle.author}
					{#if randomArticle.created}
						· 📅 {randomArticle.created.substring(0, 10)}
					{/if}
				</p>
				<div class="flex shrink-0 items-center gap-3">
					<button type="button" class="btn-regular rounded-lg px-4 py-2 text-sm" onclick={pickRandom}>{randomNext}</button>
					<a
						href={randomArticle.link}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center justify-center rounded-lg bg-(--primary) px-4 py-2 text-sm font-medium text-white transition-colors duration-150 dark:text-black/75"
					>{randomRead}</a>
				</div>
			</div>
		</section>
	{/if}

	<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each pagedArticles as article}
			<article
				class="group rounded-xl border border-(--line-divider) bg-(--card-bg) p-4 transition-all duration-300 hover:border-(--primary) hover:shadow-lg {isUnreachable(article)
					? 'opacity-60'
					: ''}"
			>
				<div class="flex items-start gap-1">
					<a
						href={article.link}
						target="_blank"
						rel="noopener noreferrer"
						class="line-clamp-2 font-bold text-neutral-900 transition-colors dark:text-neutral-100 group-hover:text-(--primary)"
					>
						{article.title}
					</a>
					{#if isUnreachable(article)}
						<span
							class="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500"
							title={unreachableText}
						></span>
					{/if}
				</div>
				<div class="mt-3 flex items-center gap-2">
					{#if article.avatar}
						<a href={article.link} target="_blank" rel="noopener noreferrer" class="h-8 w-8 shrink-0 overflow-hidden rounded-full">
							<img src={article.avatar} alt={article.author} loading="lazy" class="h-full w-full object-cover" />
						</a>
					{/if}
					<p class="min-w-0 truncate text-xs text-neutral-500 dark:text-neutral-400">
						<a
							href={article.link}
							target="_blank"
							rel="noopener noreferrer"
							class="font-medium text-neutral-700 transition-colors dark:text-neutral-300 hover:text-(--primary)"
						>
							{article.author}
						</a>
						· {article.siteHost}
						{#if article.created}
							· {article.created.substring(0, 10)}
						{/if}
					</p>
				</div>
			</article>
		{/each}
	</div>
	<ClientPagination
		totalItems={articles.length}
		{itemsPerPage}
		{currentPage}
		onPageChange={goToPage}
	/>
{/if}
