<script lang="ts">
import { onMount } from "svelte";
import ClientPagination from "@/components/common/ClientPagination.svelte";
import type {
	FcircleArticle,
	FcircleLinkStatus,
} from "@/utils/fcircle-adapter";
import { fetchWithDedup } from "@/utils/fetch-dedup";

interface Props {
	articlesUrl: string;
	linksUrl: string;
	externalUrl: string;
	itemsPerPage: number;
	showStatus: boolean;
	loadingText: string;
	emptyText: string;
	errorText: string;
	errorDesc: string;
	openExternalText: string;
	retryText: string;
	reachableText: string;
	unreachableText: string;
	latencyText: string;
	crawlableText: string;
	noCrawlText: string;
}

const {
	articlesUrl,
	linksUrl,
	externalUrl,
	itemsPerPage,
	showStatus,
	loadingText,
	emptyText,
	errorText,
	errorDesc,
	openExternalText,
	retryText,
	reachableText,
	unreachableText,
	latencyText,
	crawlableText,
	noCrawlText,
}: Props = $props();

let articles = $state<FcircleArticle[]>([]);
let linkStatuses = $state<FcircleLinkStatus[]>([]);
let currentPage = $state(1);
let loading = $state(true);
let failed = $state(false);

const statusByHost = $derived(
	new Map(linkStatuses.map((status) => [status.siteHost, status])),
);

const pagedArticles = $derived(
	articles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
);

const GREEN_BADGE =
	"bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400";
const YELLOW_BADGE =
	"bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400";
const RED_BADGE =
	"bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";

const latencyMs = (latency: number | undefined): number =>
	latency === undefined ? 0 : Math.round(latency * 1000);

function statusBadge(article: FcircleArticle): string {
	const status = statusByHost.get(article.siteHost);
	if (!status) return "";
	if (status.reachable === false) {
		return `<span class="ml-2 rounded-full px-2 py-0.5 text-xs ${RED_BADGE}">${unreachableText}</span>`;
	}
	if (status.latency !== undefined) {
		const ms = latencyMs(status.latency);
		const cls = ms < 1000 ? GREEN_BADGE : ms < 3000 ? YELLOW_BADGE : RED_BADGE;
		return `<span class="ml-2 rounded-full px-2 py-0.5 text-xs ${cls}">${latencyText} ${ms}ms</span>`;
	}
	return "";
}

function crawlBadge(article: FcircleArticle): string {
	const status = statusByHost.get(article.siteHost);
	if (!status) return "";
	if (status.crawlable === false) {
		return `<span class="ml-2 rounded-full px-2 py-0.5 text-xs ${RED_BADGE}">${noCrawlText}</span>`;
	}
	if (status.crawlable === true) {
		return `<span class="ml-2 rounded-full px-2 py-0.5 text-xs ${GREEN_BADGE}">${crawlableText}</span>`;
	}
	return "";
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
			fetchWithDedup<FcircleArticle[]>(articlesUrl),
			fetchWithDedup<FcircleLinkStatus[]>(linksUrl),
		]);
		if (
			articlesResult.status === "fulfilled" &&
			Array.isArray(articlesResult.value)
		) {
			articles = articlesResult.value;
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
		class="mt-8 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3"
		aria-label={loadingText}
		aria-busy="true"
	>
		{#each Array(4) as _}
			<div class="animate-pulse overflow-hidden rounded-xl border border-(--line-divider) bg-(--card-bg)">
				<div class="aspect-[16/9] bg-neutral-200 dark:bg-neutral-800"></div>
				<div class="space-y-3 p-4">
					<div class="h-4 w-2/5 rounded bg-neutral-200 dark:bg-neutral-800"></div>
					<div class="h-3 w-4/5 rounded bg-neutral-200 dark:bg-neutral-800"></div>
					<div class="h-8 rounded bg-neutral-200 dark:bg-neutral-800"></div>
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
	<div class="mt-8 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
		{#each pagedArticles as article}
			<article class="group overflow-hidden rounded-xl border border-(--line-divider) bg-(--card-bg) transition-all duration-300 hover:border-(--primary) hover:shadow-lg">
				{#if article.images?.length}
					<div class="grid grid-cols-2 gap-1 p-1">
						{#each article.images.slice(0, 2) as image}
							<a href={article.link} target="_blank" rel="noopener noreferrer" class="block aspect-[16/9] overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
								<img src={image} alt="" loading="lazy" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
							</a>
						{/each}
					</div>
				{/if}
				<div class="flex flex-col gap-3 p-4">
					<div class="flex items-center gap-3">
						{#if article.avatar}
							<a href={article.link} target="_blank" rel="noopener noreferrer" class="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
								<img src={article.avatar} alt={article.author} loading="lazy" class="h-full w-full object-cover" />
							</a>
						{/if}
						<div class="min-w-0 grow">
							<div class="flex items-center">
								<a href={article.link} target="_blank" rel="noopener noreferrer" class="truncate font-bold text-base text-neutral-900 dark:text-neutral-100 group-hover:text-(--primary)">
									{article.author}
								</a>
								{@html statusBadge(article)}{@html crawlBadge(article)}
							</div>
							<p class="truncate text-xs text-neutral-500 dark:text-neutral-400">
								{article.siteHost}
								{#if article.created} · {article.created}{/if}
							</p>
						</div>
					</div>
					<a href={article.link} target="_blank" rel="noopener noreferrer" class="line-clamp-2 font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-(--primary)">
						{article.title}
					</a>
					{#if article.summary}
						<p class="line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{article.summary}</p>
					{/if}
				</div>
			</article>
		{/each}
	</div>
	{#if showStatus && linkStatuses.length > 0}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
			<span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-green-500"></span>{reachableText}</span>
			<span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-red-500"></span>{unreachableText}</span>
		</div>
	{/if}
	<ClientPagination
		totalItems={articles.length}
		{itemsPerPage}
		{currentPage}
		onPageChange={goToPage}
	/>
{/if}
