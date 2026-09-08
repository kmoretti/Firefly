# 朋友圈页面（fcircle）样式完善实施计划

> **For Claude:** 按任务逐项执行本计划；本项目无单元测试，验证手段为 `pnpm check`、`pnpm type-check`、`pnpm build` 与 `pnpm dev` 手动核验。

**Goal:** 重做 `/fcircle/` 页面 UI：新增统计面板与随机文章卡，卡片流改为标题优先的响应式列表，移除逐卡状态徽章，全程使用主题变量适配明暗模式与多端布局。

**Architecture:** 数据仍走现有内部 API 代理（`/api/fcircle-articles.json`、`/api/fcircle-links.json`），articles 端点响应从纯数组改为 `{ stats, articles }` 以透出上游 `statistical_data`（当前被丢弃）。UI 重构集中在 `FcircleFeed.svelte` 单组件内：统计面板、随机文章卡、卡片流、骨架屏均使用 `--primary` / `--card-bg` / `--line-divider` 等 CSS 变量与 Tailwind `dark:` 变体，不硬编码颜色。

**Tech Stack:** Astro 7 + Svelte 5（`$props()` / `$state()` / `$derived()` runes）+ Tailwind CSS 4 + 主题 i18n 体系（`I18nKey` 枚举 + 六语言文件）。

**数据事实（已实测 `fc.081531.xyz`）：**
- `all.json` → `{ statistical_data: { friends_num, active_num, article_num, error_num, last_updated_time }, article_data: [{ title, created, link, author, avatar }] }`，**无图片、无摘要字段**，现有卡片图片区/摘要区永远不会渲染。
- `link.json` → `{ statistical_data, link_data: [{ name, link, avatar, reachable, crawlable, latency, ... }] }`。

---

## 已锁定的设计决策

1. 页面构成：统计面板 + 随机文章卡 + 卡片流 + 更新时间；不做评论区、不做作者弹窗。
2. 卡片形态：标题为主，头像+作者+站点+日期为次级；桌面 2 列、移动端 1 列。
3. 移除全部逐卡状态徽章与底部图例；`showStatus` 改为控制"来源站点不可达 → 卡片降不透明度 + 小灰点"。
4. 分页保留 `ClientPagination`（含 `?page=` URL 同步）。
5. `fcircleConfig` 新增 `showStats` / `showRandom`（默认 `true`）；8 个新 i18n key，六语言补齐；移除 5 个失效的旧徽章 key。

---

### Task 1: 配置与类型层

**Files:**
- Modify: `src/types/fcircleConfig.ts`
- Modify: `src/config/fcircleConfig.ts`

**Step 1:** `src/types/fcircleConfig.ts` 的 `FcircleConfig` 增加两个字段：

```ts
export type FcircleConfig = {
	enable: boolean;
	articleApiUrl: string;
	linkApiUrl: string;
	itemsPerPage: number;
	showStatus: boolean;
	showStats: boolean;
	showRandom: boolean;
	timeoutMs: number;
};
```

**Step 2:** `src/config/fcircleConfig.ts` 在 `showStatus: true` 后补：

```ts
showStats: true,
showRandom: true,
```

**Step 3:** 验证通过后提交：

```bash
git add src/types/fcircleConfig.ts src/config/fcircleConfig.ts
git commit -m "feat(fcircle): add showStats/showRandom config toggles"
```

---

### Task 2: 数据层——透出 statistical_data

**Files:**
- Modify: `src/utils/fcircle-adapter.ts`
- Modify: `src/pages/api/fcircle-articles.json.ts`

**Step 1:** `src/utils/fcircle-adapter.ts` 新增统计类型与归一化函数（放在 `FcircleLinkStatus` 之后）：

```ts
export type FcircleStats = {
	friendsNum: number;
	activeNum: number;
	articleNum: number;
	errorNum: number;
	lastUpdatedTime?: string;
};

export function normalizeStats(raw: unknown): FcircleStats | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const stat = (raw as Record<string, unknown>).statistical_data;
	if (!stat || typeof stat !== "object") return undefined;
	const record = stat as Record<string, unknown>;
	const num = (value: unknown): number =>
		typeof value === "number" && Number.isFinite(value) ? value : 0;
	return {
		friendsNum: num(record.friends_num),
		activeNum: num(record.active_num),
		articleNum: num(record.article_num),
		errorNum: num(record.error_num),
		lastUpdatedTime: safeString(record.last_updated_time),
	};
}
```

**Step 2:** `src/pages/api/fcircle-articles.json.ts` 的 `GET` 中，把

```ts
const articles = normalizeArticles(raw);
return new Response(JSON.stringify(articles), { ... });
```

改为：

```ts
const articles = normalizeArticles(raw);
const stats = normalizeStats(raw);
return new Response(JSON.stringify({ stats, articles }), { ... });
```

（响应体形状变更，消费方 `FcircleFeed.svelte` 在 Task 4 同步更新；两文件同仓同部署，无需兼容旧形状。）

**Step 3:** 验证通过后提交：

```bash
git add src/utils/fcircle-adapter.ts src/pages/api/fcircle-articles.json.ts
git commit -m "feat(fcircle): expose statistical_data via articles API"
```

---

### Task 3: i18n——新增 8 个 key，移除 5 个失效 key

**Files:**
- Modify: `src/i18n/i18nKey.ts`
- Modify: `src/i18n/languages/zh_CN.ts`、`zh_TW.ts`、`en.ts`、`ja.ts`、`ko.ts`、`ru.ts`

**Step 1:** `src/i18n/i18nKey.ts` 中，删除 `fcircleReachable`、`fcircleLatency`、`fcircleCrawlable`、`fcircleNoCrawl` 四个枚举成员（`fcircleUnreachable` 保留，用于不可达卡片的小灰点 tooltip），并在原位置追加：

```ts
fcircleStatsSubscribed = "fcircleStatsSubscribed",
fcircleStatsActive = "fcircleStatsActive",
fcircleStatsArticles = "fcircleStatsArticles",
fcircleStatsFailed = "fcircleStatsFailed",
fcircleLastUpdated = "fcircleLastUpdated",
fcircleRandomTitle = "fcircleRandomTitle",
fcircleRandomNext = "fcircleRandomNext",
fcircleRandomRead = "fcircleRandomRead",
```

**Step 2:** 六个语言文件按下面矩阵增删（`fcircleUnreachable` 各语言已有翻译，保留不动）：

| Key | zh_CN | zh_TW | en | ja | ko | ru |
|---|---|---|---|---|---|---|
| StatsSubscribed | 订阅 | 訂閱 | Subscribed | 購読 | 구독 | Подписки |
| StatsActive | 活跃 | 活躍 | Active | アクティブ | 활성 | Активные |
| StatsArticles | 文章 | 文章 | Articles | 記事 | 게시물 | Статьи |
| StatsFailed | 失败 | 失敗 | Failed | 失敗 | 실패 | Ошибки |
| LastUpdated | 更新时间 | 更新時間 | Last updated | 更新時刻 | 업데이트 시간 | Обновлено |
| RandomTitle | 🎲 随便转转 | 🎲 隨便轉轉 | 🎲 Feeling lucky | 🎲 ランダムに読む | 🎲 랜덤 둘러보기 | 🎲 Случайная статья |
| RandomNext | 🔄 换一篇 | 🔄 換一篇 | 🔄 Shuffle | 🔄 別の記事へ | 🔄 다른 글 | 🔄 Ещё раз |
| RandomRead | 阅读文章 | 閱讀文章 | Read article | 記事を読む | 글 읽기 | Читать статью |

同时删除各语言文件中的 `fcircleReachable`、`fcircleLatency`、`fcircleCrawlable`、`fcircleNoCrawl` 四行。

**Step 3:** 验证（`pnpm check` 会捕获枚举与译文表键不一致）后提交：

```bash
git add src/i18n/
git commit -m "feat(fcircle): add stats/random i18n keys, drop badge keys"
```

---

### Task 4: FcircleFeed.svelte 重构

**Files:**
- Modify: `src/components/pages/fcircle/FcircleFeed.svelte`（整组件重写渲染部分）

**Step 1 — Props 变更：**

- 移除：`reachableText`、`latencyText`、`crawlableText`、`noCrawlText`（4 个）。
- 新增：`showStats: boolean`、`showRandom: boolean`、`statsSubscribedText`、`statsActiveText`、`statsArticlesText`、`statsFailedText`、`lastUpdatedText`、`randomTitle`、`randomNext`、`randomRead`（10 个）。
- 保留：`unreachableText`（小灰点 tooltip）、其余现有文案 props。

**Step 2 — 脚本层变更：**

1. 导入 `type FcircleStats`。
2. 状态：`let stats = $state<FcircleStats | undefined>(undefined);`，`let randomIndex = $state(0);`
3. `load()` 中 articles 分支改为解析新响应形状：

```ts
const result = await fetchWithDedup<{ stats?: FcircleStats; articles?: FcircleArticle[] }>(articlesUrl);
if (result && Array.isArray(result.articles)) {
	articles = result.articles;
	stats = result.stats;
	randomIndex = Math.floor(Math.random() * Math.max(1, articles.length));
} else {
	failed = true;
}
```

4. 派生：`const randomArticle = $derived(articles.length > 0 ? articles[randomIndex] : undefined);`
5. `pickRandom()`：当 `articles.length > 1` 时循环取一个不同于当前 `randomIndex` 的下标赋值。
6. 删除 `statusBadge()`、`crawlBadge()`、`latencyMs()`、`GREEN_BADGE`/`YELLOW_BADGE`/`RED_BADGE` 常量。
7. 新增：`const isUnreachable = (article: FcircleArticle) => showStatus && statusByHost.get(article.siteHost)?.reachable === false;`

**Step 3 — 渲染层（成功态从上到下）：**

1. **统计面板**（`showStats && stats` 时渲染）：

```astro
<section class="card-base mt-8 px-6 py-6">
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		<!-- 每格：大数字 + 小标签，四格分别绑定
		     stats.friendsNum/statsSubscribedText、stats.activeNum/statsActiveText、
		     stats.articleNum/statsArticlesText、stats.errorNum/statsFailedText -->
		<div class="text-center">
			<p class="text-3xl font-bold text-(--primary)">{stats.friendsNum}</p>
			<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{statsSubscribedText}</p>
		</div>
		<!-- ...其余三格同构 -->
	</div>
	{#if stats.lastUpdatedTime}
		<p class="mt-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
			{lastUpdatedText}: {stats.lastUpdatedTime}
		</p>
	{/if}
</section>
```

2. **随机文章卡**（`showRandom && randomArticle` 时渲染）：`card-base mt-4 px-6 py-6`；内容为标题行（`text-lg font-bold`，点击新窗口打开）、元信息行（`✍️ {author} · 📅 {created?.substring(0, 10)}`）、按钮行（"换一篇"按钮 `btn-regular` 调 `pickRandom()`；"阅读文章"链接 `btn-regular text-(--primary)` 新窗口打开）。
3. **卡片流**：容器改为 `mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2`。每张卡（`rounded-xl border border-(--line-divider) bg-(--card-bg) p-4 transition-all duration-300 hover:border-(--primary) hover:shadow-lg`）：
   - 不可达时卡片加 `opacity-60`，标题后缀小灰点 `<span class="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500" title={unreachableText}></span>`；
   - 标题 `<a>` 链接 `line-clamp-2 font-bold`，新窗口打开；
   - 次级行：头像（`h-8 w-8 rounded-full`）+ `{author}`（链接到文章）+ `· {siteHost}` + `· {created?.substring(0, 10)}`，`text-xs text-neutral-500 dark:text-neutral-400`；
   - **不再渲染** images/summary 区块与任何徽章。
4. **删除**底部图例区（绿点/红点说明的 `{#if showStatus && ...}` 块）。
5. **骨架屏**同步为新卡形状：2 列骨架条（标题两条线 + 元信息一行），移除原 16:9 图片骨架。
6. 空态、错误态、`ClientPagination`、`?page=` 同步逻辑保持不变。

**Step 4:** 验证通过后提交：

```bash
git add src/components/pages/fcircle/FcircleFeed.svelte
git commit -m "feat(fcircle): rework feed UI with stats panel, random card, list cards"
```

---

### Task 5: fcircle.astro 接线

**Files:**
- Modify: `src/pages/fcircle.astro`

**Step 1:** 移除 4 个失效 props 传参（`reachableText`、`latencyText`、`crawlableText`、`noCrawlText`），新增：

```astro
showStats={fcircleConfig.showStats}
showRandom={fcircleConfig.showRandom}
statsSubscribedText={i18n(I18nKey.fcircleStatsSubscribed)}
statsActiveText={i18n(I18nKey.fcircleStatsActive)}
statsArticlesText={i18n(I18nKey.fcircleStatsArticles)}
statsFailedText={i18n(I18nKey.fcircleStatsFailed)}
lastUpdatedText={i18n(I18nKey.fcircleLastUpdated)}
randomTitle={i18n(I18nKey.fcircleRandomTitle)}
randomNext={i18n(I18nKey.fcircleRandomNext)}
randomRead={i18n(I18nKey.fcircleRandomRead)}
```

**Step 2:** 提交：

```bash
git add src/pages/fcircle.astro
git commit -m "feat(fcircle): wire stats/random props into page"
```

---

### Task 6: 全量验证与手动核验

**Step 1:** `cd blog && pnpm check`——预期 0 errors（i18n 键完整性由 check 保证）。
**Step 2:** `pnpm type-check`——预期无输出（通过）。
**Step 3:** `pnpm build`——预期构建成功。
**Step 4:** `pnpm dev` 手动核验 `localhost:4321/fcircle/`：
- 明/暗两种模式下：统计面板四格、随机卡（点"换一篇"能换且不重复、标题可点）、卡片流 2 列布局；
- 缩窄视口到手机宽度：卡片回落单列、统计面板 2×2；
- 翻页与 `?page=` 刷新恢复正常；
- 断网/改错 API 地址时错误态正常，`showStats: false` / `showRandom: false` 时对应区块消失。

**Step 5:** 如验证全部通过，收尾提交（若有生成文件变更如 `lqips.json` 一并提交）。
