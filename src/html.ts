import { hostnameOf } from './sites';

// 本文件只生成 HTML 字符串，不依赖 vscode，方便单独测试。

/** 转义 HTML 特殊字符，防止网址或名称里的字符破坏页面结构。 */
export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** 可以嵌入的网站：整页只放一个铺满的 iframe。 */
export function buildIframeHtml(o: { url: string; cspSource: string }): string {
	// frame-src 只放行 https，和 insecure 判定保持一致
	const csp = `default-src 'none'; frame-src https:; style-src ${o.cspSource} 'unsafe-inline';`;
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
iframe { display: block; border: 0; width: 100%; height: 100%; }
</style>
</head>
<body>
<iframe src="${escapeHtml(o.url)}"></iframe>
</body>
</html>`;
}

/** 无法嵌入时的说明页：只用主题变量，保持安静、不刺眼。 */
export function buildExplanationHtml(o: {
	url: string;
	reason: 'blocked' | 'insecure';
	removable: boolean;
	cspSource: string;
	nonce: string;
	styleUri: string;
	scriptUri: string;
}): string {
	const csp = `default-src 'none'; style-src ${o.cspSource}; script-src 'nonce-${o.nonce}';`;
	const host = escapeHtml(hostnameOf(o.url));
	const reasonText = o.reason === 'blocked'
		? '这个网站禁止被其他页面嵌入，这是它自己的安全设置，插件没有办法绕过。'
		: '这个网站只支持不加密的 http 连接，VS Code 不允许在编辑器里加载这类页面。';
	// 推荐网站不是用户自己添加的，所以不提供移除
	const removeLink = o.removable ? '<a href="#" data-action="remove">从列表中移除</a>' : '';
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${escapeHtml(o.styleUri)}">
</head>
<body>
<div class="icon">⊘</div>
<h1>无法在编辑器中打开 ${host}</h1>
<p class="reason">${reasonText}</p>
<div class="links">
<a href="#" data-action="openExternal">在浏览器中打开</a>
<a href="#" data-action="copy">复制链接</a>
${removeLink}
</div>
<script nonce="${o.nonce}" src="${escapeHtml(o.scriptUri)}"></script>
</body>
</html>`;
}
