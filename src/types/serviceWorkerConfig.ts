/** Service Worker（swpp）配置 */
export interface ServiceWorkerConfig {
	/** 是否启用 swpp Service Worker 缓存（false 时构建「自杀 SW」：自动注销并清空所有老用户缓存） */
	enable: boolean;
	/** 逃生门编号：线上出现坏缓存事故时 +1 并重新部署，所有客户端 SW 将自动清空全部缓存 */
	escape: number;
}
