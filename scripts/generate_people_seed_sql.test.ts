import { describe, expect, test } from 'bun:test';
import { renderSql, type MembershipSeed } from './generate_people_seed_sql';

describe('renderSql', () => {
	test('プロジェクトの開始日と終了日を活動期間から出力する', () => {
		const biographyArticles = [
			{
				path: 'band_GDHM.md',
				name: 'band_GDHM.md',
				title: 'Good Dog Happy Men',
				date: '2004-07-01',
				tags: ['参加バンド', 'Good Dog Happy Men', 'Biography'],
				body: '## 基本情報\n\n- 活動期間: 2004- (2010年 活動停止)',
			},
			{
				path: 'band_burger.md',
				name: 'band_burger.md',
				title: 'BURGER NUDS',
				date: '1999-01-01',
				tags: ['参加バンド', 'BURGER NUDS', 'Biography'],
				body: '## 基本情報\n\n- 活動期間: 1999-2004, 2014-現在',
			},
			{
				path: 'band_sweetgirls.md',
				name: 'band_sweetgirls.md',
				title: 'sweet girls',
				date: '1995-04-01',
				tags: ['参加バンド'],
				body: '## 基本情報\n\n- 活動期間: 中学3年生～高校卒業まで？ (1994年~1998年3月)',
			},
		];

		const sql = renderSql(new Map(), [], biographyArticles);

		expect(sql).toContain("'Good Dog Happy Men', 'band', NULL, '2004-01-01', '2010-12-31'");
		expect(sql).toContain("'BURGER NUDS', 'band', NULL, '1999-01-01', NULL");
		expect(sql).toContain("'sweet girls', 'band', NULL, '1994-01-01', '1998-03-31'");
		expect(sql).toContain('start_date = EXCLUDED.start_date');
		expect(sql).toContain('end_date = EXCLUDED.end_date');
	});

	test('membershipのsupport区分を専用列へ出力する', () => {
		const membership: MembershipSeed = {
			personName: 'サポート奏者',
			projectName: 'テストバンド',
			fromDate: '2025-01-01',
			toDate: null,
			fromPrecision: 'day',
			toPrecision: null,
			support: true,
			note: 'source_file=test.md',
			instruments: [],
		};

		const sql = renderSql(new Map(), [membership], []);

		expect(sql).toContain('INSERT INTO membership (id, person_id, project_id, from_date, to_date, from_date_precision, to_date_precision, support, note)');
		expect(sql).toContain(", TRUE, 'source_file=test.md')");
		expect(sql).toContain('support = EXCLUDED.support');
		expect(sql).not.toContain('support; source_file=test.md');
	});
});
