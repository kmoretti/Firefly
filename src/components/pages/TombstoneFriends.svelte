<script lang="ts">
import { load } from "js-yaml";
import { onMount } from "svelte";

type TombstoneEntry = { name: string; avatar: string };

export let url: string;
export let title: string;

let entries: TombstoneEntry[] = [];
let loading = true;
let failed = new Set<number>();

const firstLetter = (name: string): string =>
	name.trim().charAt(0).toUpperCase() || "?";

const parseEntry = (item: unknown): TombstoneEntry | null => {
	if (typeof item !== "object" || item === null) return null;
	const raw = item as Record<string, unknown>;
	const entry = raw.entry;
	if (typeof entry !== "object" || entry === null) return null;
	const name = typeof entry.name === "string" ? entry.name : "";
	const avatar = typeof entry.avatar === "string" ? entry.avatar : "";
	return name && avatar ? { name, avatar } : null;
};

onMount(async () => {
	try {
		const headers = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
		const response = await fetch(url, { headers });
		if (!response.ok) throw new Error("Tombstone request failed");
		const raw = load(await response.text()) as unknown[];
		entries = raw
			.map(parseEntry)
			.filter((entry): entry is TombstoneEntry => entry !== null);
	} catch (error) {
		console.warn("Failed to load tombstone friends", error);
	} finally {
		loading = false;
	}
});
</script>

{#if loading}
	<div class="tombstone-section" aria-label="正在加载友链墓碑" aria-busy="true">
		<h2 class="tombstone-heading text-neutral-500 dark:text-neutral-400">{title}</h2>
		<div class="tombstone-list">
			{#each Array(6) as _}
				<div class="tombstone-item animate-pulse">
					<span class="tombstone-avatar bg-neutral-200 dark:bg-neutral-800"></span>
					<span class="tombstone-name h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-800"></span>
				</div>
			{/each}
		</div>
	</div>
{:else if entries.length > 0}
	<section class="tombstone-section" aria-label={title}>
		<h2 class="tombstone-heading text-neutral-500 dark:text-neutral-400">{title}</h2>
		<div class="tombstone-list">
			{#each entries as entry, i}
				<div class="tombstone-item">
					{#if failed.has(i)}
						<span class="tombstone-avatar tombstone-avatar-fallback text-neutral-400 dark:text-neutral-500">{firstLetter(entry.name)}</span>
					{:else}
						<img src={entry.avatar} alt={entry.name} loading="lazy" class="tombstone-avatar" onerror={() => { failed = new Set(failed).add(i); }} />
					{/if}
					<span class="tombstone-name text-neutral-600 dark:text-neutral-300">{entry.name}</span>
					<span class="tombstone-tooltip text-neutral-600 dark:text-neutral-300" role="tooltip">此站点无法访问</span>
				</div>
			{/each}
		</div>
	</section>
{/if}

<style>
	.tombstone-section {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px dashed var(--line-divider);
	}
	.tombstone-heading {
		margin-bottom: 0.75rem;
		font-size: 1rem;
		font-weight: 500;
		opacity: 0.65;
	}
	.tombstone-list {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.tombstone-item {
		display: inline-flex;
		align-items: center;
		gap: 5.6px;
		opacity: 0.65;
		position: relative;
		cursor: help;
		white-space: nowrap;
		text-decoration-line: underline;
		text-decoration-style: dashed;
		text-decoration-color: color-mix(in srgb, var(--primary) 30%, transparent);
		text-underline-offset: 4px;
		transition: color 0.2s, text-decoration-color 0.2s, transform 0.2s, opacity 0.2s;
	}
	.tombstone-item:hover {
		opacity: 1;
		color: var(--primary);
		text-decoration-color: var(--primary);
		transform: translateY(-2px) scale(1.05);
	}
	.tombstone-item:hover .tombstone-name {
		color: var(--primary);
	}
	.tombstone-tooltip {
		position: absolute;
		bottom: calc(100% + 0.6rem);
		left: 50%;
		transform: translate(-50%, 0.35rem) scale(0.96);
		transform-origin: center bottom;
		z-index: 5;
		width: max-content;
		max-width: 16rem;
		padding: 0.42rem 0.68rem;
		font-size: 0.76rem;
		font-weight: 500;
		line-height: 1.45;
		text-align: center;
		white-space: normal;
		text-decoration: none;
		border-radius: 0.55rem;
		border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--line-divider));
		background: var(--card-bg);
		box-shadow:
			0 12px 28px -16px color-mix(in srgb, var(--primary) 40%, transparent),
			inset 0 1px 0 color-mix(in srgb, var(--primary) 8%, transparent);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.18s, transform 0.18s;
	}
	.tombstone-tooltip::after {
		content: "";
		width: 0.6rem;
		height: 0.6rem;
		background: var(--card-bg);
		border-right: 1px solid color-mix(in srgb, var(--primary) 22%, var(--line-divider));
		border-bottom: 1px solid color-mix(in srgb, var(--primary) 22%, var(--line-divider));
		position: absolute;
		bottom: -0.34rem;
		left: 50%;
		transform: translate(-50%) rotate(45deg);
	}
	.tombstone-item:hover .tombstone-tooltip {
		opacity: 1;
		transform: translate(-50%) scale(1);
	}
	.tombstone-avatar {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}
	.tombstone-avatar-fallback {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--line-divider);
		font-size: 9px;
		font-weight: 600;
		line-height: 1;
	}
	.tombstone-name {
		font-size: 15px;
		font-weight: 500;
		line-height: 1;
	}
</style>
