import * as vscode from 'vscode';
import { EmbedChecker } from './embedChecker';
import { FaviconChecker } from './faviconChecker';
import { SiteTreeProvider, TreeNode } from './siteTree';
import { SitePanel } from './sitePanel';
import { getUserSites } from './sites';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
	const checker = new EmbedChecker();
	const favicons = new FaviconChecker();
	const provider = new SiteTreeProvider(checker, favicons);
	// 点击序号：等待检测期间又点了别的网站时，以最后一次点击为准
	let openSeq = 0;

	context.subscriptions.push(
		checker,
		favicons,
		provider,
		vscode.window.createTreeView('webNav.sites', { treeDataProvider: provider }),
		vscode.commands.registerCommand('webNav.open', async (node: TreeNode) => {
			// 只有网站节点可以打开；分组、空提示等节点忽略
			if (node?.kind !== 'site') {
				return;
			}
			const seq = ++openSeq;
			const url = node.site.url;
			// 没有缓存就要真正等待检测（最多 8 秒），在树视图上显示进度
			const verdict = checker.cached(url)
				?? await vscode.window.withProgress({ location: { viewId: 'webNav.sites' } }, () => checker.check(url));
			if (seq !== openSeq) {
				return;
			}
			SitePanel.show(context, node.site, node.source, verdict);
		}),
	);

	registerCommands(context, checker, favicons, provider);

	// 后台预先检测“我的网站”（不 await），这样重启后 ⚠ 标记也能出现
	for (const site of getUserSites()) {
		void checker.check(site.url);
	}
}

export function deactivate() {}
