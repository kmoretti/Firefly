import { visit } from "unist-util-visit";

/**
 * 为文章中的外部链接添加 target="_blank" 和 rel="noopener noreferrer"
 * 仅处理以 http:// 或 https:// 开头且不属于本站的链接
 * 当 config.enable 为 true 时，将外链 href 替换为本站中转页地址（白名单命中则跳过替换）
 *
 * @param {Object} options
 * @param {string} [options.siteUrl] - 站点URL，用于判断是否为内部链接
 * @param {Object} [options.config] - 外链中转配置
 * @param {boolean} [options.config.enable] - 是否启用 href 替换
 * @param {string[]} [options.config.whitelist] - 白名单域名，命中则跳过替换
 * @returns {Function} rehype transformer
 */
export default function rehypeExternalLinks(options = {}) {
	const siteUrl = options.siteUrl || "";
	const config = options.config || {};
	let siteHost = "";
	try {
		siteHost = new URL(siteUrl).host;
	} catch (_e) {
		/* ignore */
	}

	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "a") return;

			const href = node.properties?.href;
			if (typeof href !== "string") return;

			// 只处理 http/https 绝对链接
			if (!href.startsWith("http://") && !href.startsWith("https://")) return;

			// 跳过本站链接
			if (siteHost) {
				try {
					if (new URL(href).host === siteHost) return;
				} catch (_e) {
					/* ignore */
				}
			}

			// 已以 /go/ 开头的链接一律跳过（避免重复包裹）
			if (href.startsWith("/go/")) return;

			// 启用替换时，将非白名单外链替换为本站中转页地址
			if (config.enable === true) {
				const whitelisted = (config.whitelist || []).some((domain) =>
					href.includes(domain),
				);
				if (!whitelisted) {
					const encoded = Buffer.from(
						encodeURIComponent(href),
						"utf8",
					).toString("base64");
					node.properties.href = `/go/?u=${encodeURIComponent(encoded)}`;
				}
			}

			node.properties.target = "_blank";
			node.properties.rel = "noopener noreferrer";
		});
	};
}
