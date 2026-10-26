import * as vscode from 'vscode';
import { Site, getUserSites, isRecommendedVisible, CONFIG_SECTION } from './sites';
import { RECOMMENDED, RecommendedCategory } from './recommended';
import { EmbedChecker } from './embedChecker';
import { PanelSource } from './sitePanel';
import { REASON_TEXT } from './html';

export type TreeNode =
	| { kind: 'group'; id: 'mine' | 'recommended' }
	| { kind: 'category'; category: RecommendedCategory }
	| { kind: 'site'; site: Site; source: PanelSource }
	| { kind: 'empty' };

interface Deps {
	userSites?: () => Site[];
	showRecommended?: () => boolean;
}

export class SiteTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
	private readonly emitter = new vscode.EventEmitter<TreeNode | undefined>();
	readonly onDidChangeTreeData = this.emitter.event;
	private readonly subscriptions: vscode.Disposable[] = [];
	private readonly userSites: () => Site[];
	private readonly showRecommended: () => boolean;

	// deps 默认用真实的设置读取函数；测试时注入假数据，不依赖真实设置
	constructor(private readonly checker: EmbedChecker, deps: Deps = {}) {
		this.userSites = deps.userSites ?? getUserSites;
		this.showRecommended = deps.showRecommended ?? isRecommendedVisible;
		// 检测结果更新（⚠ 标记）或设置变化时，重新绘制树
		this.subscriptions.push(
			this.checker.onDidChange(() => this.refresh()),
			vscode.workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(CONFIG_SECTION)) {
					this.refresh();
				}
			}),
		);
	}

	refresh(): void {
		this.emitter.fire(undefined);
	}

	dispose(): void {
		this.subscriptions.forEach(s => s.dispose());
		this.emitter.dispose();
	}

	getChildren(node?: TreeNode): TreeNode[] {
		if (!node) {
			const roots: TreeNode[] = [{ kind: 'group', id: 'mine' }];
			if (this.showRecommended()) {
				roots.push({ kind: 'group', id: 'recommended' });
			}
			return roots;
		}
		if (node.kind === 'group') {
			if (node.id === 'recommended') {
				return RECOMMENDED.map(category => ({ kind: 'category', category }));
			}
			const sites = this.userSites();
			return sites.length
				? sites.map(site => ({ kind: 'site', site, source: 'mine' }))
				: [{ kind: 'empty' }];
		}
		if (node.kind === 'category') {
			return node.category.sites.map(site => ({ kind: 'site', site, source: 'recommended' }));
		}
		return [];
	}

	getTreeItem(node: TreeNode): vscode.TreeItem {
		const S = vscode.TreeItemCollapsibleState;
		switch (node.kind) {
			case 'group':
				return new vscode.TreeItem(node.id === 'mine' ? '我的网站' : '推荐', S.Expanded);
			case 'category':
				return new vscode.TreeItem(node.category.name, S.Collapsed);
			case 'empty': {
				const item = new vscode.TreeItem('点击 ＋ 添加网站', S.None);
				item.command = { command: 'webNav.addSite', title: '添加网站' };
				return item;
			}
			case 'site': {
				const { site, source } = node;
				const item = new vscode.TreeItem(site.name, S.None);
				item.contextValue = `site.${source}`;
				item.command = { command: 'webNav.open', title: '打开', arguments: [node] };
				let tooltip = site.url;
				const verdict = this.checker.cached(site.url);
				if (verdict === 'blocked' || verdict === 'insecure') {
					item.description = '⚠';
					tooltip += '\n' + REASON_TEXT[verdict];
				}
				item.tooltip = tooltip;
				try {
					item.iconPath = vscode.Uri.parse(new URL(site.url).origin + '/favicon.ico');
				} catch {
					// 网址无法解析时不设图标
				}
				return item;
			}
		}
	}
}
