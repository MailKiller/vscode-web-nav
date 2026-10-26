import * as assert from 'assert';
import { checkEmbeddable, FetchLike, tryUpgradeToHttps, verdictFromHeaders } from '../embedCheck';

// 假的 fetch：不走真实网络，只返回指定的响应头和最终网址
function fake(headers: Record<string, string>, finalUrl = ''): FetchLike {
	return async () => ({ url: finalUrl, headers: new Headers(headers), body: null });
}

const h = (o: Record<string, string>) => verdictFromHeaders(new Headers(o));

suite('embedCheck', () => {
	test('无相关头 → ok', () => assert.strictEqual(h({}), 'ok'));
	test('XFO deny/SAMEORIGIN → blocked', () => {
		assert.strictEqual(h({ 'x-frame-options': 'deny' }), 'blocked');
		assert.strictEqual(h({ 'x-frame-options': 'SAMEORIGIN' }), 'blocked');
	});
	test('XFO allow-from → ok', () => assert.strictEqual(h({ 'x-frame-options': 'ALLOW-FROM https://x.com' }), 'ok'));
	test('CSP 无 frame-ancestors → ok', () => assert.strictEqual(h({ 'content-security-policy': "default-src 'self'" }), 'ok'));
	test("frame-ancestors 'self'/'none'/具体域名 → blocked", () => {
		for (const v of ["frame-ancestors 'self'", "frame-ancestors 'none'", 'script-src x; frame-ancestors https://a.com']) {
			assert.strictEqual(h({ 'content-security-policy': v }), 'blocked');
		}
	});
	test('frame-ancestors * → ok', () => assert.strictEqual(h({ 'content-security-policy': 'frame-ancestors *' }), 'ok'));
	test('多条策略任一限制 → blocked', () => assert.strictEqual(h({ 'content-security-policy': "default-src *, frame-ancestors 'self'" }), 'blocked'));
	test('http 网址 → insecure 且不请求', async () => {
		let called = false;
		assert.strictEqual(await checkEmbeddable('http://a.com/', async () => { called = true; throw new Error('x'); }), 'insecure');
		assert.strictEqual(called, false);
	});
	test('重定向到 http → insecure', async () => assert.strictEqual(await checkEmbeddable('https://a.com/', fake({}, 'http://a.com/')), 'insecure'));
	test('请求异常 → unknown', async () => assert.strictEqual(await checkEmbeddable('https://a.com/', async () => { throw new Error('ENOTFOUND'); }), 'unknown'));
	test('超时 → unknown', async () => assert.strictEqual(
		await checkEmbeddable('https://a.com/', (_u, init) => new Promise((_r, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('abort')))), 20),
		'unknown'));
	test('升级 https 成功', async () => assert.strictEqual(await tryUpgradeToHttps('http://a.com/', fake({})), 'https://a.com/'));
	test('升级失败返回原网址', async () => assert.strictEqual(await tryUpgradeToHttps('http://a.com/', async () => { throw new Error('x'); }), 'http://a.com/'));
});
