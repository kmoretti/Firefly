import {
	AllowNotFoundEnum,
	defineCompilationEnv,
	defineCrossDep,
	defineCrossEnv,
} from "swpp-backends";
import { siteConfig } from "./src/config/siteConfig";
import { serviceWorkerConfig } from "./src/config/serviceWorkerConfig";

const SITE_ORIGIN = new URL(siteConfig.site_url).origin;

/**
 * 缓存白名单判定（Node 端实现）。
 *
 * 返回 false 表示不缓存；返回 -1 表示永久缓存（跳过 swpp 的更新检查）。
 * 注意：此实现与 defineCrossDep 中 runOnBrowser 的内联实现行为必须保持一致
 * （官方约定：两端产生相同的副作用即可，内部具体实现允许不同）。
 */
function matchCacheRuleByUrl(url: URL, siteOrigin: string): number | false {
	const { pathname } = url;
	// 跨域资源永不缓存（友链等第三方站点的资源由此外置）
	if (url.origin !== siteOrigin) return false;
	// API 动态响应不缓存
	if (pathname.startsWith("/api/")) return false;
	// 带内容哈希的构建产物与搜索索引：文件名即版本，永久缓存
	if (pathname.startsWith("/_astro/") || pathname.startsWith("/pagefind/")) {
		return -1;
	}
	// HTML 页面永久缓存，由 swpp 的版本更新机制负责失效
	if (pathname.endsWith("/") || pathname.endsWith(".html")) return -1;
	// 字体、图片等静态资源永久缓存
	if (/\.(?:html|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|ico)$/i.test(pathname)) {
		return -1;
	}
	return false;
}

defineCompilationEnv({
	DOMAIN_HOST: new URL(siteConfig.site_url),
	ALLOW_NOT_FOUND: AllowNotFoundEnum.ALLOW_ALL,
});

defineCrossEnv({
	// 逃生门编号，与 serviceWorkerConfig.escape 联动
	ESCAPE: serviceWorkerConfig.escape,
});

defineCrossDep({
	matchCacheRule: {
		// 浏览器端实现：swpp 通过 toString() 将此函数序列化进 sw.js，
		// 闭包与外层标识符会丢失，因此函数体必须自包含
		runOnBrowser: (url: URL): number | false => {
			const { pathname } = url;
			if (url.origin !== self.location.origin) return false;
			if (pathname.startsWith("/api/")) return false;
			if (pathname.startsWith("/_astro/") || pathname.startsWith("/pagefind/")) {
				return -1;
			}
			if (pathname.endsWith("/") || pathname.endsWith(".html")) return -1;
			if (/\.(?:html|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|ico)$/i.test(pathname)) {
				return -1;
			}
			return false;
		},
		// Node 端实现：构建时计算增量更新规则，允许闭包调用模块内的共用函数
		runOnNode: (url: URL) => matchCacheRuleByUrl(url, SITE_ORIGIN),
	},
});
