<script lang="ts">
import { load } from "js-yaml";
import { onDestroy, onMount } from "svelte";

type Friend = {
	name: string;
	link: string;
	avatar: string;
	descr: string;
	tags?: string[];
	siteshot?: string;
	friendslink?: string;
	feeds?: string;
	latency?: number;
	reachable?: boolean;
};
type Group = { className: string; classDesc: string; links: Friend[] };
export let ymlUrl: string;
export let latencyUrl: string;
let groups: Group[] = [];
let loading = true;
let query = "";
let selectedTag = "all";

const normalize = (url: string): string => {
	try {
		const parsed = new URL(url);
		parsed.search = "";
		parsed.hash = "";
		return parsed.toString().replace(/\/$/, "").toLowerCase();
	} catch {
		return url.trim().replace(/\/$/, "").toLowerCase();
	}
};

const normTag = (tag: string): string => tag.trim().toLowerCase();

const GREEN_BADGE =
	"bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400";
const YELLOW_BADGE =
	"bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400";
const RED_BADGE =
	"bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";

const latencyMs = (latency: number | undefined): number =>
	latency === undefined ? 0 : Math.round(latency * 1000);

const latencyLabel = (friend: Friend): string =>
	friend.reachable === false ? "不可达" : `${latencyMs(friend.latency)}ms`;

const latencyBadgeClass = (friend: Friend): string => {
	if (friend.reachable === false) return RED_BADGE;
	const ms = latencyMs(friend.latency);
	if (ms < 1000) return GREEN_BADGE;
	if (ms < 3000) return YELLOW_BADGE;
	return RED_BADGE;
};

const selectTag = (tag: string) => {
	selectedTag = tag;
};

$: tags = [
	...new Set(
		groups.flatMap((group) =>
			group.links.flatMap((friend) => (friend.tags || []).map(normTag)),
		),
	),
].sort();

$: filteredGroups = (() => {
	const q = query.trim().toLowerCase();
	return groups
		.map((group) => ({
			...group,
			links: group.links.filter((friend) => {
				const text =
					`${friend.name} ${friend.descr} ${(friend.tags || []).join(" ")}`.toLowerCase();
				const tagMatch =
					selectedTag === "all" ||
					(friend.tags || []).map(normTag).includes(selectedTag);
				return tagMatch && (!q || text.includes(q));
			}),
		}))
		.filter((group) => group.links.length > 0);
})();

onMount(async () => {
	const handleFilterChange = (event: Event) => {
		const detail = (
			event as CustomEvent<{ query: string; selectedTag: string }>
		).detail;
		query = detail.query;
		selectedTag = detail.selectedTag;
	};
	window.addEventListener("friends-filter-change", handleFilterChange);
	onDestroy(() => {
		window.removeEventListener("friends-filter-change", handleFilterChange);
	});

	try {
		const headers = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
		const [ymlResponse, latencyResponse] = await Promise.all([
			fetch(ymlUrl, { headers }),
			fetch(latencyUrl, { headers }),
		]);
		if (!ymlResponse.ok || !latencyResponse.ok)
			throw new Error("Remote friends request failed");
		const raw = load(await ymlResponse.text()) as Array<
			Record<string, unknown>
		>;
		const latencyJson = (await latencyResponse.json()) as {
			link_data?: Array<Record<string, unknown>>;
		};
		const latencyMap = new Map<
			string,
			{ latency?: number; reachable?: boolean }
		>();
		for (const entry of latencyJson.link_data || []) {
			if (typeof entry.link === "string") {
				latencyMap.set(normalize(entry.link), {
					latency:
						typeof entry.latency === "number" ? entry.latency : undefined,
					reachable:
						typeof entry.reachable === "boolean" ? entry.reachable : undefined,
				});
			}
		}
		groups = raw
			.map((group) => ({
				className: typeof group.class_name === "string" ? group.class_name : "",
				classDesc: typeof group.class_desc === "string" ? group.class_desc : "",
				links: Array.isArray(group.link_list)
					? group.link_list
							.filter(
								(item): item is Record<string, unknown> =>
									typeof item === "object" && item !== null,
							)
							.map((item) => {
								const link = typeof item.link === "string" ? item.link : "";
								const latency = latencyMap.get(normalize(link));
								return {
									name: typeof item.name === "string" ? item.name : "",
									link,
									avatar: typeof item.avatar === "string" ? item.avatar : "",
									descr: typeof item.descr === "string" ? item.descr : "",
									tags: Array.isArray(item.tags)
										? item.tags.filter(
												(tag): tag is string => typeof tag === "string",
											)
										: undefined,
									siteshot:
										typeof item.siteshot === "string"
											? item.siteshot
											: undefined,
									friendslink:
										typeof item.friendslink === "string"
											? item.friendslink
											: undefined,
									feeds:
										typeof item.feeds === "string" ? item.feeds : undefined,
									...latency,
								};
							})
					: [],
			}))
			.filter((group) => group.links.length > 0);
		const remoteTags = [
			...new Set(
				groups.flatMap((group) =>
					group.links.flatMap((friend) => (friend.tags || []).map(normTag)),
				),
			),
		].sort();
		window.dispatchEvent(
			new CustomEvent("friends-tags", {
				detail: { tags: remoteTags },
			}),
		);
	} catch (error) {
		console.warn("Failed to load remote friends", error);
	} finally {
		loading = false;
	}
});
</script>

{#if loading}
	<div class="mt-8 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3" aria-label="正在加载远程友链" aria-busy="true">
		{#each Array(4) as _}
			<div class="animate-pulse overflow-hidden rounded-xl border border-(--line-divider) bg-(--card-bg)">
				<div class="aspect-[16/9] bg-neutral-200 dark:bg-neutral-800"></div>
				<div class="space-y-3 p-4"><div class="h-4 w-2/5 rounded bg-neutral-200 dark:bg-neutral-800"></div><div class="h-3 w-4/5 rounded bg-neutral-200 dark:bg-neutral-800"></div><div class="h-8 rounded bg-neutral-200 dark:bg-neutral-800"></div></div>
			</div>
		{/each}
	</div>
{:else if groups.length > 0}
	<div class="mt-8 space-y-8">
		{#if filteredGroups.length > 0}
			{#each filteredGroups as group}
				<section><div class="mb-3 flex items-baseline gap-3"><h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">{group.className}</h2>{#if group.classDesc}<p class="text-sm text-neutral-500 dark:text-neutral-400">{group.classDesc}</p>{/if}</div>
				<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
					{#each group.links as friend}
						<article class="group overflow-hidden rounded-xl border border-(--line-divider) bg-(--card-bg) transition-all duration-300 hover:border-(--primary) hover:shadow-lg">
							{#if friend.siteshot}<a href={friend.link} target="_blank" rel="noopener noreferrer" class="block aspect-[16/9] overflow-hidden bg-neutral-100 dark:bg-neutral-800"><img src={friend.siteshot} alt={`${friend.name} 网站截图`} loading="lazy" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></a>{/if}
							<div class="flex flex-col gap-3 p-4"><div class="flex items-center gap-3"><a href={friend.link} target="_blank" rel="noopener noreferrer" class="h-14 w-14 shrink-0 overflow-hidden rounded-xl"><img src={friend.avatar} alt={friend.name} loading="lazy" class="h-full w-full object-cover" /></a><div class="min-w-0 grow"><a href={friend.link} target="_blank" rel="noopener noreferrer" class="font-bold text-base text-neutral-900 dark:text-neutral-100 group-hover:text-(--primary)">{friend.name}</a>{#if friend.latency !== undefined || friend.reachable === false}<span class="ml-2 rounded-full px-2 py-0.5 text-xs {latencyBadgeClass(friend)}">{latencyLabel(friend)}</span>{/if}<p class="line-clamp-1 text-sm text-neutral-500 dark:text-neutral-400">{friend.descr}</p></div></div>
								{#if friend.tags?.length}<div class="flex flex-wrap gap-1">{#each friend.tags as tag}<span class="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.65rem] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{tag}</span>{/each}</div>{/if}
								<div class="flex flex-wrap gap-2 border-t border-(--line-divider) pt-3"><a href={friend.link} target="_blank" rel="noopener noreferrer" class="btn-regular rounded-lg px-3 py-1.5 text-xs">访问博客</a>{#if friend.friendslink}<a href={friend.friendslink} target="_blank" rel="noopener noreferrer" class="btn-regular rounded-lg px-3 py-1.5 text-xs">友链页面</a>{/if}{#if friend.feeds}<a href={friend.feeds} target="_blank" rel="noopener noreferrer" aria-label={`${friend.name} RSS`} class="btn-regular rounded-lg px-2 py-1.5 text-(--primary)">RSS</a>{/if}</div>
							</div>
						</article>
					{/each}
				</div></section>
			{/each}
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
					<p class="text-sm">未找到匹配的友链</p>
				</div>
			{/if}
	</div>
{/if}
