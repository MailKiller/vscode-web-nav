import * as assert from 'assert';
import { EmbedChecker } from '../embedChecker';
import { FetchLike } from '../embedCheck';

suite('EmbedChecker', () => {
	// 计数的假 fetch：用来确认同一网址只请求了几次
	function counting() {
		const state = { count: 0 };
		const fn: FetchLike = async () => {
			state.count++;
			return { url: '', headers: new Headers({ 'x-frame-options': 'deny' }), body: null };
		};
		return { state, fn };
	}

	test('并发与串行 check 只请求一次，并写入缓存', async () => {
		const { state, fn } = counting();
		const c = new EmbedChecker(fn);
		const url = 'https://a.com/';
		assert.strictEqual(c.cached(url), undefined);
		const [r1, r2] = await Promise.all([c.check(url), c.check(url)]);
		assert.strictEqual(r1, 'blocked');
		assert.strictEqual(r2, 'blocked');
		assert.strictEqual(await c.check(url), 'blocked');
		assert.strictEqual(state.count, 1);
		assert.strictEqual(c.cached(url), 'blocked');
		c.dispose();
	});

	test('clear 之后重新请求', async () => {
		const { state, fn } = counting();
		const c = new EmbedChecker(fn);
		await c.check('https://a.com/');
		c.clear();
		assert.strictEqual(c.cached('https://a.com/'), undefined);
		await c.check('https://a.com/');
		assert.strictEqual(state.count, 2);
		c.dispose();
	});

	test('onDidChange 带上对应 url', async () => {
		const { fn } = counting();
		const c = new EmbedChecker(fn);
		const got: string[] = [];
		c.onDidChange(u => got.push(u));
		await c.check('https://a.com/');
		assert.deepStrictEqual(got, ['https://a.com/']);
		c.dispose();
	});
});
