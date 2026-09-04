import { fcircleConfig } from "@/config";
import { fetchJson, normalizeArticles } from "@/utils/fcircle-adapter";

export async function GET(): Promise<Response> {
	if (!fcircleConfig.enable || !fcircleConfig.articleApiUrl) {
		return new Response(JSON.stringify({ error: "Fcircle disabled" }), {
			status: 404,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	}

	try {
		const raw = await fetchJson(
			fcircleConfig.articleApiUrl,
			fcircleConfig.timeoutMs,
		);
		const articles = normalizeArticles(raw);
		return new Response(JSON.stringify(articles), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[fcircle-articles.json] 上游请求失败: ${message}`);
		return new Response(
			JSON.stringify({
				error: "Fcircle articles unavailable",
				detail: message,
			}),
			{
				status: 502,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			},
		);
	}
}
