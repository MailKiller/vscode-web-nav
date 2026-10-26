import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Site } from './sites';
import { EmbedVerdict } from './embedCheck';
import { buildExplanationHtml, buildIframeHtml } from './html';

export type PanelSource = 'mine' | 'recommended';

/** 单例面板：编辑器里始终只有一个标签页，标题固定为 README.md。 */
export class SitePanel {
	private static current: SitePanel | undefined;

	private constructor(private readonly panel: vscode.WebviewPanel, private site: Site) {}

	static show(context: vscode.ExtensionContext, site: Site, source: PanelSource, verdict: EmbedVerdict): void {
		let instance = SitePanel.current;
		if (instance) {
			instance.panel.reveal(vscode.ViewColumn.Active);
		} else {
			const panel = vscode.window.createWebviewPanel(
				'webNav.site',
				'README.md',
				vscode.ViewColumn.Active,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					// 只允许读取 media 目录
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
				},
			);
			instance = new SitePanel(panel, site);
			SitePanel.current = instance;
			const created = instance;
			// 只在创建时注册一次，否则重复 show 会叠加监听
			panel.onDidDispose(() => {
				if (SitePanel.current === created) {
					SitePanel.current = undefined;
				}
			}, null, context.subscriptions);
			panel.webview.onDidReceiveMessage((msg: { type?: string }) => created.handleMessage(msg), null, context.subscriptions);
		}
		instance.site = site;
		instance.render(context, source, verdict);
	}

	// 每次都重新设置 html，这样换网站时内容会刷新
	private render(context: vscode.ExtensionContext, source: PanelSource, verdict: EmbedVerdict): void {
		const webview = this.panel.webview;
		if (verdict === 'blocked' || verdict === 'insecure') {
			const media = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', name)).toString();
			webview.html = buildExplanationHtml({
				url: this.site.url,
				reason: verdict,
				removable: source === 'mine',
				cspSource: webview.cspSource,
				nonce: crypto.randomBytes(16).toString('base64'),
				styleUri: media('panel.css'),
				scriptUri: media('panel.js'),
			});
		} else {
			webview.html = buildIframeHtml({ url: this.site.url, cspSource: webview.cspSource });
		}
	}

	private async handleMessage(msg: { type?: string }): Promise<void> {
		switch (msg.type) {
			case 'openExternal':
				await vscode.env.openExternal(vscode.Uri.parse(this.site.url));
				break;
			case 'copy':
				await vscode.env.clipboard.writeText(this.site.url);
				void vscode.window.showInformationMessage('链接已复制');
				break;
			case 'remove': {
				// 命令由 Task 7 注册；用户确认并删除成功才关闭面板
				const removed = await vscode.commands.executeCommand<boolean>('webNav.remove', this.site);
				if (removed) {
					this.panel.dispose();
				}
				break;
			}
		}
	}
}
