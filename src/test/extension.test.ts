import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	test('插件激活且命令齐全', async () => {
		const ext = vscode.extensions.all.find(e => e.packageJSON.name === 'web-nav')!;
		await ext.activate();
		const all = await vscode.commands.getCommands(true);
		for (const id of ['open', 'addSite', 'refresh', 'openInBrowser', 'copyUrl', 'rename', 'editUrl', 'remove', 'addRecommended']) {
			assert.ok(all.includes(`webNav.${id}`), id);
		}
	});
});
