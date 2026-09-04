/**
 * AI 摘要生成脚本（交互式 CLI）
 *
 * 用法：pnpm ai-summary
 *
 * 扫描 src/content/posts 下的 .md/.mdx 文章（跳过 draft / 加密文章），
 * 交互式选择文章，调用硅基流动 OpenAI 兼容 API 生成 50~100 字中文摘要，
 * 写回 frontmatter 的 aiSummary 字段（仅插入/替换该行，保留原文件格式）。
 *
 * 环境变量（.env）：
 * - SILICONFLOW_API_KEY   必填
 * - SILICONFLOW_BASE_URL  可选，默认 https://api.siliconflow.cn/v1
 * - SILICONFLOW_MODEL     可选，默认 Qwen/Qwen3-8B
 */

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import matter from "gray-matter";

const POSTS_DIR = path.resolve(import.meta.dirname, "../src/content/posts");
const ENV_FILE = path.resolve(import.meta.dirname, "../.env");

const SUMMARY_MIN = 50;
const SUMMARY_MAX = 100;
const BODY_TRUNCATE = 4000;
const REQUEST_TIMEOUT_MS = 60_000;
const MIN_SUMMARY_FALLBACK = 20;

type PostCandidate = {
	filePath: string;
	relativePath: string;
	title: string;
	hasSummary: boolean;
};

type EnvVars = Record<string, string>;

/** 手动解析 .env（项目脚本不引入 dotenv，保持零额外依赖） */
function parseEnvFile(content: string): EnvVars {
	const vars: EnvVars = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		vars[key] = value;
	}
	return vars;
}

async function loadEnv(): Promise<EnvVars> {
	try {
		return parseEnvFile(await fs.readFile(ENV_FILE, "utf-8"));
	} catch {
		return {};
	}
}

/** 剥离 markdown/mdx 语法，提取正文纯文本 */
function extractPlainText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/~~~[\s\S]*?~~~/g, " ")
		.replace(/`[^`\n]*`/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/<\/?[a-zA-Z][^>]*\/?>/g, " ")
		.replace(/^\s*(import|export)\s+[^\n]*$/gm, " ")
		.replace(/^\s*#{1,6}\s+/gm, " ")
		.replace(/^\s*>\s?/gm, " ")
		.replace(/^\s*([-*+]|\d+\.)\s+/gm, " ")
		.replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, "$1")
		.replace(/^\s*([-*_]\s*){3,}\s*$/gm, " ")
		.replace(/\|/g, " ")
		.replace(/\$\$[\s\S]*?\$\$/g, " ")
		.replace(/\$[^$\n]*\$/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** 把摘要转义为 YAML 双引号字符串 */
function toYamlDoubleQuoted(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * 写回 frontmatter 的 aiSummary 字段：
 * 已有则替换该行（含块标量折叠行），没有则在 frontmatter 末尾插入，
 * 文件其余内容与格式保持不变。
 */
function upsertAiSummary(raw: string, summary: string): string {
	const normalized = raw.replace(/\r\n/g, "\n");
	const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
	if (!fmMatch) {
		throw new Error("未找到 frontmatter（--- ... ---）");
	}

	const fmEnd = fmMatch[0].length;
	const fmBody = fmMatch[1];
	const lines = fmBody.split("\n");
	let replaced = false;
	const output: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (/^aiSummary\s*:/.test(line)) {
			output.push(`aiSummary: ${toYamlDoubleQuoted(summary)}`);
			replaced = true;
			// 值为块标量（> / |）时，吞掉后续缩进续行
			const value = line.slice(line.indexOf(":") + 1).trim();
			if (/^[>|][+-]?$/.test(value)) {
				let j = i + 1;
				while (j < lines.length && /^\s+\S/.test(lines[j])) {
					j++;
				}
				i = j - 1;
			}
			continue;
		}
		output.push(line);
	}

	if (!replaced) {
		while (output.length > 0 && output[output.length - 1].trim() === "") {
			output.pop();
		}
		output.push(`aiSummary: ${toYamlDoubleQuoted(summary)}`);
	}

	const newFm = `---\n${output.join("\n")}\n---\n`;
	const rest = normalized.slice(fmEnd);
	return newFm + rest;
}

type ChatResponse = {
	choices?: { message?: { content?: string } }[];
};

/** 剥离模型思考标签、首尾引号与多余空白 */
function sanitizeSummary(content: string): string {
	// 闭合标签用拼接构造，避免源码中出现字面量闭合标签
	const openTag = "<" + "think" + ">";
	const closeTag = "</" + "think" + ">";
	let text = content;
	const openIndex = text.indexOf(openTag);
	if (openIndex >= 0) {
		const closeIndex = text.indexOf(closeTag, openIndex);
		text =
			closeIndex >= 0
				? text.slice(0, openIndex) + text.slice(closeIndex + closeTag.length)
				: text.slice(0, openIndex);
	}
	return text
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^["「『\s]+/, "")
		.replace(/["」』\s]+$/, "")
		.trim();
}

/** 调用硅基流动 OpenAI 兼容 API 生成摘要 */
async function generateSummary(
	apiKey: string,
	baseUrl: string,
	model: string,
	title: string,
	body: string,
): Promise<string> {
	const response = await fetch(
		`${baseUrl.replace(/\/$/, "")}/chat/completions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: [
					{
						role: "system",
						content:
							"你是一名博客文章摘要助手。请根据用户提供的文章标题与正文，生成一段简体中文摘要，用于展示在文章顶部。要求：长度 50~100 个字符；只输出摘要正文；不要出现「本文」「这篇文章」等套话开头，直接概括核心内容；不要使用引号、markdown 格式或换行。",
					},
					{
						role: "user",
						content: `文章标题：${title}\n\n正文内容：${body}`,
					},
				],
				temperature: 0.5,
				max_tokens: 300,
				stream: false,
				enable_thinking: false,
			}),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		},
	);

	if (!response.ok) {
		throw new Error(`API 请求失败：HTTP ${response.status}`);
	}

	const data = (await response.json()) as ChatResponse;
	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("API 返回中缺少 content 字段");
	}

	return sanitizeSummary(content);
}

async function scanPosts(): Promise<PostCandidate[]> {
	const candidates: PostCandidate[] = [];

	async function walk(dir: string): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
				continue;
			}
			if (!/\.(md|mdx)$/.test(entry.name)) continue;

			const raw = await fs.readFile(fullPath, "utf-8");
			const { data } = matter(raw);
			if (data.draft === true) continue;
			if (typeof data.password === "string" && data.password !== "") continue;

			candidates.push({
				filePath: fullPath,
				relativePath: path.relative(POSTS_DIR, fullPath),
				title: typeof data.title === "string" ? data.title : entry.name,
				hasSummary: typeof data.aiSummary === "string" && data.aiSummary !== "",
			});
		}
	}

	await walk(POSTS_DIR);
	candidates.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
	return candidates;
}

function parseSelection(input: string, total: number): number[] {
	const indexes = input
		.split(/[,\s]+/)
		.map((part) => Number.parseInt(part, 10))
		.filter((n) => Number.isInteger(n) && n >= 1 && n <= total);
	return [...new Set(indexes)];
}

async function main() {
	const env = await loadEnv();
	const apiKey = process.env.SILICONFLOW_API_KEY || env.SILICONFLOW_API_KEY;
	const baseUrl =
		process.env.SILICONFLOW_BASE_URL ||
		env.SILICONFLOW_BASE_URL ||
		"https://api.siliconflow.cn/v1";
	const model =
		process.env.SILICONFLOW_MODEL || env.SILICONFLOW_MODEL || "Qwen/Qwen3-8B";

	if (!apiKey) {
		console.error(
			"[AI-SUMMARY] 缺少 API Key：请在 blog/.env 中配置 SILICONFLOW_API_KEY",
		);
		process.exit(1);
	}

	const posts = await scanPosts();
	if (posts.length === 0) {
		console.log("[AI-SUMMARY] src/content/posts 下没有可处理的文章。");
		return;
	}

	console.log("[AI-SUMMARY] 可处理的文章：\n");
	for (const [index, post] of posts.entries()) {
		const marker = post.hasSummary ? "（已有摘要，将重写）" : "";
		console.log(`  ${index + 1}. ${post.title} ${marker}`);
	}

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	const answer = await rl.question(
		"\n输入要处理的序号（多选用逗号分隔，如 1,3,5）：",
	);
	const selected = parseSelection(answer, posts.length);
	if (selected.length === 0) {
		console.log("[AI-SUMMARY] 未选择任何文章，退出。");
		rl.close();
		return;
	}

	const successList: string[] = [];
	const failedList: string[] = [];

	for (const index of selected) {
		const post = posts[index - 1];
		console.log(`\n[AI-SUMMARY] 处理：${post.title}（${post.relativePath}）`);

		try {
			const raw = await fs.readFile(post.filePath, "utf-8");
			const { content } = matter(raw);
			const body = extractPlainText(content).slice(0, BODY_TRUNCATE);
			if (!body) {
				throw new Error("正文提取后为空，无法生成摘要");
			}

			let summary = await generateSummary(
				apiKey,
				baseUrl,
				model,
				post.title,
				body,
			);

			const lengthOk = (): boolean =>
				summary.length >= SUMMARY_MIN && summary.length <= SUMMARY_MAX;

			if (!lengthOk()) {
				console.log(
					`[AI-SUMMARY] 长度 ${summary.length} 字不在 ${SUMMARY_MIN}~${SUMMARY_MAX} 范围内，重试一次……`,
				);
				summary = await generateSummary(
					apiKey,
					baseUrl,
					model,
					post.title,
					body,
				);
			}

			if (!lengthOk()) {
				console.log(
					`[AI-SUMMARY] 重试后长度仍为 ${summary.length} 字：${summary}`,
				);
				if (summary.length < MIN_SUMMARY_FALLBACK) {
					throw new Error("摘要过短，已跳过写入");
				}
				const accept = await rl.question("是否仍写入？(y/N)：");
				if (!/^y(es)?$/i.test(accept.trim())) {
					console.log("[AI-SUMMARY] 已跳过该文章。");
					continue;
				}
			}

			const updated = upsertAiSummary(raw, summary);
			await fs.writeFile(post.filePath, updated, "utf-8");
			console.log(`[AI-SUMMARY] 已写入（${summary.length} 字）：${summary}`);
			successList.push(post.title);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`[AI-SUMMARY] 失败：${message}`);
			failedList.push(post.title);
		}
	}

	rl.close();

	console.log("\n[AI-SUMMARY] 处理完成汇总：");
	console.log(`  成功 ${successList.length} 篇`);
	for (const title of successList) {
		console.log(`    - ${title}`);
	}
	console.log(`  失败 ${failedList.length} 篇`);
	for (const title of failedList) {
		console.log(`    - ${title}`);
	}
	if (failedList.length > 0) {
		process.exitCode = 1;
	}
}

main();
