import { dynamicConfig } from "@/config";
import { fetchEch0 } from "@/utils/ech0-adapter";

export async function GET(): Promise<Response> {
	const ech0 = dynamicConfig.ech0;
	if (!ech0?.enable || !ech0.apiUrl) {
		return new Response(JSON.stringify([]), {
			status: 404,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	}

	try {
		const data = await fetchEch0(ech0.apiUrl, {
			pageSize: ech0.pageSize,
			maxPages: ech0.maxPages,
		});
		return new Response(JSON.stringify(data), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			},
		});
	} catch (error) {
		// 输出上游失败原因（dev 终端 / 部署平台日志），便于区分网络故障等情况
		const message = error instanceof Error ? error.message : String(error);
		const cause =
			error instanceof Error && error.cause instanceof Error
				? ` (${error.cause.message})`
				: "";
		console.error(`[ech0.json] 上游请求失败: ${message}${cause}`);
		return new Response(
			JSON.stringify({ error: "Ech0 service unavailable", detail: message }),
			{
				status: 502,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			},
		);
	}
}
