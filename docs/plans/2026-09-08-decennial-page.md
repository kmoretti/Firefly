# 十年之约（decennial）页面实施计划

> **For Claude:** 按任务逐项执行；本项目无单元测试，验证手段为 `pnpm check`、`pnpm type-check`、`pnpm build` 与 `pnpm dev` 手动核验。

**Goal:** 新增 `/decennial/` 十年之约页面：建站天数动画计数、起止日期、履约事项与成就清单（达标变色）、动画进度条、引言，配色全部从主题变量派生。

**Architecture:** 新建 `decennialConfig.ts` 独立配置（enable / siteStartDate / 阈值）；页面为纯 Astro 服务端渲染 + 一段客户端脚本（define:vars 注入数据，做天数滚动与进度条动画）。构建时统计文章数与字数（剥除代码块后中文字符 + 英文字母计数），原创 = 非草稿且无 `sourceLink`。入口进导航组，行为与 changelog/fcircle 一致。

**Tech Stack:** Astro 7 + astro-icon + ImageWrapper（头像）+ 主题 i18n 六语言 + Tailwind + 主题 oklch hue 派生配色。

**已锁定决策：**
1. 配置：`src/config/decennialConfig.ts`：enable: true、siteStartDate: "2024-11-01"、thresholds（originalPosts:10 / posts:100 / words1:100000 / words2:1000000 / days1:100 / days2:1000 / promiseMonths:6）
2. 到期日 = 建站日 + 3650 天 = 2034-10-30
3. 原创 = 非草稿且无 sourceLink；字数算法照参考（剥代码块/行内代码/空白，中文字符数 + 英文字母数）
4. 导航："我的"组 LinkPresets.Decennial（icon: material-symbols:event-availability）+ pages.decennial 开关
5. i18n 约 20 key 六语言；引言/副标题沿用参考文案；头像读 profileConfig.avatar
6. 硬编码色全部替换：顶部渐变条与进度条渐变从 --primary/--hue 派生；文字用 neutral + dark: 类；达标绿 oklch(0.6 0.2 calc(var(--hue) - 80))、超期红 oklch(0.7 0.2 calc(var(--hue) + 135))；头像边框 var(--card-bg)；容器用 card-base；进度条底 var(--page-bg)


---

### Task 1: 类型与配置文件

**Files:**
- Create: `src/types/decennialConfig.ts`
- Create: `src/config/decennialConfig.ts`
- Modify: `src/config/index.ts`（barrel 导出，与 fcircleConfig 同模式）

**Step 1:** `src/types/decennialConfig.ts`：

```ts
export type DecennialThresholds = {
	originalPosts: number; // 履约事项：至少 N 篇原创
	posts: number; // 成就：发布 N 篇原创文章
	words1: number; // 成就：总字数达 N 字
	words2: number; // 成就：总字数达 N 字
	days1: number; // 成就：正常运行 N 天
	days2: number; // 成就：正常运行 N 天
	promiseMonths: number; // 履约事项：N 个月内有新文章
};

export type DecennialConfig = {
	enable: boolean;
	siteStartDate: string; // YYYY-MM-DD
	thresholds: DecennialThresholds;
};
```

**Step 2:** `src/config/decennialConfig.ts`：

```ts
import type { DecennialConfig } from "../types/decennialConfig";

export const decennialConfig: DecennialConfig = {
	enable: true,
	siteStartDate: "2024-11-01",
	thresholds: {
		originalPosts: 10,
		posts: 100,
		words1: 100_000,
		words2: 1_000_000,
		days1: 100,
		days2: 1000,
		promiseMonths: 6,
	},
};
```

注意：成就条目文案（"发布100篇原创文章"等）在 i18n 中是静态文本，若日后改阈值需同步改译文。

**Step 3:** `src/config/index.ts` 中仿照 `fcircleConfig` 加 `export { decennialConfig } from "./decennialConfig";`。

**Step 4:** 验证并提交：

```bash
pnpm type-check
git add src/types/decennialConfig.ts src/config/decennialConfig.ts src/config/index.ts
git commit -m "feat(decennial): add decennial config"
```

---

### Task 2: 页面开关与导航入口

**Files:**
- Modify: `src/types/siteConfig.ts`（pages 类型，`changelog: boolean;` 后）
- Modify: `src/config/siteConfig.ts`（`changelog: true,` 后）
- Modify: `src/config/navBarConfig.ts`（LinkPresets + "我的"组）
- Modify: `src/utils/navbar-i18n.ts`（映射）

**Step 1:** types：`changelog: boolean;` 后加 `decennial: boolean; // 十年之约页面开关`

**Step 2:** config：`changelog: true,` 后加 `// 十年之约页面开关` + `decennial: true,`

**Step 3:** navBarConfig：`Changelog` 预设后加：

```ts
Decennial: {
	name: "十年之约",
	url: "/decennial/",
	icon: "material-symbols:event-availability",
	pageKey: "decennial",
},
```

"我的"组 children 中 `LinkPresets.Changelog,` 后加 `// 十年之约` + `LinkPresets.Decennial,`

**Step 4:** navbar-i18n：`更新日志: I18nKey.changelog,` 后加 `十年之约: I18nKey.decennialTitle,`

**Step 5:** 提交（i18n key 在 Task 3 补，type-check 报 decennialTitle 缺失属预期中间态）：

```bash
git add src/types/siteConfig.ts src/config/siteConfig.ts src/config/navBarConfig.ts src/utils/navbar-i18n.ts
git commit -m "feat(decennial): add page toggle and navbar entry"
```

---

### Task 3: i18n 六语言文案（20 key）

**Files:**
- Modify: `src/i18n/i18nKey.ts` + 六个语言文件

**Step 1:** i18nKey 在 `changelogDetailHint` 后追加 20 个成员：decennialTitle / decennialSubtitle / decennialDaysCounter / decennialCountFrom / decennialCountTo / decennialPromiseTitle / decennialAchievementTitle / decennialProgressTitle / decennialQuote / decennialDaysAgo / decennialDaysToGo / decennialCharacterUnit / decennialDayUnit / decennialPostUnit / decennialAchievementEntry1-6 / decennialPromiseEntry1-2

**Step 2:** 六语言矩阵：

| Key | zh_CN | en |
|---|---|---|
| Title | 十年之约 | Decennial Countdown |
| Subtitle | 我的博客 · 十年之约 | My Blog · Decennial Countdown |
| DaysCounter | 已运行天数 | Days Since Online |
| CountFrom | 建站日期 | Starts on |
| CountTo | 十年之约到期日 | Ends on |
| PromiseTitle | 📄 履约事项： | 📄 Promise TODOs |
| AchievementTitle | 🎉 履约成就： | 🎉 Achievements |
| ProgressTitle | 履约进度： | Countdown progress |
| Quote | 十年之约，是坚持，是承诺，是对未来的期许。无论风雨，无论晴好，我会在这里记录、分享、成长。 | A decennial miracle will soon bloom on this site. |
| DaysAgo | 天前发布 | days since last post |
| DaysToGo | 天后 | days to go |
| CharacterUnit | 字 | characters |
| DayUnit | 天 | days |
| PostUnit | 篇 | posts |
| AchievementEntry1-6 | 发布100篇原创文章 / 总字数达10万字 / 总字数达100万字 / 正常运行100天 / 正常运行1000天 / 完成十年之约 | Post 100 original articles / Write 100k words / Write 1m words / Run normally for 100 days / Run normally for 1000 days / Accomplish the Decennial Countdown |
| PromiseEntry1-2 | 六个月内有新文章发布 / 至少有十篇原创文章 | Post at least one article in six months / Post at least ten original posts |

zh_TW：十年之約 / 我的部落格 · 十年之約 / 已執行天數 / 建站日期 / 十年之約到期日 / 📄 履約事項： / 🎉 履約成就： / 履約進度： / 十年之約，是堅持，是承諾，是對未來的期許。無論風雨，無論晴好，我會在這裡記錄、分享、成長。/ 天前發布 / 天後 / 字 / 天 / 篇 / 發布100篇原創文章 / 總字數達10萬字 / 總字數達100萬字 / 正常執行100天 / 正常執行1000天 / 完成十年之約 / 六個月內有新文章發布 / 至少有十篇原創文章

ja：十年の契約 / 私のブログ · 十年の契約 / 運営日数 / サイト開設日 / 十年の契約期日 / 📄 公約事項： / 🎉 達成実績： / 達成進捗： / 十年の契約は、信念であり、約束であり、未来への期待です。晴れも雨も、ここで記録し、共有し、成長し続けます。/ 日前の投稿 / 日後 / 字 / 日 / 篇 / 100本のオリジナル記事の投稿 / 累計10万字 / 累計100万字 / 100日間の正常運営 / 1000日間の正常運営 / 十年の契約の達成 / 6ヶ月以内に新しい記事の投稿 / 10本以上のオリジナル記事

ko：10년의 약속 / 내 블로그 · 10년의 약속 / 운영 일수 / 사이트 개설일 / 10년의 약속 만기일 / 📄 이행 항목： / 🎉 이행 성취： / 이행 진행률： / 10년의 약속은 신념이자 약속이자 미래를 향한 기대입니다. 비바람이 불어도 여기에서 기록하고 공유하며 성장하겠습니다. / 일 전 게시 / 일 후 / 자 / 일 / 편 / 원본 글 100편 발행 / 총 10만 자 달성 / 총 100만 자 달성 / 100일간 정상 운영 / 1000일간 정상 운영 / 10년의 약속 완수 / 6개월 이내 새 글 발행 / 원본 글 10편 이상

ru：Десятилетний договор / Мой блог · Десятилетний договор / Дней с запуска / Дата запуска / Окончание договора / 📄 Обязательства： / 🎉 Достижения： / Прогресс договора： / Десятилетний договор — это верность, обещание и надежда на будущее. В любую погоду я буду здесь записывать, делиться и расти. / дн. с последней публикации / дн. до конца / знаков / дн. / публикаций / Опубликовать 100 оригинальных статей / Написать 100 тыс. знаков / Написать 1 млн знаков / 100 дней нормальной работы / 1000 дней нормальной работы / Выполнить десятилетний договор / Новая статья не реже раза в полгода / Не менее десяти оригинальных статей

**Step 3:** `pnpm check`（0 errors）后提交：

```bash
git add src/i18n/
git commit -m "feat(decennial): add i18n keys for six languages"
```


---

### Task 4: decennial.astro 页面

**Files:**
- Create: `src/pages/decennial.astro`

**Step 1 — frontmatter 脚本区：**

```astro
---
import { getCollection } from "astro:content";
import ImageWrapper from "@components/common/ImageWrapper.astro";
import MainGridLayout from "@/layouts/MainGridLayout.astro";
import { siteConfig, decennialConfig, profileConfig } from "@/config";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";

if (!siteConfig.pages.decennial || !decennialConfig.enable) {
	return Astro.redirect("/404/");
}

const title = i18n(I18nKey.decennialTitle);
const subtitle = i18n(I18nKey.decennialSubtitle);

const allBlogPosts = await getCollection("posts", ({ data }) => {
	return import.meta.env.PROD ? data.draft !== true : true;
});

let words = 0;
for (const post of allBlogPosts) {
	if (post.body) {
		const text = post.body
			.replace(/```[\s\S]*?```/g, "")
			.replace(/`[^`]*`/g, "")
			.replace(/\s+/g, " ")
			.trim();
		const chineseChars = text.match(/[一-龥]/g) || [];
		const englishChars = text.match(/[a-zA-Z]/g) || [];
		words += chineseChars.length + englishChars.length;
	}
}

const originalPosts = allBlogPosts.filter((p) => !p.data.sourceLink).length;
const sorted = [...allBlogPosts].sort((a, b) =>
	new Date(a.data.published) > new Date(b.data.published) ? -1 : 1,
);
const latest = sorted[0];
const latestTitle = latest?.data.title ?? "";
const latestDate = latest ? new Date(latest.data.published) : new Date();
const { thresholds } = decennialConfig;
---
```

**Step 2 — 模板结构（MainGridLayout 内）：**

```astro
<div class="card-base decennial-container">
	<div class="decennial-title text-4xl font-bold text-neutral-900 dark:text-neutral-100">{subtitle}</div>
	<div class="avatar-container">
		<ImageWrapper src={profileConfig.avatar || ""} alt={profileConfig.name} class="decennial-avatar" loading="lazy" />
	</div>
	<div id="days-counter" class="text-7xl font-bold text-neutral-900 dark:text-neutral-100"></div>
	<div class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialDaysCounter)}</div>

	<div class="date-info">
		<div class="date-box">
			<div class="text-base text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialCountFrom)}</div>
			<div id="start-date" class="text-2xl font-bold text-neutral-900 dark:text-neutral-100"></div>
		</div>
		<div class="date-box">
			<div class="text-base text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialCountTo)}</div>
			<div id="end-date" class="text-2xl font-bold text-neutral-900 dark:text-neutral-100"></div>
		</div>
	</div>

	<div class="label-container">
		<div class="text-lg font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialPromiseTitle)}</div>
		<div class="horizontal-items">
			<div id="promise1-title" class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialPromiseEntry1)}</div>
			<div id="promise1-text" class="text-base text-neutral-900 dark:text-neutral-100"></div>
		</div>
		<div class="horizontal-items">
			<div id="promise2-title" class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialPromiseEntry2)}</div>
			<div class="text-base text-neutral-900 dark:text-neutral-100">{originalPosts} {i18n(I18nKey.decennialPostUnit)}</div>
		</div>
	</div>

	<div class="label-container">
		<div class="text-lg font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialAchievementTitle)}</div>
		<div class="horizontal-items">
			<div id="ach1-title" class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialAchievementEntry1)}</div>
			<div class="text-base text-neutral-900 dark:text-neutral-100">{originalPosts} {i18n(I18nKey.decennialPostUnit)}</div>
		</div>
		<div class="horizontal-items">
			<div id="ach2-title" class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialAchievementEntry2)}</div>
			<div class="text-base text-neutral-900 dark:text-neutral-100">{words} {i18n(I18nKey.decennialCharacterUnit)}</div>
		</div>
		<div class="horizontal-items">
			<div id="ach3-title" class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialAchievementEntry3)}</div>
			<div class="text-base text-neutral-900 dark:text-neutral-100">{words} {i18n(I18nKey.decennialCharacterUnit)}</div>
		</div>
		<div class="horizontal-items">
			<div id="ach4-title" class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialAchievementEntry4)}</div>
			<div id="ach4-text" class="text-base text-neutral-900 dark:text-neutral-100"></div>
		</div>
		<div class="horizontal-items">
			<div id="ach5-title" class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialAchievementEntry5)}</div>
			<div id="ach5-text" class="text-base text-neutral-900 dark:text-neutral-100"></div>
		</div>
		<div class="horizontal-items">
			<div id="ach6-title" class="text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialAchievementEntry6)}</div>
			<div id="ach6-text" class="text-base text-neutral-900 dark:text-neutral-100"></div>
		</div>
	</div>

	<div class="progress-container">
		<div class="progress-label">
			<div class="text-base text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialProgressTitle)}</div>
			<div id="progress-percent" class="text-base font-bold text-neutral-900 dark:text-neutral-100"></div>
		</div>
		<div class="progress-bar"><div id="progress-fill" class="progress-fill"></div></div>
	</div>

	<div class="quote text-base font-bold text-neutral-900 dark:text-neutral-100">{i18n(I18nKey.decennialQuote)}</div>
</div>
```


**Step 3 — scoped `<style>`（全部主题变量派生）：**

```css
.decennial-container { position: relative; overflow: hidden; padding: 2.5rem; text-align: center; }
.decennial-container::before {
	content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 8px;
	background: linear-gradient(90deg, oklch(0.7 0.15 calc(var(--hue) + 40)), oklch(0.75 0.12 calc(var(--hue) + 80)));
}
.avatar-container {
	margin: 1.25rem auto 1.875rem; width: 150px; height: 150px; border-radius: 50%;
	overflow: hidden; border: 5px solid var(--card-bg);
	box-shadow: 0 5px 15px rgb(0 0 0 / 0.1); user-select: none;
}
.decennial-avatar { width: 100%; height: 100%; object-fit: cover; }
.date-info { display: flex; justify-content: space-between; flex-wrap: wrap; margin: 1.875rem 0; }
.date-box {
	flex: 1; min-width: 200px; margin: 0.625rem; padding: 1.25rem;
	background: var(--page-bg); border-radius: 0.75rem;
	box-shadow: 0 5px 15px rgb(0 0 0 / 0.05); transition: transform 0.3s ease;
}
.date-box:hover { transform: translateY(-5px); }
.date-title { margin-bottom: 0.625rem; }
.label-container { display: flex; flex-direction: column; gap: 0.625rem; text-align: left; margin: 1.25rem 0; }
.horizontal-items { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.progress-container { margin: 2.5rem 0 1.25rem; text-align: left; }
.progress-label { display: flex; justify-content: space-between; margin-bottom: 0.625rem; }
.progress-bar {
	height: 20px; background: var(--page-bg); border-radius: 10px; overflow: hidden;
	box-shadow: inset 0 2px 5px rgb(0 0 0 / 0.1);
}
.progress-fill {
	height: 100%; width: 0; border-radius: 10px; position: relative; overflow: hidden;
	background: linear-gradient(90deg, var(--primary), oklch(0.7 0.14 calc(var(--hue) + 80)));
	transition: width 1.5s ease-in-out;
}
.progress-fill::after {
	content: ""; position: absolute; inset: 0;
	background-image: linear-gradient(-45deg, rgb(255 255 255 / 0.2) 25%, transparent 25%, transparent 50%, rgb(255 255 255 / 0.2) 50%, rgb(255 255 255 / 0.2) 75%, transparent 75%, transparent);
	background-size: 20px 20px; animation: decennial-stripes 1s linear infinite;
}
@keyframes decennial-stripes { 0% { background-position: 0 0; } 100% { background-position: 20px 0; } }
.quote {
	margin-top: 1.875rem; font-style: italic; line-height: 1.6; text-align: left;
	border-left: 4px solid var(--primary); padding-left: 0.9375rem;
	color: var(--primary);
}
@media (max-width: 600px) {
	.decennial-container { padding: 1.25rem; }
	.date-info { flex-direction: column; }
	.date-box { min-width: 100%; }
}
```

**Step 4 — 客户端脚本（`<script define:vars={{...}}>`，参考站 demo 脚本逻辑）：**

```astro
<script define:vars={{
	startDate, latestDateISO: latestDate.toISOString(), latestTitle,
	originalPosts, words,
	dayUnit: i18n(I18nKey.decennialDayUnit),
	dayAgoUnit: i18n(I18nKey.decennialDaysAgo),
	daysToGoUnit: i18n(I18nKey.decennialDaysToGo),
	thresholds,
}}>
	const today = new Date();
	const begin = new Date(startDate);
	const end = new Date(begin); end.setDate(end.getDate() + 3650);
	const latest = new Date(latestDateISO);
	const elapsed = Math.ceil((today - latest) / 86400000);
	const counter = Math.ceil((today - begin) / 86400000);
	const daysTogo = Math.max(Math.ceil((end - today) / 86400000), 0);
	const progress = (counter / 3650 * 100).toFixed(1);
	const ACHIEVED = "oklch(0.6 0.2 calc(var(--hue) - 80))";
	const LATE = "oklch(0.7 0.2 calc(var(--hue) + 135))";

	function formatDate(date) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, "0");
		const d = String(date.getDate()).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}

	document.getElementById("start-date").textContent = formatDate(begin);
	document.getElementById("end-date").textContent = formatDate(end);
	document.getElementById("progress-percent").textContent = `${progress}%`;

	// 履约事项1：六个月内是否有新文章
	document.getElementById("promise1-title").style.color =
		elapsed <= thresholds.promiseMonths * 30 ? ACHIEVED : LATE;
	document.getElementById("promise1-text").textContent =
		`${elapsed} ${dayAgoUnit}: ${latestTitle}`;

	// 成就上色
	document.getElementById("ach1-title").style.color =
		originalPosts >= thresholds.posts ? ACHIEVED : "";
	document.getElementById("ach2-title").style.color =
		words >= thresholds.words1 ? ACHIEVED : "";
	document.getElementById("ach3-title").style.color =
		words >= thresholds.words2 ? ACHIEVED : "";
	document.getElementById("ach4-text").textContent = `${counter} ${dayUnit}`;
	document.getElementById("ach4-title").style.color = counter >= thresholds.days1 ? ACHIEVED : "";
	document.getElementById("ach5-text").textContent = `${counter} ${dayUnit}`;
	document.getElementById("ach5-title").style.color = counter >= thresholds.days2 ? ACHIEVED : "";
	document.getElementById("ach6-text").textContent = `${daysTogo} ${daysToGoUnit}`;
	document.getElementById("ach6-title").style.color = daysTogo === 0 ? ACHIEVED : "";

	// 进度条动画
	setTimeout(() => { document.getElementById("progress-fill").style.width = `${progress}%`; }, 500);

	// 天数滚动动画
	let current = 0;
	const counterEl = document.getElementById("days-counter");
	const increment = Math.ceil(counter / 100);
	const timer = setInterval(() => {
		current += increment;
		if (current >= counter) { current = counter; clearInterval(timer); }
		counterEl.textContent = current;
	}, 20);
</script>
```

（`define:vars` 脚本为 inline，Astro 不做类型检查；`formatDate` 内嵌实现。）

**Step 5:** `pnpm check && pnpm type-check` 后提交：

```bash
git add src/pages/decennial.astro
git commit -m "feat(decennial): add decennial countdown page"
```

---

### Task 5: 全量验证与手动核验

**Step 1:** `pnpm check` 0 errors；`pnpm type-check` 通过；`pnpm build` 成功且 `dist/decennial/index.html` 生成。
**Step 2:** dev 核验 `localhost:4321/decennial/`：
- 天数从 0 滚动到 686（2024-11-01 至 2026-09-08），进度约 18.8%；
- 明/暗模式：渐变条、进度条、文字颜色正常；
- 达标项绿色、未达标默认色（当前 4 篇原创 < 10，应为默认色）；
- 履约事项 1 显示"最新文章 N 天前发布: 标题"，180 天内为绿；
- 导航"我的"下拉出现"十年之约"，六语言切换名称跟随；
- 手机宽度：日期盒纵向堆叠、头像居中、进度条不溢出；
- `enable: false` 或 `pages.decennial: false` 时访问 /decennial/ 跳转 404。

**Step 3:** 收尾提交生成文件变更（如有）。

