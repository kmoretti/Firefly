const STORAGE_KEY = "firefly-dynamic-liked";

let likedIds: Set<string> | null = null;

function getLikedIds(): Set<string> {
	if (!likedIds) {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			likedIds = new Set(raw ? (JSON.parse(raw) as string[]) : []);
		} catch {
			likedIds = new Set();
		}
	}
	return likedIds;
}

function persistLikedIds(ids: Set<string>) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
	} catch {
		// localStorage 不可用时跳过持久化，仅本次会话内生效
	}
}

export function registerDynamicLike(): void {
	if (customElements.get("dynamic-like")) return;

	class DynamicLike extends HTMLElement {
		connectedCallback() {
			if (this.dataset.ready) return;
			this.dataset.ready = "true";
			this.init();
		}

		private async init() {
			const button =
				this.querySelector<HTMLButtonElement>("[data-like-button]");
			if (!button) return;

			if (this.dataset.provider === "ech0") {
				// 原生点赞：计数直接来自 Ech0 fav_count，点击 PUT like 接口
				const endpoint = this.dataset.likeEndpoint || "";
				const nativeVoteId = this.dataset.voteId || "";
				if (!endpoint || !nativeVoteId) return;
				this.dataset.liked = String(getLikedIds().has(nativeVoteId));
				const count = this.querySelector("[data-like-count]");
				if (count) count.textContent = this.dataset.likeCount || "0";
				button.disabled = false;
				button.addEventListener("click", () =>
					this.likeNative(endpoint, nativeVoteId),
				);
				return;
			}

			const apiUrl = this.dataset.apiUrl;
			const voteId = this.dataset.voteId;
			if (!apiUrl || !voteId) return;

			this.dataset.liked = String(getLikedIds().has(voteId));

			// 拉取当前点赞数（star-vote: GET /api/vote/info?id=<id> → { votes: { up, down } }）
			try {
				const response = await fetch(
					`${apiUrl.replace(/\/+$/, "")}/api/vote/info?id=${encodeURIComponent(voteId)}`,
				);
				if (response.ok) {
					const data = (await response.json()) as { votes?: { up?: number } };
					// 仅在用户尚未点赞时覆盖计数，避免与乐观更新竞态
					if (!getLikedIds().has(voteId)) {
						const count = this.querySelector("[data-like-count]");
						if (count) count.textContent = String(data.votes?.up ?? 0);
					}
				}
			} catch {
				// 计数获取失败时保持初始显示，按钮仍可点赞
			}
			button.disabled = false;

			button.addEventListener("click", () => this.vote(apiUrl, voteId));
		}

		/** 原生点赞（Ech0）：乐观更新 + 失败回滚，与 star-vote 路径共用 localStorage 去重 */
		private async likeNative(endpoint: string, voteId: string) {
			const button =
				this.querySelector<HTMLButtonElement>("[data-like-button]");
			if (!button || button.dataset.busy === "true") return;
			const likedIds = getLikedIds();
			if (likedIds.has(voteId)) return;

			const countEl = this.querySelector("[data-like-count]");
			const previous = countEl?.textContent ?? "0";

			button.dataset.busy = "true";
			this.dataset.liked = "true";
			if (countEl) countEl.textContent = String(Number(previous) + 1);
			likedIds.add(voteId);
			persistLikedIds(likedIds);

			try {
				const response = await fetch(endpoint, { method: "PUT" });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
			} catch {
				likedIds.delete(voteId);
			persistLikedIds(likedIds);
				this.dataset.liked = "false";
				if (countEl) countEl.textContent = previous;
			} finally {
				button.dataset.busy = "false";
			}
		}

		private async vote(apiUrl: string, voteId: string) {
			const button =
				this.querySelector<HTMLButtonElement>("[data-like-button]");
			if (!button || button.dataset.busy === "true") return;
			const likedIds = getLikedIds();
			if (likedIds.has(voteId)) return;

			const countEl = this.querySelector("[data-like-count]");
			const previous = countEl?.textContent ?? "0";

			// 乐观更新
			button.dataset.busy = "true";
			this.dataset.liked = "true";
			if (countEl) countEl.textContent = String(Number(previous) + 1);
			likedIds.add(voteId);
			persistLikedIds(likedIds);

			try {
				const response = await fetch(
					`${apiUrl.replace(/\/+$/, "")}/api/vote/update?id=${encodeURIComponent(voteId)}&value=up`,
				);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
			} catch {
				// 失败回滚
				likedIds.delete(voteId);
				persistLikedIds(likedIds);
				this.dataset.liked = "false";
				if (countEl) countEl.textContent = previous;
			} finally {
				button.dataset.busy = "false";
			}
		}
	}

	customElements.define("dynamic-like", DynamicLike);
}
