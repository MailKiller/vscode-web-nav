import * as assert from 'assert';
import { SiteTreeProvider, TreeNode } from '../siteTree';
import { EmbedChecker } from '../embedChecker';
import { EmbedVerdict } from '../embedCheck';
import { Site } from '../sites';

const siteNode: TreeNode = { kind: 'site', site: { name: 'A', url: 'https://a.com/' }, source: 'mine' };

// 假的检测器：只提供树视图用到的 cached 和 onDidChange，避免真实联网
function p(o: { sites?: Site[]; show?: boolean; verdict?: EmbedVerdict }) {
	const checker = {
		cached: () => o.verdict,
		onDidChange: () => ({ dispose() {} }),
	} as unknown as EmbedChecker;
	return new SiteTreeProvider(checker, {
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
	test('contextValue 区分来源', () =>
		assert.strictEqual(p({}).getTreeItem({ ...siteNode, source: 'recommended' }).contextValue, 'site.recommended'));
});
