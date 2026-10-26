import * as assert from 'assert';
import { faviconUrlOf, FaviconFetchLike, probeFavicon } from '../favicon';

// 假的 fetch：不走真实网络，只返回指定的状态和 content-type
function fake(ok: boolean, type?: string): FaviconFetchLike {
	return async () => ({ ok, headers: new Headers(type ? { 'content-type': type } : {}), body: null });
}

suite('favicon', () => {
	test('取站点根的 favicon.ico', () => assert.strictEqual(faviconUrlOf('https://a.com/x/y?q=1'), 'https://a.com/favicon.ico'));
	test('网址无法解析 → undefined', () => assert.strictEqual(faviconUrlOf('not a url'), undefined));
	test('200 + image/* → 可用', async () => {
		assert.strictEqual(await probeFavicon('https://a.com/favicon.ico', fake(true, 'image/x-icon')), true);
		assert.strictEqual(await probeFavicon('https://a.com/favicon.ico', fake(true, 'IMAGE/PNG; charset=x')), true);
	});
	test('404 → 不可用', async () => assert.strictEqual(await probeFavicon('https://a.com/favicon.ico', fake(false, 'image/png')), false));
	test('200 但 text/html → 不可用', async () => assert.strictEqual(await probeFavicon('https://a.com/favicon.ico', fake(true, 'text/html')), false));
	test('没有 content-type → 不可用', async () => assert.strictEqual(await probeFavicon('https://a.com/favicon.ico', fake(true)), false));
	test('网络错误 → 不可用', async () => assert.strictEqual(await probeFavicon('https://a.com/favicon.ico', async () => { throw new Error('ENOTFOUND'); }), false));
	test('超时 → 不可用', async () => assert.strictEqual(
		await probeFavicon('https://a.com/favicon.ico', (_u, init) => new Promise((_r, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('abort')))), 20),
		false));
});
