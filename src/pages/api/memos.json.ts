import { dynamicConfig } from "@/config";
import { fetchMemos } from "@/utils/memos-adapter";

export async function GET(): Promise<Response> {
	const memos = dynamicConfig.memos;
	if (!memos?.enable || !memos.apiUrl) {
		return new Response(JSON.stringify([]), {
			status: 404,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	}

	try {
		const data = await fetchMemos(memos.apiUrl, {
			parent: memos.parent,
			tags: memos.tags,
			hideTagsInContent: memos.hideTagsInContent,
		});
		return new Response(JSON.stringify(data), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			},
		});
	} catch (error) {
		// 输出上游失败原因（dev 终端 / 部署平台日志），便于区分网络故障、认证失败等情况
		const message = error instanceof Error ? error.message : String(error);
		const cause =
			error instanceof Error && error.cause instanceof Error
				? ` (${error.cause.message})`
				: "";
		console.error(`[memos.json] 上游请求失败: ${message}${cause}`);
		return new Response(
			JSON.stringify({ error: "Memos service unavailable", detail: message }),
			{
				status: 502,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			},
		);
	}
}
