import { fcircleConfig } from "@/config";
import { fetchJson, normalizeLinks } from "@/utils/fcircle-adapter";

export async function GET(): Promise<Response> {
	if (!fcircleConfig.enable || !fcircleConfig.linkApiUrl) {
		return new Response(JSON.stringify({ error: "Fcircle disabled" }), {
			status: 404,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	}

	try {
		const raw = await fetchJson(
			fcircleConfig.linkApiUrl,
			fcircleConfig.timeoutMs,
		);
		const links = normalizeLinks(raw);
		return new Response(JSON.stringify(links), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[fcircle-links.json] 上游请求失败: ${message}`);
		return new Response(
			JSON.stringify({ error: "Fcircle links unavailable", detail: message }),
			{
				status: 502,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			},
		);
	}
}
