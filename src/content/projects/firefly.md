---
title: "Firefly 主题魔改（KeMiaoBlog）"
order: 100
published: 2026-09-10
description: "基于 Firefly 主题深度魔改的个人博客，新增动态说说、朋友圈、更新日志、友链系统、右键菜单等大量自研功能。"
image: "https://openlist.081531.xyz/d/yidong/imgbed/blog-screenshot.webp"
status: "published"
tags:
  - Astro
  - Svelte
  - TypeScript
  - TailwindCSS
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/kmoretti/Firefly"
  - label: "在线预览"
    icon: "fa7-solid:link"
    value: "https://b.kemeow.top"
  - label: "上游主题"
    icon: "fa7-brands:github"
    value: "https://github.com/CuteLeaf/Firefly"
---

## 项目简介

基于 [CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly) 主题深度魔改的个人博客（KeMiaoBlog），在保留上游现代技术栈与基础能力的前提下，围绕"说说、社交、工程化"三个方向做了大量自研扩展。相对上游累计 190+ 文件、1.4 万行级别的改动，全部功能均配置驱动、随取随用。

## 核心魔改功能

### 动态说说系统

- [x] **Memos 实时数据源** - 动态页通过同源代理 `/api/memos.json` 对接自部署 Memos 实例，支持用户过滤、标签预筛与正文标签隐藏
- [x] **说说卡片** - 标签点击筛选、全文搜索、年份归档、图片画廊、锚点分享
- [x] **行内评论** - 每条说说卡片内嵌评论区，与主评论系统共用配置
- [x] **说说点赞** - 接入自部署 [star-vote](https://github.com/kmoretti/star-vote) 实例，localStorage 防重复点赞、乐观更新、明暗模式自适应

### 社交与互动页面

- [x] **朋友圈（FCircle）重构** - 统计面板、随机漫游卡片、列表卡片三种视图，可独立开关
- [x] **友链系统增强** - 远程友链自动同步、友链墓碑、访客友链申请表单
- [x] **更新日志时间线** - 独立 changelog 内容集合，版本时间线展示
- [x] **纪念倒计时页** - 十周年倒计时页面，支持配置目标日期

### 站点体验

- [x] **自定义右键菜单** - 全站自研右键菜单，样式与功能可配置
- [x] **AI 文章摘要** - 构建时生成文章摘要，角标交互展开
- [x] **外链中转** - `go` 跳转页 + rehype 外链处理插件，防来源泄露
- [x] **欢迎提示与时钟** - 访客 IP 欢迎 Toast、侧栏欢迎时钟（接入和风天气）
- [x] **页脚翻页时钟** - 建站时长翻页钟组件
- [x] **FPS 帧率监视器** - 可选的帧率悬浮监控
- [x] **GitHub 卡片管理器** - 构建时拉取仓库信息并缓存，正文实时渲染仓库卡片
- [x] **首页推荐轮播与聚光灯** - 首页特色内容轮播、Spotlight 布局增强
- [x] **Umami 统计** - 接入 Umami 分析与侧栏统计组件，兼容 GA / Clarity / 51la

### 工程化

- [x] **SWPP 缓存** - Service Worker 增量缓存与版本更新
- [x] **构建流水线** - 字体子集化、内联脚本压缩、LQIP 占位图生成、VNDB 封面预取、Pagefind 索引
- [x] **多平台部署** - Vercel / Cloudflare Workers / EdgeOne 配置与 CI 就绪

## 保留的上游能力

Astro 静态生成 + Svelte 5 岛屿、Swup 页面过渡、Pagefind 全文搜索、i18n 六语言（简中/繁中/英/日/俄/韩）、亮暗色模式、四种壁纸模式、单/双栏侧边栏、列表与网格布局、字体管理、360° 主题色调节等基础能力全部保留，并持续同步上游更新。

## 快速开始

### 环境要求

- Node.js ≥ 22
- pnpm ≥ 11

### 本地开发

```bash
git clone https://github.com/kmoretti/Firefly.git
cd Firefly
pnpm install
pnpm dev
```

博客将在 `http://localhost:4321` 可用，站点功能通过 `src/config/` 目录下的配置文件自定义。

### 构建与部署

```bash
pnpm build
pnpm preview
```

仓库内置 Vercel（`vercel.json`）、Cloudflare Workers（`wrangler.jsonc`）与 EdgeOne 部署配置，主流平台可直接导入并自动识别 Astro 框架预设，构建命令 `pnpm build`、输出目录 `dist`。
