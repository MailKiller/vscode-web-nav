// 逐个检测内置推荐网站能否被 iframe 嵌入；任何一个不是 ok 就以退出码 1 结束。
// 这个脚本会访问真实网络，所以不放进 npm test。
const { RECOMMENDED } = require('../out/recommended.js');
const { checkEmbeddable } = require('../out/embedCheck.js');

async function main() {
	const sites = RECOMMENDED.flatMap(c => c.sites);
	let failed = 0;
	for (const site of sites) {
		const verdict = await checkEmbeddable(site.url);
		if (verdict !== 'ok') {
			failed++;
		}
		console.log(`${verdict.padEnd(9)} ${site.name}  ${site.url}`);
	}
	console.log(`\n共 ${sites.length} 个网站，${failed} 个未通过`);
	process.exit(failed > 0 ? 1 : 0);
}

main();
