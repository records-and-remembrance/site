import { describe, expect, test } from 'bun:test';
import { renderSql } from './generate_band_release_seed_sql';

describe('band release seed SQL', () => {
	test('adds Poet-type.M digital singles as primary original works', () => {
		const sql = renderSql();
		const digitalSingles = [
			['2013-09-25', '光の粒子 埃の中で (Departures)'],
			['2018-03-23', 'イプシロンは泣いてたよ (A Boy In The Avenge)'],
			['2018-11-07', '瓦礫のオルフェオ (Ombra mai fù)'],
			['2018-12-05', 'MoYuRu'],
			['2019-03-06', '光の言語 (Absolute Blue)'],
		];

		for (const [releaseDate, title] of digitalSingles) {
			const workStart = sql.indexOf(`'${title}'`);
			const nextWork = sql.indexOf('INSERT INTO work ', workStart);
			const workSql = sql.slice(workStart, nextWork === -1 ? undefined : nextWork);

			expect(workStart).toBeGreaterThan(-1);
			expect(workSql).toContain(`'${releaseDate}'`);
			expect(workSql).toContain(`'original'`);
			expect(workSql).toContain(`'primary'`);
			expect(workSql).toContain(`'Digital'`);
			expect(workSql).toContain('INSERT INTO composition');
			expect(workSql).toContain('INSERT INTO recording');
			expect(workSql).toContain('INSERT INTO track');
			expect(workSql).toMatch(/INSERT INTO track[\s\S]*?, 1, NULL,/);
		}
		expect(sql).toContain(`'Lantis'`);
		expect(sql).toContain(`'LZC-1339'`);
		expect(sql.match(/^INSERT INTO track/gm)).toHaveLength(5);
		expect(sql.match(/^WHERE NOT EXISTS \($/gm)).toHaveLength(5);

		for (const conflictClause of sql.matchAll(/INSERT INTO track[\s\S]*?ON CONFLICT \(id\) DO UPDATE([\s\S]*?);/g)) {
			expect(conflictClause[1]).not.toContain('recording_id');
		}
	});
});
