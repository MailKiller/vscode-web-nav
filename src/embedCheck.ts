// 注意：本文件不能 import vscode，因为 scripts/verify-recommended.js 会在 VS Code 之外直接 require 它。

export type EmbedVerdict = 'ok' | 'blocked' | 'insecure' | 'unknown';

// 抽象出 fetch 的形状，测试时可以传入假的实现，不用访问真实网络
export type FetchLike = (url: string, init?: RequestInit) => Promise<{ url: string; headers: Headers; body: ReadableStream | null }>;

/** 根据响应头判断网站是否禁止被 iframe 嵌入 */
export function verdictFromHeaders(headers: Headers): 'ok' | 'blocked' {
	// X-Frame-Options：deny / sameorigin 都会拒绝第三方嵌入；allow-from 已被浏览器废弃，不算
	const xfo = (headers.get('x-frame-options') ?? '').split(',').map(s => s.trim().toLowerCase());
	if (xfo.includes('deny') || xfo.includes('sameorigin')) {
		return 'blocked';
	}
	// CSP：多条策略用逗号分隔，指令用分号分隔；frame-ancestors 不含 * 就是在限制嵌入
	const csp = headers.get('content-security-policy') ?? '';
	for (const policy of csp.split(',')) {
		for (const directive of policy.split(';')) {
			const parts = directive.trim().split(/\s+/);
			if (parts[0].toLowerCase() === 'frame-ancestors' && !parts.slice(1).includes('*')) {
				return 'blocked';
			}
		}
	}
	return 'ok';
}

// 默认用 Node 自带的全局 fetch
const defaultFetch: FetchLike = (url, init) => fetch(url, init);

/** 请求网址并根据响应头判定能否嵌入；任何异常都视为 unknown */
export async function checkEmbeddable(url: string, fetchFn: FetchLike = defaultFetch, timeoutMs = 8000): Promise<EmbedVerdict> {
	// http 页面放进 https 的 webview 会被当作混合内容拦截，不用再请求
	if (url.startsWith('http:')) {
		return 'insecure';
	}
	try {
		const res = await fetchFn(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
		// 拿到响应头就够了，不下载正文
		void res.body?.cancel().catch(() => undefined);
		const finalUrl = res.url || url;
		if (finalUrl.startsWith('http:')) {
			return 'insecure';
		}
		return verdictFromHeaders(res.headers);
	} catch {
		return 'unknown';
	}
}

/** http 网址尝试升级为 https：只要 https 版本有响应就用它，否则保持原样 */
export async function tryUpgradeToHttps(url: string, fetchFn: FetchLike = defaultFetch, timeoutMs = 8000): Promise<string> {
	if (url.startsWith('https:')) {
		return url;
	}
	const httpsUrl = url.replace(/^http:/, 'https:');
	try {
		const res = await fetchFn(httpsUrl, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
		void res.body?.cancel().catch(() => undefined);
		return httpsUrl;
	} catch {
		return url;
	}
}
