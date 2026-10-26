import * as assert from 'assert';
import * as vscode from 'vscode';
import { SiteTreeProvider, TreeNode } from '../siteTree';
import { EmbedChecker } from '../embedChecker';
import { FaviconChecker } from '../faviconChecker';
import { EmbedVerdict } from '../embedCheck';
import { Site } from '../sites';

const siteNode: TreeNode = { kind: 'site', site: { name: 'A', url: 'https://a.com/' }, source: 'mine' };

// 假的检测器：只提供树视图用到的 cached 和 onDidChange，避免真实联网
function p(o: { sites?: Site[]; show?: boolean; verdict?: EmbedVerdict; icon?: boolean }) {
	const checker = {
		cached: () => o.verdict,
		onDidChange: () => ({ dispose() {} }),
	} as unknown as EmbedChecker;
	// 假的 favicon 探测器：icon 为 undefined 表示探测还没完成
	const favicons = {
		cached: () => o.icon,
		check: () => Promise.resolve(o.icon ?? false),
		onDidChange: () => ({ dispose() {} }),
	} as unknown as FaviconChecker;
	return new SiteTreeProvider(checker, favicons, {
		userSites: () => o.sites ?? [{ name: 'A', url: 'https://a.com/' }],
		showRecommended: () => o.show ?? true,
	});
}

suite('siteTree', () => {
	test('隐藏推荐时只有我的网站', async () =>
		assert.deepStrictEqual((await p({ show: false }).getChildren())!.map(n => (n as any).id), ['mine']));
	test('空列表显示 empty 节点', async () =>
		assert.strictEqual((await p({ sites: [] }).getChildren({ kind: 'group', id: 'mine' }))![0].kind, 'empty'));
	test('blocked 网站带 ⚠', () =>
		assert.strictEqual(p({ verdict: 'blocked' }).getTreeItem(siteNode).description, '⚠'));
	test('ok 网站无 ⚠', () =>
		assert.ok(!p({ verdict: 'ok' }).getTreeItem(siteNode).description));
	test('unknown 网站无 ⚠，tooltip 也没有原因', () => {
		const item = p({ verdict: 'unknown' }).getTreeItem(siteNode);
		assert.notStrictEqual(item.description, '⚠');
		assert.strictEqual(item.tooltip, 'https://a.com/');
	});
	test('favicon 探测未完成 → globe 图标', () =>
		assert.deepStrictEqual(p({}).getTreeItem(siteNode).iconPath, new vscode.ThemeIcon('globe')));
	test('favicon 探测失败 → globe 图标', () =>
		assert.deepStrictEqual(p({ icon: false }).getTreeItem(siteNode).iconPath, new vscode.ThemeIcon('globe')));
	test('favicon 探测成功 → 远程图标', () =>
		assert.strictEqual((p({ icon: true }).getTreeItem(siteNode).iconPath as vscode.Uri).toString(), 'https://a.com/favicon.ico'));
	test('contextValue 区分来源', () =>
		assert.strictEqual(p({}).getTreeItem({ ...siteNode, source: 'recommended' }).contextValue, 'site.recommended'));
});
