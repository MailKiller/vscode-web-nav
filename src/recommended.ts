// 注意：这里只能 import type，否则编译产物会 require('vscode')，scripts/verify-recommended.js 会崩溃。
import type { Site } from './sites';

export interface RecommendedCategory {
	name: string;
	sites: Site[];
}

// 网址必须是 new URL(x).href 的规范形式（裸域名带结尾斜杠）。
export const RECOMMENDED: RecommendedCategory[] = [
	{
		name: '学习',
		sites: [
			{ name: '菜鸟教程', url: 'https://www.runoob.com/' },
			{ name: 'W3school', url: 'https://www.w3school.com.cn/' },
			{ name: 'ES6 入门教程', url: 'https://es6.ruanyifeng.com/' },
			{ name: 'React 文档', url: 'https://react.dev/' },
			{ name: 'TypeScript 中文', url: 'https://www.typescriptlang.org/zh/' },
			{ name: 'Node.js 中文', url: 'https://nodejs.org/zh-cn/' },
			{ name: 'Python 文档', url: 'https://docs.python.org/zh-cn/3/' },
			{ name: 'Rust 程序设计语言', url: 'https://kaisery.github.io/trpl-zh-cn/' },
			{ name: 'Git 中文文档', url: 'https://git-scm.com/book/zh/v2' },
			{ name: 'Vite 中文', url: 'https://cn.vitejs.dev/' },
		],
	},
	{
		name: '面试刷题',
		sites: [
			{ name: 'LeetCode 中国', url: 'https://leetcode.cn/' },
			{ name: '牛客网', url: 'https://www.nowcoder.com/' },
			{ name: '前端面试指南', url: 'https://interview.poetries.top/' },
			{ name: 'JavaGuide', url: 'https://javaguide.cn/' },
			{ name: '代码随想录', url: 'https://programmercarl.com/' },
			{ name: 'labuladong 算法笔记', url: 'https://labuladong.online/' },
		],
	},
	{
		name: '博客',
		sites: [
			{ name: '廖雪峰', url: 'https://www.liaoxuefeng.com/' },
			{ name: '阮一峰的网络日志', url: 'https://www.ruanyifeng.com/' },
			{ name: '掘金', url: 'https://juejin.cn/' },
		],
	},
	{
		name: '阅读',
		sites: [
			{ name: '微信读书', url: 'https://weread.qq.com/' },
		],
	},
];
