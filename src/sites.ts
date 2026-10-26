import * as vscode from 'vscode';

export interface Site {
	name: string;
	url: string;
}

export const CONFIG_SECTION = 'webNav';

// 以下四个是纯函数，不依赖 vscode，方便单独测试。

/** 规范化网址：补 https://，只接受 http/https，无效返回 undefined。 */
export function normalizeUrl(input: string): string | undefined {
	let text = input.trim();
	if (!text) {
		return undefined;
	}
	// 用是否包含 "://" 判断有无协议；不能用通用的 scheme: 正则，否则 a.com:8080 会被误判成协议
	if (!text.includes('://')) {
		text = 'https://' + text;
	}
	try {
		const url = new URL(text);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return undefined;
		}
		return url.href;
	} catch {
		return undefined;
	}
}

/** 取主机名；解析失败时原样返回。 */
export function hostnameOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

/** 清洗设置里读出来的任意数据：丢弃坏条目，url 规范化，name 为空时用主机名。 */
export function sanitizeSites(raw: unknown): Site[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	const result: Site[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) {
			continue;
		}
		const { name, url } = item as { name?: unknown; url?: unknown };
		if (typeof url !== 'string') {
			continue;
		}
		const normalized = normalizeUrl(url);
		if (!normalized) {
			continue;
		}
		const trimmedName = typeof name === 'string' ? name.trim() : '';
		result.push({ name: trimmedName || hostnameOf(normalized), url: normalized });
	}
	return result;
}

/** 按规范化后的 url 查找，返回下标，找不到返回 -1。 */
export function findSite(sites: Site[], url: string): number {
	const target = normalizeUrl(url);
	if (!target) {
		return -1;
	}
	return sites.findIndex(site => normalizeUrl(site.url) === target);
}

// 以下函数读写 VS Code 设置。

export function getUserSites(): Site[] {
	const raw = vscode.workspace.getConfiguration(CONFIG_SECTION).get<unknown>('sites');
	return sanitizeSites(raw);
}

export function saveUserSites(sites: Site[]): Thenable<void> {
	return vscode.workspace
		.getConfiguration(CONFIG_SECTION)
		.update('sites', sites, vscode.ConfigurationTarget.Global);
}

export function isRecommendedVisible(): boolean {
	return vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>('showRecommended', true);
}
