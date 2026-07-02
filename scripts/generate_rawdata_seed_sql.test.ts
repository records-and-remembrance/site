import { describe, expect, test } from 'bun:test';
import { compilationProjectNames, releaseEditionType, renderSql, workType, type SourceArticle } from './generate_rawdata_seed_sql';

const source = (overrides: Partial<SourceArticle>): SourceArticle => ({
	path: 'release.md',
	name: 'release.md',
	stem: 'release',
	title: 'Artist - Album',
	date: '2025-01-01',
	tags: ['Release', 'Artist'],
	body: '',
	...overrides,
});

describe('release classification', () => {
	test('classifies multi-artist VA works and extracts every participant', () => {
		const value = source({
			title: 'VA - Festival compilation',
			tags: ['Release', 'Artist A', 'Artist B', 'Artist C', 'Self-Release', 'Compilation'],
		});

		expect(workType(value)).toBe('compilation');
		expect(compilationProjectNames(value)).toEqual(['Artist A', 'Artist B', 'Artist C']);
	});

	test('classifies same-artist edited works as best albums', () => {
		expect(
			workType(
				source({
					title: 'Artist - Edited catalogue',
					tags: ['Release', 'Artist', 'Compilation', 'Reissue/Remaster'],
				}),
			),
		).toBe('best');
		expect(workType(source({ title: 'Artist - BEST', body: 'メンバー選曲によるベスト盤。' }))).toBe('best');
	});

	test('classifies live video collections as live works', () => {
		const titles = [
			'festival M.O.N. -勝利の美学- 2015.10.24 at LIQUIDROOM ebisu (Live DVD)',
			'Poet-type.M - A Place, Dark & Dark -prologue- LIVE at Kenmin kyosai Mirai Hall_Jan 31, 2015',
			'Good Dog Happy Men - Memory of the GOLDENBELLCITY (Live DVD)',
		];

		for (const title of titles) {
			expect(workType(source({ title, tags: ['Release', 'Artist', 'Live DVD'] }))).toBe('live');
		}
	});

	test('classifies reissues independently from the work type', () => {
		const value = source({ tags: ['Release', 'Artist', 'Reissue/Remaster'] });

		expect(workType(value)).toBe('original');
		expect(releaseEditionType(value)).toBe('reissue');
	});
});

describe('release source expansion', () => {
	test('splits The Night2 and The Lunch2 into separate works and releases', () => {
		const value = source({
			path: 'rawData/articles_by_category/release/2013-10-02-000000_1.md',
			name: '2013-10-02-000000_1.md',
			stem: '2013-10-02-000000_1',
			title: 'Poet-type.M - The Lunch2 / The Night2 (CD-R)',
			date: '2013-10-02',
			tags: ['Release', 'Poet-type.M', 'Self-Release', 'Demo'],
			body: [
				'## 基本情報',
				'',
				'- リリース: 2013年10月02日',
				'- 形態: CD-R',
				'- 流通方法: TOWER RECORDS/DISKUNION店頭 (購入者特典)',
				'',
				'## 収録曲',
				'',
				'### The Night2',
				'',
				'1. パキシル',
				'1. ワイン',
				'',
				'※DISKUNION 購入者特典',
				'',
				'### The Lunch2',
				'',
				'1. Blanket',
				'1. Grace',
				'',
				'※TOWER RECORDS 購入者特典',
			].join('\n'),
		});

		const sql = renderSql([value], ['release']);

		expect(sql).toContain("'The Night2'");
		expect(sql).toContain("'The Lunch2'");
		expect(sql).not.toContain("'The Lunch2 / The Night2'");
		expect(sql.match(/INSERT INTO release /g)).toHaveLength(2);
		expect(sql).toContain('distribution_method=DISKUNION店頭 (購入者特典)');
		expect(sql).toContain('distribution_method=TOWER RECORDS店頭 (購入者特典)');
	});
});
