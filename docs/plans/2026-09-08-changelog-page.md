# Changelog 更新日志页面 + 品牌更名实施计划

> **For Claude:** 按任务逐项执行本计划；本项目无单元测试，验证手段为 `pnpm check`、`pnpm type-check`、`pnpm build` 与 `pnpm dev` 手动核验。

**Goal:** 新增 `/changelog/` 更新日志页面（时间线 + 可折叠条目，基于 changelog 内容集合），同时把博客品牌从 Firefly v6.16.7 更名为 KeMiaoBlog v0.0.1（仅版本标识层，页脚开源署名保留）。

**Architecture:** 新建 `changelog` 内容集合（zod schema + glob loader，与 `posts`/`dynamic`/`projects` 同构），页面为纯 Astro 服务端渲染（零 JS 岛），折叠用原生 `<details>/<summary>`，最新一条默认 `open`。时间线圆点与类型徽章颜色从主题 `--hue` / `--primary` 变量派生（oklch），`:root.dark` 提供暗色变体，不硬编码主题色。

**Tech Stack:** Astro 7 内容集合 + astro-icon（`@iconify-json/material-symbols`，已确认 4 个所需图标可用）+ Tailwind CSS 4 + 主题 i18n 六语言体系 + `Markdown.astro` 渲染正文。

**已锁定决策：**
1. 数据：`src/content/changelog/*.md`，frontmatter `version / published / type / title / draft`
2. 类型：4 类 `feature / improvement / fix / removal`，图标与配色映射见 Task 5
3. 交互：原生 details/summary，最新一条默认展开；展开区直接渲染 Markdown 正文（正文不写"变更详情"标题）
4. 导航："我的"下拉组加 `LinkPresets.Changelog` + `siteConfig.pages.changelog` 开关
5. 预置 v0.0.1 真实条目（更名 + 本页上线 + 朋友圈重构 + 上游合并）
6. 更名：`package.json` name/version + SiteInfo 显示 + atom/rss 自动跟随；页脚 "Powered by Astro & Firefly" 与主题文档链接保留原样

---

### Task 1: 品牌更名（KeMiaoBlog v0.0.1）

**Files:**
- Modify: `package.json`（第 2、4 行）
- Modify: `src/components/widget/SiteInfo.astro`（第 32、104 行）

**Step 1:** `package.json`：

```json
"name": "kemiao-blog",
"version": "0.0.1",
```

**Step 2:** `src/components/widget/SiteInfo.astro`：
- 第 104 行 `value: Firefly v${blogVersion}` → `value: KeMiaoBlog v${blogVersion}`
- 第 32 行 fallback `pkg.version || "Firefly unknown"` → `pkg.version || "unknown"`

**Step 3:** 验证并提交：

```bash
pnpm type-check
git add package.json src/components/widget/SiteInfo.astro
git commit -m "chore: rebrand to KeMiaoBlog v0.0.1"
```

（atom.xml / rss.xml 读取 `pkg.version`，自动跟随，无需改动。）

---

### Task 2: changelog 内容集合 + 种子条目

**Files:**
- Modify: `src/content.config.ts`
- Create: `src/content/changelog/2026-09-08-v0.0.1.md`

**Step 1:** `src/content.config.ts` 新增类型与集合（放在 `projectsCollection` 之后）：

```ts
type ChangelogData = {
	version: string;
	published: Date;
	type: "feature" | "improvement" | "fix" | "removal";
	title: string;
	draft: boolean;
};

const changelogCollection: ContentCollection<ChangelogData> = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/changelog" }),
	schema: z.object({
		version: z.string(),
		published: z.coerce.date(),
		type: z.enum(["feature", "improvement", "fix", "removal"]),
		title: z.string(),
		draft: z.boolean().optional().default(false),
	}),
});
```

并把 `changelog` 加入文件末尾 `collections` 的类型声明与对象（与 `projects` 同模式）。

**Step 2:** 创建种子条目 `src/content/changelog/2026-09-08-v0.0.1.md`：

```markdown
---
version: v0.0.1
published: 2026-09-08 20:00
type: feature
title: 更名 KeMiaoBlog，新增更新日志页面
---

- 博客品牌更名：Firefly → **KeMiaoBlog**，版本体系从 v0.0.1 起步
- 新增更新日志页面（本页）：基于 changelog 内容集合，按时间倒序展示版本动态，最新版本默认展开
- 朋友圈页面样式重构：新增统计面板与随机文章卡，卡片流改为标题优先的响应式布局
- 合并上游更新：新增项目展示页、Atom 订阅与 llms.txt 支持
```

**Step 3:** 验证并提交：

```bash
pnpm type-check
git add src/content.config.ts src/content/changelog/
git commit -m "feat(changelog): add changelog content collection with seed entry"
```

---

### Task 3: 页面开关与导航入口

**Files:**
- Modify: `src/types/siteConfig.ts`（pages 类型，`fcircle: boolean` 附近）
- Modify: `src/config/siteConfig.ts`（resolvePageToggles，`fcircle: true` 附近）
- Modify: `src/config/navBarConfig.ts`（LinkPresets + "我的"组）
- Modify: `src/utils/navbar-i18n.ts`（默认名映射）

**Step 1:** `src/types/siteConfig.ts` 的 pages 类型中 `fcircle: boolean;` 后加：

```ts
changelog: boolean; // 更新日志页面开关
```

**Step 2:** `src/config/siteConfig.ts` 的 pages 中 `fcircle: true,` 后加：

```ts
// 更新日志页面开关
changelog: true,
```

**Step 3:** `src/config/navBarConfig.ts` 的 `LinkPresets` 对象中（`Fcircle` 附近）加：

```ts
Changelog: {
	name: "更新日志",
	url: "/changelog/",
	icon: "material-symbols:history",
	pageKey: "changelog",
},
```

并在 `getDynamicNavBarConfig` 的"我的"下拉组 children 中、`LinkPresets.Projects` 之后加：

```ts
// 更新日志
LinkPresets.Changelog,
```

**Step 4:** `src/utils/navbar-i18n.ts` 的 `NAVBAR_DEFAULT_NAMES` 中"朋友圈"一行后加：

```ts
更新日志: I18nKey.changelog,
```

**Step 5:** 验证并提交：

```bash
pnpm type-check
git add src/types/siteConfig.ts src/config/siteConfig.ts src/config/navBarConfig.ts src/utils/navbar-i18n.ts
git commit -m "feat(changelog): add page toggle and navbar entry"
```

---

### Task 4: i18n 六语言文案

**Files:**
- Modify: `src/i18n/i18nKey.ts`
- Modify: `src/i18n/languages/zh_CN.ts`、`zh_TW.ts`、`en.ts`、`ja.ts`、`ko.ts`、`ru.ts`

**Step 1:** `src/i18n/i18nKey.ts` 中 `fcircle` 相关键附近追加：

```ts
changelog = "changelog",
changelogDescription = "changelogDescription",
changelogTypeFeature = "changelogTypeFeature",
changelogTypeImprovement = "changelogTypeImprovement",
changelogTypeFix = "changelogTypeFix",
changelogTypeRemoval = "changelogTypeRemoval",
changelogDetailHint = "changelogDetailHint",
```

**Step 2:** 六语言文件按矩阵补齐：

| Key | zh_CN | zh_TW | en | ja | ko | ru |
|---|---|---|---|---|---|---|
| changelog | 更新日志 | 更新日誌 | Changelog | 更新履歴 | 업데이트 로그 | Журнал изменений |
| changelogDescription | 记录博客项目的功能迭代、问题修复与重要变更 | 記錄部落格的功能迭代、問題修復與重要變更 | Track feature releases, fixes and important changes of this blog | ブログの機能追加・修正・重要な変更を記録 | 블로그의 기능 추가, 수정 및 중요 변경 사항 | Новые функции, исправления и важные изменения блога |
| changelogTypeFeature | 功能新增 | 功能新增 | New features | 新機能 | 새 기능 | Новые функции |
| changelogTypeImprovement | 功能优化 | 功能優化 | Improvements | 改善 | 개선 | Улучшения |
| changelogTypeFix | 问题修复 | 問題修復 | Bug fixes | 修正 | 버그 수정 | Исправления |
| changelogTypeRemoval | 移除 | 移除 | Removals | 削除 | 제거 | Удаления |
| changelogDetailHint | 点击查看详情 | 點擊查看詳情 | Click to view details | クリックで詳細を表示 | 클릭하여 자세히 보기 | Нажмите для подробностей |

**Step 3:** 验证并提交：

```bash
pnpm check
git add src/i18n/
git commit -m "feat(changelog): add i18n keys for six languages"
```

---

### Task 5: changelog.astro 页面（时间线 + 折叠卡）

**Files:**
- Create: `src/pages/changelog.astro`

**Step 1 — 脚本区：**

```astro
---
import { getCollection, render } from "astro:content";
import { Icon } from "astro-icon/components";
import Markdown from "@components/common/Markdown.astro";
import MainGridLayout from "@/layouts/MainGridLayout.astro";
import { siteConfig } from "@/config";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { formatDateI18nWithTime } from "@/utils/date-utils";

if (!siteConfig.pages.changelog) {
	return Astro.redirect("/404/");
}

const title = i18n(I18nKey.changelog);
const description = i18n(I18nKey.changelogDescription);

const entries = (await getCollection("changelog"))
	.filter((entry) => !entry.data.draft)
	.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());

const TYPE_META = {
	feature: { icon: "material-symbols:rocket-launch", cls: "cl-feature", label: i18n(I18nKey.changelogTypeFeature) },
	improvement: { icon: "material-symbols:build", cls: "cl-improvement", label: i18n(I18nKey.changelogTypeImprovement) },
	fix: { icon: "material-symbols:bug-report", cls: "cl-fix", label: i18n(I18nKey.changelogTypeFix) },
	removal: { icon: "material-symbols:delete", cls: "cl-removal", label: i18n(I18nKey.changelogTypeRemoval) },
} as const;

const detailHint = i18n(I18nKey.changelogDetailHint);
---
```

（`Markdown.astro` 的 props 在实现时按实际定义传入；若其接口不匹配内容集 body，则退化为 `<div class="custom-md ...">` 直接包 `<Content />`。）

**Step 2 — 模板结构（MainGridLayout 内）：**

```astro
<MainGridLayout title={title} description={description}>
	<section class="changelog-page" aria-labelledby="changelog-page-title">
		<header class="card-base w-full px-6 py-6 sm:px-9">
			<h1 id="changelog-page-title" class="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{title}</h1>
			<p class="mt-3 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">{description}</p>
		</header>

		<div class="cl-timeline mt-8">
			{entries.map((entry, index) => {
				const meta = TYPE_META[entry.data.type];
				return (
					<article class={`cl-entry ${meta.cls}`}>
						<div class="cl-entry-dot" aria-hidden="true"></div>
						<div class="cl-entry-body">
							<div class="cl-entry-meta text-neutral-500 dark:text-neutral-400">
								<time datetime={entry.data.published.toISOString()}>
									{formatDateI18nWithTime(entry.data.published)}
								</time>
								<span class="cl-entry-type">
									<Icon name={meta.icon} class="text-sm" />
									{meta.label}
								</span>
								<span class="cl-entry-version">{entry.data.version}</span>
							</div>
							<details class="cl-entry-card" open={index === 0}>
								<summary class="cl-entry-summary">
									<p class="cl-entry-text text-neutral-800 dark:text-neutral-100">{entry.data.title}</p>
									<span class="cl-entry-chevron text-neutral-400 dark:text-neutral-500" title={detailHint} aria-hidden="true">
										<Icon name="material-symbols:expand-more" class="text-xl" />
									</span>
								</summary>
								<div class="cl-entry-detail">
									<div class="custom-md">
										<Markdown content={entry.body} />
									</div>
								</div>
							</details>
						</div>
					</article>
				);
			})}
		</div>
	</section>
</MainGridLayout>
```

（`Markdown` 组件如需 `entry`/`Content` 形式，则改用 `const { Content } = await render(entry)` + `<Content />`，实现时以实际组件接口为准。）

**Step 3 — scoped `<style>`（颜色全部从主题变量派生）：**

```css
/* 时间线轨道 */
.cl-timeline { position: relative; padding-left: 2rem; }
.cl-timeline::before {
	content: ""; position: absolute; left: 0.45rem; top: 0.4rem; bottom: 0.4rem;
	width: 2px; border-radius: 1px; background: var(--line-divider);
}

/* 条目与圆点 */
.cl-entry { position: relative; margin-bottom: 1.25rem; }
.cl-entry:last-child { margin-bottom: 0; }
.cl-entry-dot {
	position: absolute; left: -1.75rem; top: 0.45rem; z-index: 2;
	width: 12px; height: 12px; border-radius: 50%;
	border: 3px solid var(--card-bg); flex-shrink: 0;
}
.cl-feature .cl-entry-dot { background: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent); }
.cl-improvement .cl-entry-dot { background: oklch(0.62 0.14 calc(var(--hue) + 55)); box-shadow: 0 0 0 2px oklch(0.62 0.14 calc(var(--hue) + 55) / 0.35); }
.cl-fix .cl-entry-dot { background: oklch(0.68 0.14 85); box-shadow: 0 0 0 2px oklch(0.68 0.14 85 / 0.35); }
.cl-removal .cl-entry-dot { background: oklch(0.63 0.14 25); box-shadow: 0 0 0 2px oklch(0.63 0.14 25 / 0.35); }

/* 元信息行 */
.cl-entry-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.625rem; font-size: 0.8125rem; }
.cl-entry-type {
	display: inline-flex; align-items: center; gap: 0.25rem;
	font-size: 0.6875rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 9999px;
	background: oklch(0.94 0.04 var(--hue)); color: var(--primary);
}
.cl-improvement .cl-entry-type { background: oklch(0.94 0.05 calc(var(--hue) + 55)); color: oklch(0.48 0.14 calc(var(--hue) + 55)); }
.cl-fix .cl-entry-type { background: oklch(0.93 0.06 90); color: oklch(0.48 0.12 85); }
.cl-removal .cl-entry-type { background: oklch(0.94 0.04 25); color: oklch(0.48 0.12 25); }
.cl-entry-version { font-size: 0.8125rem; font-weight: 600; }

/* 折叠卡 */
.cl-entry-card {
	margin-top: 0.75rem; border-radius: 0.75rem;
	border: 1px solid var(--line-divider); background: var(--card-bg);
}
.cl-entry-summary {
	display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
	padding: 0.875rem 1rem; cursor: pointer; user-select: none; list-style: none;
}
.cl-entry-summary::-webkit-details-marker { display: none; }
.cl-entry-text { font-weight: 600; line-height: 1.5; }
.cl-entry-chevron { display: inline-flex; transition: transform 0.2s ease; }
.cl-entry-card[open] .cl-entry-chevron { transform: rotate(180deg); }
.cl-entry-detail { padding: 0 1rem 1rem; }

/* 暗色变体 */
:global(:root.dark) .cl-entry-type { background: oklch(0.26 0.05 var(--hue)); }
:global(:root.dark) .cl-improvement .cl-entry-type { background: oklch(0.26 0.06 calc(var(--hue) + 55)); color: oklch(0.72 0.12 calc(var(--hue) + 55)); }
:global(:root.dark) .cl-fix .cl-entry-type { background: oklch(0.28 0.06 85); color: oklch(0.78 0.12 85); }
:global(:root.dark) .cl-removal .cl-entry-type { background: oklch(0.28 0.06 25); color: oklch(0.75 0.12 25); }

/* 移动端 */
@media (max-width: 640px) {
	.cl-timeline { padding-left: 1.5rem; }
	.cl-entry-dot { left: -1.375rem; width: 10px; height: 10px; }
}
```

注意：`.astro` 的 scoped style 中选择 `:root.dark` 需用 `:global(:root.dark)` 前缀（如上）；`--hue` 变量已在主题中全局定义（`main.css`、`display-settings.css` 均在用）。

**Step 4:** 验证并提交：

```bash
pnpm check && pnpm type-check
git add src/pages/changelog.astro
git commit -m "feat(changelog): add changelog timeline page"
```

---

### Task 6: 全量验证与手动核验

**Step 1:** `pnpm check`——预期 0 errors。
**Step 2:** `pnpm type-check`——预期通过。
**Step 3:** `pnpm build`——预期成功，`dist/changelog/index.html` 生成。
**Step 4:** `pnpm dev` 手动核验 `localhost:4321/changelog/`：
- 明/暗两种模式：时间线轨道与圆点、四种类型徽章颜色正确、徽章与圆点颜色随主题色/暗色切换；
- v0.0.1 条目默认展开，点击其余条目可折叠/展开，箭头旋转；
- Markdown 列表在展开区正常渲染（custom-md 样式）；
- 导航"我的"下拉出现"更新日志"，多语言切换后名称跟随；
- 手机宽度：单列、时间线与卡片不溢出；
- `siteConfig.pages.changelog: false` 时访问 /changelog/ 跳转 404。

**Step 5:** 收尾提交生成文件变更（如有）。
