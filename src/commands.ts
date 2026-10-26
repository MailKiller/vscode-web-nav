import * as vscode from 'vscode';
import { EmbedChecker } from './embedChecker';
import { SiteTreeProvider, TreeNode } from './siteTree';
import { tryUpgradeToHttps } from './embedCheck';
import { Site, findSite, getUserSites, hostnameOf, normalizeUrl, saveUserSites } from './sites';

const INVALID_URL = '请输入有效的网址，例如 https://www.runoob.com';
const ALREADY_EXISTS = '已经在我的网站里了';

/** 命令参数可能来自树节点（右键菜单）或普通 Site（说明页），统一取出 Site。 */
function toSite(arg: TreeNode | Site | undefined): Site | undefined {
	if (!arg) {
		return undefined;
	}
	if ('kind' in arg) {
		return arg.kind === 'site' ? arg.site : undefined;
	}
	return arg;
}

/** 输入网址并校验，返回规范化后的网址；取消返回 undefined。 */
async function askUrl(value?: string): Promise<string | undefined> {
	const input = await vscode.window.showInputBox({
		prompt: '请输入网址',
		placeHolder: 'https://www.runoob.com',
		value,
		validateInput: text => (normalizeUrl(text) ? undefined : INVALID_URL),
	});
	return input === undefined ? undefined : normalizeUrl(input);
}

/** 输入名称，不能为空；取消返回 undefined。 */
function askName(value: string): Thenable<string | undefined> {
	return vscode.window.showInputBox({
		prompt: '请输入网站名称',
		value,
		validateInput: text => (text.trim() ? undefined : '名称不能为空'),
	}).then(name => name?.trim());
}

/** http 网址尝试升级为 https（要发请求，所以显示进度）。 */
function upgradeWithProgress(url: string): Thenable<string> {
	if (!url.startsWith('http://')) {
		return Promise.resolve(url);
	}
	return vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: '正在检查是否支持 https…' },
		() => tryUpgradeToHttps(url),
	);
}

/** 保存前重新读取最新设置：等待输入/网络期间设置可能已被改动，不能用旧快照覆盖。 */
async function saveFresh(change: (sites: Site[]) => boolean): Promise<boolean> {
	const sites = getUserSites();
	if (!change(sites)) {
		return false;
	}
	await saveUserSites(sites);
	return true;
}

export function registerCommands(context: vscode.ExtensionContext, checker: EmbedChecker, tree: SiteTreeProvider): void {
	const register = (id: string, handler: (...args: any[]) => unknown) =>
		context.subscriptions.push(vscode.commands.registerCommand(`webNav.${id}`, handler));

	// 后台检测，不等待；check 本身不会 reject，void 只是明确“不等”
	const checkInBackground = (url: string) => void checker.check(url);

	register('addSite', async () => {
		const typed = await askUrl();
		if (!typed) {
			return;
		}
		// 先快速判重，让用户尽早得到反馈；最终判重在保存前
		if (findSite(getUserSites(), typed) >= 0) {
			vscode.window.showInformationMessage(ALREADY_EXISTS);
			return;
		}
		const url = await upgradeWithProgress(typed);
		const name = await askName(hostnameOf(url));
		if (!name) {
			return;
		}
		// 以保存前最新的列表为准再判重（升级后的网址、并发添加都可能重复）
		const added = await saveFresh(latest => {
			if (findSite(latest, url) >= 0) {
				vscode.window.showInformationMessage(ALREADY_EXISTS);
				return false;
			}
			latest.push({ name, url });
			return true;
		});
		if (added) {
			checkInBackground(url);
		}
	});

	register('refresh', () => {
		checker.clear();
		// 并发发起所有检测，不逐个等待；check 不会 reject
		for (const site of getUserSites()) {
			checkInBackground(site.url);
		}
		tree.refresh();
	});

	register('openInBrowser', (node: TreeNode) => {
		const site = toSite(node);
		if (site) {
			return vscode.env.openExternal(vscode.Uri.parse(site.url));
		}
	});

	register('copyUrl', async (node: TreeNode) => {
		const site = toSite(node);
		if (site) {
			await vscode.env.clipboard.writeText(site.url);
			vscode.window.showInformationMessage('链接已复制');
		}
	});

	register('rename', async (node: TreeNode) => {
		const site = toSite(node);
		const current = site ? getUserSites()[findSite(getUserSites(), site.url)] : undefined;
		if (!site || !current) {
			return;
		}
		const name = await askName(current.name);
		if (!name) {
			return;
		}
		// 按 url 在最新列表里重新定位；条目已消失就静默放弃
		await saveFresh(latest => {
			const i = findSite(latest, site.url);
			if (i < 0) {
				return false;
			}
			latest[i] = { ...latest[i], name };
			return true;
		});
	});

	register('editUrl', async (node: TreeNode) => {
		const site = toSite(node);
		const before = getUserSites();
		const index = site ? findSite(before, site.url) : -1;
		if (!site || index < 0) {
			return;
		}
		const typed = await askUrl(before[index].url);
		if (!typed) {
			return;
		}
		// 与自身相同不算重复，所以只在“别的条目”命中时才拦截
		const early = findSite(before, typed);
		if (early >= 0 && early !== index) {
			vscode.window.showInformationMessage(ALREADY_EXISTS);
			return;
		}
		const url = await upgradeWithProgress(typed);
		// 以保存前最新的列表为准：重新按旧 url 定位，再判重
		const changed = await saveFresh(latest => {
			const i = findSite(latest, site.url);
			if (i < 0) {
				return false;
			}
			const dup = findSite(latest, url);
			if (dup >= 0 && dup !== i) {
				vscode.window.showInformationMessage(ALREADY_EXISTS);
				return false;
			}
			latest[i] = { ...latest[i], url };
			return true;
		});
		if (changed) {
			checkInBackground(url);
		}
	});

	register('remove', async (arg: TreeNode | Site): Promise<boolean> => {
		const site = toSite(arg);
		const current = site ? getUserSites()[findSite(getUserSites(), site.url)] : undefined;
		if (!site || !current) {
			return false;
		}
		const answer = await vscode.window.showWarningMessage(
			`确定从我的网站中移除“${current.name}”吗？`, { modal: true }, '移除');
		if (answer !== '移除') {
			return false;
		}
		// 确认期间条目可能已被删除，按 url 在最新列表里重新定位
		return saveFresh(latest => {
			const i = findSite(latest, site.url);
			if (i < 0) {
				return false;
			}
			latest.splice(i, 1);
			return true;
		});
	});

	register('addRecommended', async (node: TreeNode) => {
		const site = toSite(node);
		if (!site) {
			return;
		}
		const added = await saveFresh(latest => {
			if (findSite(latest, site.url) >= 0) {
				vscode.window.showInformationMessage(ALREADY_EXISTS);
				return false;
			}
			latest.push({ name: site.name, url: site.url });
			return true;
		});
		if (added) {
			checkInBackground(site.url);
		}
	});
}
