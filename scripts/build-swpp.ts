// swpp 构建编排：
// - enable = true：构建 sw.js / dom.js / tracker.json / update.json，并把 SW 注册脚本注入全部 HTML
// - enable = false：生成「自杀 SW」，老访客的 Service Worker 激活时注销自身并清空全部缓存

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { BasicActions } from "swpp-backends";
import { serviceWorkerConfig } from "../src/config/serviceWorkerConfig";
import { resolveSiteRoot } from "./site-root";

// dom.js 的站点内路径，同时作为 HTML 注入的幂等标记
const DOM_JS_URL = "/swpp/dom.js";

// 自杀 SW：install 后立即接管，activate 时注销自身、清空全部缓存并刷新受控页面
const SW_UNINSTALL_SOURCE = `self.addEventListener("install", () => {
	self.skipWaiting();
});
self.addEventListener("activate", (event) => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.map((key) => caches.delete(key)));
		await self.registration.unregister();
		const clients = await self.clients.matchAll({ type: "window" });
		for (const client of clients) {
			try {
				await client.navigate(client.url);
			} catch (error) {
				console.error("swpp: 刷新页面失败", client.url, error);
			}
		}
	})());
});
`;

/**
 * 在 <head> 内注入脚本：registry 紧跟 <head> 开标签之后（等价 afterbegin），
 * dom.js 贴在 </head> 之前（等价 beforeend），注入位置与 swpp cli 保持一致。
 * 返回 null 表示找不到完整的 <head> 结构。
 */
function injectHead(
	html: string,
	registryScript: string,
	domScript: string,
): string | null {
	const openTag = /<head[^>]*>/i.exec(html);
	if (!openTag) return null;
	const openEnd = openTag.index + openTag[0].length;
	const closeStart = html.toLowerCase().lastIndexOf("</head>");
	if (closeStart < openEnd) return null;
	return (
		html.slice(0, openEnd) +
		registryScript +
		html.slice(openEnd, closeStart) +
		domScript +
		html.slice(closeStart)
	);
}

async function main() {
	const siteRoot = resolveSiteRoot();
	if (!existsSync(siteRoot)) {
		console.error(`❌ 站点根目录不存在：${siteRoot}，请先执行 pnpm build`);
		process.exit(1);
	}

	console.log(
		`🛰 Building swpp assets in ${siteRoot}/ (enable = ${serviceWorkerConfig.enable}, escape = ${serviceWorkerConfig.escape})...`,
	);

	if (serviceWorkerConfig.enable) {
		const builder = await BasicActions.build({
			context: "prod",
			publicPath: path.resolve(siteRoot),
			isServiceWorker: true,
			domJsPath: DOM_JS_URL,
		});
		await builder.loadConfig(path.resolve(process.cwd(), "swpp.config.ts"));
		builder.buildConfig();

		const files = await builder.buildFiles();
		// saveFiles 对已存在的文件会抛 file_duplicate，先清掉上次构建可能遗留的产物
		await Promise.all(
			files.map((file) => fs.rm(file.path.absPath, { force: true })),
		);
		await builder.saveFiles();

		// registry 是自包含的 SW 注册函数源码，注入格式与 swpp cli 完全一致
		const runtimeData = builder.runtimeData;
		if (!runtimeData) {
			throw new Error("swpp runtimeData 未初始化");
		}
		const registry: string = runtimeData.domConfig.read("registry");
		const registryScript = `<script>(${registry})()</script>`;
		const domScript = `<script defer src="${DOM_JS_URL}"></script>`;

		const htmlFiles = await glob(`${siteRoot}/**/*.html`);
		let injected = 0;
		for (const file of htmlFiles) {
			const html = await fs.readFile(file, "utf-8");
			// 幂等：已包含 dom.js 引用说明注入过，跳过
			if (html.includes(DOM_JS_URL)) continue;
			const output = injectHead(html, registryScript, domScript);
			if (!output) {
				console.warn(`   ⚠ Skipped ${file}: no <head> found`);
				continue;
			}
			await fs.writeFile(file, output);
			injected++;
		}

		console.log("✨ swpp: generated files:");
		for (const file of files) {
			console.log(`   - ${file.key}: ${file.path.absPath}`);
		}
		console.log(
			`✨ swpp: injected SW registration into ${injected}/${htmlFiles.length} HTML files`,
		);
	} else {
		const swPath = path.join(siteRoot, "sw.js");
		await fs.writeFile(swPath, SW_UNINSTALL_SOURCE);
		console.log(
			`✨ swpp: generated uninstall SW at ${swPath} (old caches will be purged on next visit)`,
		);
	}
}

main().catch((error) => {
	console.error("❌ swpp build failed:", error);
	process.exit(1);
});
