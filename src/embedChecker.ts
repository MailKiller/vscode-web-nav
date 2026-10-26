import * as vscode from 'vscode';
import { checkEmbeddable, EmbedVerdict, FetchLike } from './embedCheck';

/** 带缓存的嵌入检测器：同一网址并发只请求一次，结果出来后通知监听者 */
export class EmbedChecker {
	private readonly results = new Map<string, EmbedVerdict>();
	private readonly pending = new Map<string, Promise<EmbedVerdict>>();
	private readonly emitter = new vscode.EventEmitter<string>();
	readonly onDidChange: vscode.Event<string> = this.emitter.event;

	constructor(private readonly fetchFn?: FetchLike) { }

	cached(url: string): EmbedVerdict | undefined {
		return this.results.get(url);
	}

	check(url: string): Promise<EmbedVerdict> {
		const hit = this.results.get(url);
		if (hit !== undefined) {
			return Promise.resolve(hit);
		}
		// 已有进行中的请求就共用同一个 Promise
		let p = this.pending.get(url);
		if (!p) {
			p = checkEmbeddable(url, this.fetchFn).then(verdict => {
				this.results.set(url, verdict);
				this.pending.delete(url);
				this.emitter.fire(url);
				return verdict;
			});
			this.pending.set(url, p);
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
