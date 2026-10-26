import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { buildExplanationHtml, buildIframeHtml } from '../html';

const base = { url: 'https://github.com/', cspSource: 'vscode-resource:', nonce: 'N', styleUri: 's.css', scriptUri: 'p.js' };

suite('html', () => {
	test('blocked 文案与三个链接', () => {
		const h = buildExplanationHtml({ ...base, reason: 'blocked', removable: true });
		for (const t of ['无法在编辑器中打开 github.com', '这个网站禁止被其他页面嵌入，这是它自己的安全设置，插件没有办法绕过。', '在浏览器中打开', '复制链接', '从列表中移除']) {
			assert.ok(h.includes(t), t);
		}
	});
	test('推荐网站不显示移除', () => {
		assert.ok(!buildExplanationHtml({ ...base, reason: 'blocked', removable: false }).includes('从列表中移除'));
	});
	test('insecure 文案', () => {
		const h = buildExplanationHtml({ ...base, url: 'http://a.com/', reason: 'insecure', removable: true });
		assert.ok(h.includes('这个网站只支持不加密的 http 连接，VS Code 不允许在编辑器里加载这类页面。'));
	});
	test('脚本带 nonce', () => {
		assert.ok(/<script nonce="N" src="p.js">/.test(buildExplanationHtml({ ...base, reason: 'blocked', removable: true })));
	});
	test('iframe 页转义网址', () => {
		const h = buildIframeHtml({ url: 'https://a.com/?q="><script>x</script>', cspSource: 'c' });
		assert.ok(!h.includes('"><script>'));
		assert.ok(h.includes('&quot;&gt;&lt;script&gt;'));
	});
	test('不写死颜色', () => {
		const css = fs.readFileSync(path.resolve(__dirname, '../../media/panel.css'), 'utf8');
		const page = buildExplanationHtml({ ...base, reason: 'blocked', removable: true });
		for (const s of [css, page]) {
			assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(s));
		}
	});
});
