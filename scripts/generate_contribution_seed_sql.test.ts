import { describe, expect, test } from 'bun:test';
import { parseMatrixOtherCell, renderSql } from './generate_contribution_seed_sql';

describe('parseMatrixOtherCell', () => {
	test('複数の「担当楽器 人名」を人物と楽器に分離する', () => {
		expect(parseMatrixOtherCell('Recorder 門田, Piano 韮沢, Melodeon & Bass Drum 内田, Metronome 伊藤, Rhodes Piano 白砂瞳', [])).toEqual([
			{ personName: '門田匡陽', instrument: 'recorder' },
			{ personName: '韮沢雄希', instrument: 'piano' },
			{ personName: '内田武瑠', instrument: 'melodeon' },
			{ personName: '内田武瑠', instrument: 'bass_drum' },
			{ personName: '伊藤大地', instrument: 'metronome' },
			{ personName: '白砂瞳', instrument: 'rhodes_piano' },
		]);
	});

	test('注記だけで奏者がない楽器は人物として扱わない', () => {
		expect(parseMatrixOtherCell('Piano 楢原, Strings ※', [])).toEqual([{ personName: '楢原英介', instrument: 'piano' }]);
	});

	test('独自表記の打楽器を percussion に正規化する', () => {
		expect(parseMatrixOtherCell('Junk Perc. 内田, kachikachi Perc. 伊藤', [])).toEqual([
			{ personName: '内田武瑠', instrument: 'percussion' },
			{ personName: '伊藤大地', instrument: 'percussion' },
		]);
	});

	test('空白なしで連結された複数楽器を同じ奏者に割り当てる', () => {
		expect(parseMatrixOtherCell('Tambourine&Timpani 伊藤', [])).toEqual([
			{ personName: '伊藤大地', instrument: 'tambourine' },
			{ personName: '伊藤大地', instrument: 'timpani' },
		]);
	});
});

describe('renderSql', () => {
	test('再生成前に旧 contribution と孤立した生成人物を削除する', () => {
		const sql = renderSql([]);

		expect(sql).toContain('DELETE FROM contribution');
		expect(sql).toContain('raw_credit=');
		expect(sql).toContain('DELETE FROM person');
		expect(sql).toContain('source=contribution_seed');
	});
});
