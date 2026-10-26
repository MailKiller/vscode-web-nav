import * as vscode from 'vscode';
import { FaviconFetchLike, probeFavicon } from './favicon';

/** 带缓存的 favicon 探测器：按图标地址缓存，同一地址并发只请求一次，结果出来后通知监听者 */
export class FaviconChecker {
	private readonly results = new Map<string, boolean>();
	private readonly pending = new Map<string, Promise<boolean>>();
	private readonly emitter = new vscode.EventEmitter<string>();
	readonly onDidChange: vscode.Event<string> = this.emitter.event;

	constructor(private readonly fetchFn?: FaviconFetchLike) { }

	cached(iconUrl: string): boolean | undefined {
		return this.results.get(iconUrl);
	}

	check(iconUrl: string): Promise<boolean> {
		const hit = this.results.get(iconUrl);
		if (hit !== undefined) {
			return Promise.resolve(hit);
		}
		// 已有进行中的请求就共用同一个 Promise
		let p = this.pending.get(iconUrl);
		if (!p) {
			p = probeFavicon(iconUrl, this.fetchFn).then(ok => {
				this.results.set(iconUrl, ok);
				this.pending.delete(iconUrl);
				this.emitter.fire(iconUrl);
				return ok;
			});
			this.pending.set(iconUrl, p);
		}
		return p;
	}

	clear(): void {
		this.results.clear();
	}

	dispose(): void {
		this.emitter.dispose();
	}
}
