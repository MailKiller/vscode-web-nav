// 把链接点击转成消息发给插件，真正的操作在插件侧完成。
const vscode = acquireVsCodeApi();
for (const link of document.querySelectorAll('a[data-action]')) {
	link.addEventListener('click', (event) => {
		event.preventDefault();
		vscode.postMessage({ type: link.dataset.action });
	});
}
