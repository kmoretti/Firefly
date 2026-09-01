<script lang="ts">
import { onMount } from "svelte";

type Submission = {
	id?: string | number;
	name?: string;
	url?: string;
	status?: string;
	createdAt?: string;
};

const endpoint = "https://verify.081531.xyz/api/submissions";
const fields = [
	["name", "站点名称", "text", true],
	["url", "站点地址", "url", true],
	["description", "站点描述", "text", false],
	["avatar", "头像地址", "url", true],
	["friendslink", "友链页面", "url", true],
	["siteshot", "站点截图", "url", false],
	["feeds", "RSS 地址", "url", false],
	["email", "邮箱", "email", false],
] as const;
const statuses = ["all", "pending", "approved", "rejected"];
const statusNames: Record<string, string> = {
	all: "全部",
	pending: "待审核",
	approved: "已通过",
	rejected: "已拒绝",
};

let confirmed = [false, false, false, false];
let mode: "apply" | "update" | null = "apply";
let originalUrl = "";
let submitting = false;
let feedback = "";
let feedbackKind = "";
let submissions: Submission[] = [];
let listLoading = true;
let listError = "";
let filter = "all";
let query = "";
let page = 1;
const pageSize = 8;

$: ready = confirmed.every(Boolean);
$: filtered = submissions.filter(
	(item) =>
		(filter === "all" || item.status === filter) &&
		(!query.trim() ||
			item.name?.toLowerCase().includes(query.trim().toLowerCase())),
);
$: pages = Math.max(1, Math.ceil(filtered.length / pageSize));
$: visible = filtered.slice((page - 1) * pageSize, page * pageSize);

async function loadSubmissions() {
	listLoading = true;
	listError = "";
	try {
		const response = await fetch(`${endpoint}?public=1`);
		if (!response.ok) throw new Error("状态列表请求失败");
		const data = await response.json();
		submissions = Array.isArray(data)
			? data
			: (data.submissions ?? data.data ?? []);
	} catch (error) {
		listError = error instanceof Error ? error.message : "状态列表暂时不可用";
	} finally {
		listLoading = false;
	}
}

async function submit(event: SubmitEvent) {
	event.preventDefault();
	if (!mode || submitting) return;
	submitting = true;
	feedback = "";
	feedbackKind = "";
	const form = event.currentTarget as HTMLFormElement;
	const data = Object.fromEntries(new FormData(form).entries());
	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				...data,
				type: mode,
				...(mode === "update" ? { originalUrl } : {}),
			}),
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			throw new Error(body?.message || "提交失败，请检查填写内容后重试");
		}
		feedback =
			mode === "apply"
				? "申请已提交，请等待审核。"
				: "更新申请已提交，请等待审核。";
		feedbackKind = "success";
		form.reset();
		originalUrl = "";
		await loadSubmissions();
	} catch (error) {
		feedback = error instanceof Error ? error.message : "网络异常，请稍后重试";
		feedbackKind = "error";
	} finally {
		submitting = false;
	}
}

onMount(loadSubmissions);
</script>

<section class="mt-4 rounded-2xl border border-(--line-divider) p-5 sm:p-6 space-y-6" aria-labelledby="friendlink-apply-title">
	<div>
		<h2 id="friendlink-apply-title" class="text-lg font-bold">申请条件</h2>
		<div class="mt-4 grid gap-3 sm:grid-cols-2">
			{#each ["请先将本站添加到您的友链页面", "请维护友链，长期无法访问或内容违规将被移除", "内容积极向上，不含违法违规内容", "支持 HTTPS、以原创内容为主并持续更新"] as condition, i}
				<label class="flex items-start gap-2 text-sm leading-5 text-neutral-600 dark:text-neutral-400">
					<input
						type="checkbox"
						checked={confirmed[i]}
						onchange={(event) => {
							confirmed = confirmed.map((value, index) =>
								index === i
									? (event.currentTarget as HTMLInputElement).checked
									: value,
							);
						}}
						class="mt-0.5 h-4 w-4 shrink-0 accent-(--primary)"
					/>
					<span>{condition}</span>
				</label>
			{/each}
		</div>
		{#if !ready}<p class="mt-3 text-sm text-(--primary)">请完成全部条件确认后继续。</p>{/if}
	</div>

	{#if ready}
		<div class="flex flex-wrap gap-2">
			<button type="button" class="rounded-lg bg-(--primary) px-4 py-2 text-sm text-white" onclick={() => { mode = "apply"; feedback = ""; }}>申请友链</button>
			<button type="button" class="rounded-lg border border-(--line-divider) px-4 py-2 text-sm" onclick={() => { mode = "update"; feedback = ""; }}>更新友链/信息</button>
		</div>
	{/if}

	{#if ready && mode}
		<form class="grid gap-4 sm:grid-cols-2" onsubmit={submit}>
			{#if mode === "update"}<label class="grid gap-1 text-sm sm:col-span-2">原站点地址<input required type="url" bind:value={originalUrl} class="form-input" /></label>{/if}
			{#each fields as [name, label, type, required]}
				<label class={`grid gap-1 text-sm ${name === "description" ? "sm:col-span-2" : ""}`}>
					<span>{label}{#if required}<span class="text-(--primary)"> *</span>{/if}</span>
					<input {name} {type} {required} class="form-input" />
				</label>
			{/each}
			<div class="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={submitting} class="rounded-lg bg-(--primary) px-5 py-2 text-sm text-white disabled:opacity-50" type="submit">{submitting ? "提交中…" : "提交申请"}</button><button type="button" class="text-sm text-neutral-500" onclick={() => (mode = null)}>取消</button></div>
			{#if feedback}<p class={`sm:col-span-2 text-sm ${feedbackKind === "success" ? "text-green-600" : "text-red-500"}`} role="alert">{feedback}</p>{/if}
		</form>
	{/if}

	<div class="border-t border-(--line-divider) pt-5">
		<div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-bold">公开申请状态</h2><div class="flex gap-2"><input aria-label="搜索站点名称" placeholder="搜索站点" bind:value={query} oninput={() => (page = 1)} class="form-input !w-36" />{#each statuses as item}<button type="button" class={`rounded-lg px-2.5 py-1 text-xs ${filter === item ? "bg-(--primary) text-white" : "border border-(--line-divider)"}`} onclick={() => { filter = item; page = 1; }}>{statusNames[item]}</button>{/each}</div></div>
		{#if listLoading}<p class="py-8 text-center text-sm text-neutral-500" aria-busy="true">正在加载状态列表…</p>{:else if listError}<p class="py-8 text-center text-sm text-red-500" role="alert">{listError}</p>{:else if visible.length === 0}<p class="py-8 text-center text-sm text-neutral-500">暂无申请记录</p>{:else}<div class="mt-4 grid gap-2">{#each visible as item}<div class="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/5"><span class="truncate">{item.name || "未命名站点"}</span><span class="shrink-0 text-xs text-neutral-500">{statusNames[item.status || ""] || item.status || "未知"}</span></div>{/each}</div><div class="mt-4 flex items-center justify-end gap-3 text-sm"><button type="button" disabled={page === 1} onclick={() => (page -= 1)}>上一页</button><span>{page} / {pages}</span><button type="button" disabled={page === pages} onclick={() => (page += 1)}>下一页</button></div>{/if}
	</div>
</section>

<style>
	.form-input { width: 100%; border: 1px solid var(--line-divider); border-radius: 0.65rem; background: transparent; padding: 0.55rem 0.75rem; outline: none; }
	.form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
</style>
