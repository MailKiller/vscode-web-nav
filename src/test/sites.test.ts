import * as assert from 'assert';
import { normalizeUrl, findSite, sanitizeSites } from '../sites';

suite('sites', () => {
	test('不带协议时补 https', () => assert.strictEqual(normalizeUrl(' www.runoob.com '), 'https://www.runoob.com/'));
	test('拒绝非 http(s) 协议', () => {
		for (const u of ['ftp://a.com', 'javascript:alert(1)', 'file:///c:/x', '', '   ']) {
			assert.strictEqual(normalizeUrl(u), undefined);
		}
	});
	test('保留 http', () => assert.strictEqual(normalizeUrl('http://a.com'), 'http://a.com/'));
	test('findSite 忽略结尾斜杠差异', () => assert.strictEqual(findSite([{ name: 'A', url: 'https://a.com/' }], 'https://a.com'), 0));
	test('sanitizeSites 跳过坏条目', () => assert.deepStrictEqual(
		sanitizeSites([{ name: 'A', url: 'a.com' }, { name: 'B' }, 42, null, { url: 'ftp://x' }, { name: '', url: 'https://b.com' }]),
		[{ name: 'A', url: 'https://a.com/' }, { name: 'b.com', url: 'https://b.com/' }]));
	test('sanitizeSites 非数组返回空', () => assert.deepStrictEqual(sanitizeSites('oops'), []));
});
