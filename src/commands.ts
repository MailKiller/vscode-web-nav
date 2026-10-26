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
		const sites = getUserSites();
		if (findSite(sites, typed) >= 0) {
			vscode.window.showInformationMessage(ALREADY_EXISTS);
			return;
		}
		const url = await upgradeWithProgress(typed);
		// 升级后的 https 网址可能已存在，再查一次
		if (findSite(sites, url) >= 0) {
			vscode.window.showInformationMessage(ALREADY_EXISTS);
			return;
		}
		const name = await askName(hostnameOf(url));
		if (!name) {
			return;
		}
		await saveUserSites([...sites, { name, url }]);
		checkInBackground(url);
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
		const sites = getUserSites();
		const index = site ? findSite(sites, site.url) : -1;
		if (index < 0) {
			return;
		}
		const name = await askName(sites[index].name);
		if (!name) {
			return;
		}
		sites[index] = { ...sites[index], name };
		await saveUserSites(sites);
	});

	register('editUrl', async (node: TreeNode) => {
		const site = toSite(node);
		const sites = getUserSites();
		const index = site ? findSite(sites, site.url) : -1;
		if (index < 0) {
			return;
		}
		const typed = await askUrl(sites[index].url);
		if (!typed) {
			return;
		}
		// 与自身相同不算重复，所以只在“别的条目”命中时才拦截
		const dup = findSite(sites, typed);
		if (dup >= 0 && dup !== index) {
			vscode.window.showInformationMessage(ALREADY_EXISTS);
			return;
		}
		const url = await upgradeWithProgress(typed);
		const dup2 = findSite(sites, url);
		if (dup2 >= 0 && dup2 !== index) {
			vscode.window.showInformationMessage(ALREADY_EXISTS);
			return;
		}
		sites[index] = { ...sites[index], url };
		await saveUserSites(sites);
		checkInBackground(url);
	});

	register('remove', async (arg: TreeNode | Site): Promise<boolean> => {
		const site = toSite(arg);
		const sites = getUserSites();
		const index = site ? findSite(sites, site.url) : -1;
		if (index < 0) {
			return false;
		}
		const answer = await vscode.window.showWarningMessage(
			`确定从我的网站中移除“${sites[index].name}”吗？`, { modal: true }, '移除');
		if (answer !== '移除') {
			return false;
		}
		sites.splice(index, 1);
		await saveUserSites(sites);
		return true;
	});

	register('addRecommended', async (node: TreeNode) => {
		const site = toSite(node);
		if (!site) {
			return;
		}
		const sites = getUserSites();
		if (findSite(sites, site.url) >= 0) {
			vscode.window.showInformationMessage(ALREADY_EXISTS);
			return;
		}
		await saveUserSites([...sites, { name: site.name, url: site.url }]);
		checkInBackground(site.url);
	});
}
