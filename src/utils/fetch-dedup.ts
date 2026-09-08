/**
 * 请求去重工具
 * 避免同页面多个组件重复请求同一接口
 */

const pendingFetches = new Map<string, Promise<unknown>>();

export function fetchWithDedup<T>(url: string): Promise<T> {
	const pending = pendingFetches.get(url);
	if (pending) return pending as Promise<T>;

	const promise = fetch(url).then((r) => {
		if (!r.ok) throw new Error("Failed to fetch");
		return r.json() as Promise<T>;
	});
	pendingFetches.set(url, promise);
	// 清理缓存用的派生 promise 自行接住 rejection，避免失败时产生未处理的 Promise 拒绝
	promise.finally(() => pendingFetches.delete(url)).catch(() => {});
	return promise;
}
