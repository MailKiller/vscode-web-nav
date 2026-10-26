import * as vscode from 'vscode';
import { EmbedChecker } from './embedChecker';
import { SiteTreeProvider, TreeNode } from './siteTree';
import { SitePanel } from './sitePanel';
import { getUserSites } from './sites';

export function activate(context: vscode.ExtensionContext) {
	const checker = new EmbedChecker();
	const provider = new SiteTreeProvider(checker);

	context.subscriptions.push(
		checker,
		provider,
		vscode.window.createTreeView('webNav.sites', { treeDataProvider: provider }),
		vscode.commands.registerCommand('webNav.open', async (node: TreeNode) => {
			// 只有网站节点可以打开；分组、空提示等节点忽略
			if (node?.kind !== 'site') {
				return;
			}
			const verdict = checker.cached(node.site.url) ?? await checker.check(node.site.url);
			SitePanel.show(context, node.site, node.source, verdict);
		}),
	);

	// 后台预先检测“我的网站”（不 await），这样重启后 ⚠ 标记也能出现
	for (const site of getUserSites()) {
		void checker.check(site.url);
	}
}

export function deactivate() {}
