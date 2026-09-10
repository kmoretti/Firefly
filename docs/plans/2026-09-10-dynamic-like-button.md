# 动态页面点赞按钮（star-vote）实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在动态（说说）卡片底部操作条添加点赞按钮，接入自部署 star-vote 实例（https://vote.081531.xyz/），配置驱动、适配多端与明暗模式。

**Architecture:** 复用动态页面已有的"模板 + 自定义元素"模式：`DynamicItemTemplate.astro` 渲染 `<dynamic-like>` 自定义元素，新增 `dynamic-like.ts` 注册逻辑（拉取计数、点赞、localStorage 软去重、乐观更新），`DynamicFeed.svelte` 为每张卡片写入投票 id。样式全部使用主题 CSS 变量，无硬编码颜色。

**Tech Stack:** Astro 组件模板、原生 Web Component（与 `dynamic-inline-comments` 同模式）、star-vote GET API、localStorage。

**已确认的设计决策（grill-me 收敛）：**

1. 纯点赞：单按钮 + 计数，只发 `value=up`，不提供取消（star-vote 只增不减）。
2. 位置：卡片底部操作条，与评论开关同一行（点赞在左、评论在右），共用一条 border-top 分隔线。
3. 投票 id：`<idPrefix>:<entry.id>`，前缀默认 `dynamic`，可配置。
4. 防重复：localStorage 键 `firefly-dynamic-liked` 记录已赞 id；点赞采用乐观更新，请求失败回滚。
5. 配置：`dynamicConfig.like`（可选块），未配置或 `enable: false` 时不渲染按钮。
6. 部署前提：**star-vote 实例的 `HOSTS` 环境变量必须包含博客生产域名**（我已实测该实例启用了 Referer 白名单）；本地联调还需包含 `localhost`。这属于部署配置，不在代码任务内。

---

### Task 1: 扩展类型定义

**Files:**
- Modify: `src/types/dynamicConfig.ts`

**Step 1: 添加 `DynamicLikeConfig` 类型与 `like` 字段**

在文件末尾（`DynamicMemocsConfig` 之后）追加：

```ts
export type DynamicLikeConfig = {
	/** 是否启用动态点赞 */
	enable: boolean;
	/** 自部署 star-vote 实例地址，如 "https://vote.example.com" */
	apiUrl: string;
	/** 投票 id 前缀，最终投票 id 为 "<idPrefix>:<动态 id>"，默认 "dynamic" */
	idPrefix?: string;
};
```

在 `DynamicConfig` 类型的 `memos?: DynamicMemocsConfig;` 之后追加：

```ts
	// 点赞配置（star-vote）；未配置或 enable 为 false 时不渲染点赞按钮
	like?: DynamicLikeConfig;
```

**Step 2: 验证**

Run: `pnpm type-check`
Expected: PASS（无类型错误）

**Step 3: Commit**

```bash
git add src/types/dynamicConfig.ts
git commit -m "feat: add like config type for dynamic page"
```

---

### Task 2: 添加点赞配置

**Files:**
- Modify: `src/config/dynamicConfig.ts`

**Step 1: 在 `memos` 配置块之后追加**

```ts
	// ========== 点赞配置 ==========
	// 使用自部署 star-vote（https://github.com/kmoretti/star-vote）实现动态点赞
	// 注意：实例的 HOSTS 环境变量需包含博客生产域名（本地调试需包含 localhost），否则请求返回 403
	like: {
		// 是否启用动态点赞
		enable: true,

		// star-vote 实例地址
		apiUrl: "https://vote.081531.xyz",

		// 投票 id 前缀，最终投票 id 为 "<idPrefix>:<动态 id>"
		idPrefix: "dynamic",
	},
```

**Step 2: 验证**

Run: `pnpm type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/config/dynamicConfig.ts
git commit -m "feat: enable dynamic like via star-vote config"
```

---

### Task 3: 添加 i18n 文案

**Files:**
- Modify: `src/i18n/i18nKey.ts`
- Modify: `src/i18n/languages/zh_CN.ts`、`zh_TW.ts`、`en.ts`、`ja.ts`、`ko.ts`、`ru.ts`

**Step 1: 在 `i18nKey.ts` 的 `dynamicLoadMore` 附近添加枚举项**

```ts
	dynamicLike = "dynamicLike",
```

**Step 2: 在 6 个语言文件的 dynamic 文案区（`dynamicLoadMore` 附近）各添加一行**

| 文件 | 文案 |
|------|------|
| `zh_CN.ts` | `[Key.dynamicLike]: "点赞",` |
| `zh_TW.ts` | `[Key.dynamicLike]: "點讚",` |
| `en.ts` | `[Key.dynamicLike]: "Like",` |
| `ja.ts` | `[Key.dynamicLike]: "いいね",` |
| `ko.ts` | `[Key.dynamicLike]: "좋아요",` |
| `ru.ts` | `[Key.dynamicLike]: "Нравится",` |

**Step 3: 验证**

Run: `pnpm type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/i18n/i18nKey.ts src/i18n/languages/
git commit -m "feat: add dynamic like i18n strings"
```

---

### Task 4: 新建 `dynamic-like.ts` 自定义元素逻辑

**Files:**
- Create: `src/components/pages/dynamic/dynamic-like.ts`

**Step 1: 写入完整实现**

```ts
const STORAGE_KEY = "firefly-dynamic-liked";

let likedIds: Set<string> | null = null;

function getLikedIds(): Set<string> {
	if (!likedIds) {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			likedIds = new Set(raw ? (JSON.parse(raw) as string[]) : []);
		} catch {
			likedIds = new Set();
		}
	}
	return likedIds;
}

function persistLikedIds(ids: Set<string>) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
	} catch {
		// localStorage 不可用时跳过持久化，仅本次会话内生效
	}
}

export function registerDynamicLike(): void {
	if (customElements.get("dynamic-like")) return;

	class DynamicLike extends HTMLElement {
		connectedCallback() {
			if (this.dataset.ready) return;
			this.dataset.ready = "true";
			this.init();
		}

		private async init() {
			const button = this.querySelector<HTMLButtonElement>("[data-like-button]");
			const apiUrl = this.dataset.apiUrl;
			const voteId = this.dataset.voteId;
			if (!button || !apiUrl || !voteId) return;

			this.dataset.liked = String(getLikedIds().has(voteId));

			// 拉取当前点赞数（star-vote: GET /api/vote/info?id=<id> → { votes: { up, down } }）
			try {
				const response = await fetch(
					`${apiUrl.replace(/\/+$/, "")}/api/vote/info?id=${encodeURIComponent(voteId)}`,
				);
				if (response.ok) {
					const data = (await response.json()) as { votes?: { up?: number } };
					// 仅在用户尚未点赞时覆盖计数，避免与乐观更新竞态
					if (!getLikedIds().has(voteId)) {
						const count = this.querySelector("[data-like-count]");
						if (count) count.textContent = String(data.votes?.up ?? 0);
					}
				}
			} catch {
				// 计数获取失败时保持初始显示，按钮仍可点赞
			}
			button.disabled = false;

			button.addEventListener("click", () => this.vote(apiUrl, voteId));
		}

		private async vote(apiUrl: string, voteId: string) {
			const button = this.querySelector<HTMLButtonElement>("[data-like-button]");
			if (!button || button.dataset.busy === "true") return;
			const likedIds = getLikedIds();
			if (likedIds.has(voteId)) return;

			const countEl = this.querySelector("[data-like-count]");
			const previous = countEl?.textContent ?? "0";

			// 乐观更新
			button.dataset.busy = "true";
			this.dataset.liked = "true";
			if (countEl) countEl.textContent = String(Number(previous) + 1);
			likedIds.add(voteId);
			persistLikedIds(likedIds);

			try {
				const response = await fetch(
					`${apiUrl.replace(/\/+$/, "")}/api/vote/update?id=${encodeURIComponent(voteId)}&value=up`,
				);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
			} catch {
				// 失败回滚
				likedIds.delete(voteId);
				persistLikedIds(likedIds);
				this.dataset.liked = "false";
				if (countEl) countEl.textContent = previous;
			} finally {
				button.dataset.busy = "false";
			}
		}
	}

	customElements.define("dynamic-like", DynamicLike);
}
```

**Step 2: 验证**

Run: `pnpm type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/pages/dynamic/dynamic-like.ts
git commit -m "feat: add dynamic-like custom element for star-vote"
```

---

### Task 5: 卡片模板加入底部操作条与点赞按钮

**Files:**
- Modify: `src/components/pages/dynamic/DynamicItemTemplate.astro`

**Step 1: 在 frontmatter 中读取配置**

在 `const profileUrl = ...` 之后追加：

```ts
const likeConfig = dynamicConfig.like;
const likeEnabled = Boolean(likeConfig?.enable && likeConfig.apiUrl);
```

**Step 2: 用操作条包裹评论组件并插入点赞按钮**

将模板结尾的：

```astro
			<div class="dynamic-tags" data-dynamic-tags hidden></div>
			<DynamicInlineComments src="" />
```

替换为：

```astro
			<div class="dynamic-tags" data-dynamic-tags hidden></div>
			<div class="dynamic-actions">
				{likeEnabled && (
					<dynamic-like
						class="dynamic-like"
						data-api-url={likeConfig.apiUrl}
						data-id-prefix={likeConfig.idPrefix || "dynamic"}
						data-vote-id=""
					>
						<button
							type="button"
							class="dynamic-like-button"
							data-like-button
							disabled
							aria-pressed="false"
							aria-label={i18n(I18nKey.dynamicLike)}
						>
							<Icon
								name="material-symbols:favorite-outline-rounded"
								class="dynamic-like-icon-outline"
							/>
							<Icon
								name="material-symbols:favorite-rounded"
								class="dynamic-like-icon-filled"
							/>
							<span data-like-count>0</span>
						</button>
					</dynamic-like>
				)}
				<DynamicInlineComments src="" />
			</div>
```

说明：`data-vote-id` 初始为空，由 `DynamicFeed.svelte` 在 `createItem` 时按条目填入；模板内容是惰性的，克隆入 DOM 时 dataset 已就绪，`connectedCallback` 能读到正确值。

**Step 3: 验证**

Run: `pnpm check && pnpm type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/pages/dynamic/DynamicItemTemplate.astro
git commit -m "feat: add like button to dynamic card action bar"
```

---

### Task 6: DynamicFeed 填充投票 id 并注册元素

**Files:**
- Modify: `src/components/pages/dynamic/DynamicFeed.svelte`

**Step 1: 导入注册函数**

在 `import { registerDynamicInlineComments } from "./dynamic-inline-comments";` 之后追加：

```ts
import { registerDynamicLike } from "./dynamic-like";
```

**Step 2: onMount 中注册**

将：

```ts
	registerDynamicGallery();
	registerDynamicInlineComments();
```

改为：

```ts
	registerDynamicGallery();
	registerDynamicInlineComments();
	registerDynamicLike();
```

**Step 3: createItem 中写入投票 id 并清理空操作条**

在 createItem 内、处理 `dynamic-inline-comments` 的代码块之后追加：

```ts
	// 点赞：写入本条动态的投票 id（"<前缀>:<动态 id>"）
	const like = root.querySelector<HTMLElement>("dynamic-like");
	if (like) {
		like.dataset.voteId = `${like.dataset.idPrefix || "dynamic"}:${entry.id}`;
	}

	// 点赞与评论都不可用时移除空操作条，避免留下孤立的分隔线
	const actions = root.querySelector<HTMLElement>(".dynamic-actions");
	if (actions && !actions.firstElementChild) actions.remove();
```

**Step 4: 验证**

Run: `pnpm check && pnpm type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/pages/dynamic/DynamicFeed.svelte
git commit -m "feat: wire dynamic feed items to like votes"
```

---

### Task 7: 样式（主题变量、明暗模式、多端断点）

**Files:**
- Modify: `src/styles/dynamic.css`

**Step 1: 将操作条容器样式加到 `.dynamic-tags` 区块之后**

```css
.dynamic-actions {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	margin: 0.75rem 0 0 3.75rem;
	border-top: 1px solid color-mix(in srgb, var(--content-meta) 16%, transparent);
	padding-top: 0.35rem;
}
```

**Step 2: 精简 `.dynamic-inline-comments` 的定位样式**

将：

```css
.dynamic-inline-comments {
	display: block;
	margin: 0.75rem 0 0 3.75rem;
	border-top: 1px solid color-mix(in srgb, var(--content-meta) 16%, transparent);
	padding-top: 0.35rem;
}
```

改为（外边距与分隔线上移到 `.dynamic-actions`）：

```css
.dynamic-inline-comments {
	display: block;
}
```

**Step 3: 在 `.dynamic-comment-toggle` 规则之后添加点赞按钮样式**

```css
.dynamic-like-button {
	display: inline-flex;
	min-height: 2.25rem;
	align-items: center;
	gap: 0.4rem;
	padding: 0 0.25rem;
	border: 0;
	border-radius: 0;
	background: transparent;
	color: var(--content-meta);
	font-size: 0.85rem;
	cursor: pointer;
	transition: color 150ms ease;
}

.dynamic-like-button:hover:not([data-busy="true"]),
.dynamic-like-button:focus-visible {
	color: var(--primary);
}

.dynamic-like-button:disabled {
	cursor: default;
}

.dynamic-like-icon-filled {
	display: none;
}

.dynamic-like[data-liked="true"] .dynamic-like-button {
	color: var(--primary);
}

.dynamic-like[data-liked="true"] .dynamic-like-icon-outline {
	display: none;
}

.dynamic-like[data-liked="true"] .dynamic-like-icon-filled {
	display: inline;
}
```

说明：颜色全部来自 `--content-meta` / `--primary` / 透明度混合，明暗模式由主题变量自动切换，无硬编码。

**Step 4: 移动端断点适配**

将 768px 媒体查询中的：

```css
	.dynamic-content,
	.dynamic-gallery,
	.dynamic-tags,
	.dynamic-inline-comments {
		margin-left: 0;
	}
```

改为：

```css
	.dynamic-content,
	.dynamic-gallery,
	.dynamic-tags,
	.dynamic-actions {
		margin-left: 0;
	}
```

**Step 5: 验证**

Run: `pnpm check && pnpm type-check && pnpm build`
Expected: 全部 PASS，构建成功（留意生成的 `src/constants/lqips.json` 等是否有无关 diff，如有则还原）。

**Step 6: Commit**

```bash
git add src/styles/dynamic.css
git commit -m "feat: style dynamic like button with theme variables"
```

---

### Task 8: 手动验证（pnpm dev）

**Step 1: 确认 star-vote 白名单**

实例 `HOSTS` 需包含生产域名；本地联调需包含 `localhost`。若未包含，先到 star-vote 部署处补充，否则 `vote/info` 返回 403。

**Step 2: 本地手动检查清单**

Run: `pnpm dev`，打开 `http://localhost:4321/dynamic/`：

1. 每张说说卡片底部显示"点赞"按钮 + 计数，与评论开关同一行、共用分隔线；点赞在左、评论在右。
2. 点击后计数 +1，心形图标变为实心主色；再次点击无效果；刷新页面后已赞状态保持（localStorage）。
3. 明暗模式切换，按钮颜色跟随 `--primary`/`--content-meta`，无异常底色。
4. 浏览器窗口缩到 375px 宽：操作条不溢出、无左侧缩进；640px 断点下卡片内边距正常。
5. 评论关闭场景：临时把 `showComment` 设为 `false`，确认仅剩点赞按钮时布局正常；再把 `like.enable` 设为 `false`，确认操作条整体消失、无孤立分隔线。（验证完还原配置。）
6. Network 面板确认请求打到 `https://vote.081531.xyz/api/vote/info` 与 `/api/vote/update`，id 形如 `dynamic:<memos-uid>`。

**Step 3: 最终验证与提交**

Run: `pnpm check && pnpm type-check && pnpm lint && pnpm build`
Expected: 全部 PASS。

如以上全部通过，向用户汇报验证结果；是否合并/推送由用户决定。
