// 注意：本文件不能 import vscode，保持纯逻辑，方便用假 fetch 单元测试。

// 抽象出 fetch 的形状，测试时可以传入假的实现，不用访问真实网络
export type FaviconFetchLike = (url: string, init?: RequestInit) => Promise<{ ok: boolean; headers: Headers; body: ReadableStream | null }>;

// 默认用 Node 自带的全局 fetch
const defaultFetch: FaviconFetchLike = (url, init) => fetch(url, init);

/** 网址所在站点的 favicon 地址（origin + /favicon.ico）；网址无法解析时返回 undefined */
export function faviconUrlOf(siteUrl: string): string | undefined {
	try {
		return new URL(siteUrl).origin + '/favicon.ico';
	} catch {
		return undefined;
	}
}

/** 探测 favicon 能否使用：响应成功且 content-type 是 image/*；任何异常都视为不可用 */
export async function probeFavicon(iconUrl: string, fetchFn: FaviconFetchLike = defaultFetch, timeoutMs = 5000): Promise<boolean> {
	try {
		const res = await fetchFn(iconUrl, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
		// 只看状态和类型，不下载正文
		void res.body?.cancel().catch(() => undefined);
		// 有的网站对不存在的图标返回 200 + text/html，所以必须检查类型
		return res.ok && (res.headers.get('content-type') ?? '').trim().toLowerCase().startsWith('image/');
	} catch {
		return false;
	}
}
