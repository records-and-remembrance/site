import { describe, expect, test } from 'bun:test';
import { parseSetlist, sourceEntries, type SourceArticle } from './generate_live_performance_seed_sql';

function sourceWithSetlist(lines: string[]): SourceArticle {
	return {
		path: '/tmp/live.md',
		name: 'live.md',
		title: 'Test live',
		date: '2026-01-01',
		tags: ['Live'],
		body: ['## セットリスト', '', ...lines].join('\n'),
	};
}

describe('live performance encore assignments', () => {
	test('marks every performance after an encore break', () => {
		const items = parseSetlist(sourceWithSetlist(['1. 本編最後の曲  ', '   【Encore break】', '1. アンコール1曲目', '1. アンコール2曲目']));

		expect(items.map(({ cleanedTitle, encore }) => ({ cleanedTitle, encore }))).toEqual([
			{ cleanedTitle: '本編最後の曲', encore: false },
			{ cleanedTitle: 'アンコール1曲目', encore: true },
			{ cleanedTitle: 'アンコール2曲目', encore: true },
		]);
	});

	test('handles an encore break appended to the preceding track with br', () => {
		const items = parseSetlist(sourceWithSetlist(['1. プリズム<br>encore break', '1. 次の曲']));

		expect(items.map(({ cleanedTitle, encore }) => ({ cleanedTitle, encore }))).toEqual([
			{ cleanedTitle: 'プリズム', encore: false },
			{ cleanedTitle: '次の曲', encore: true },
		]);
	});

	test('marks a track annotated as encore without affecting later tracks', () => {
		const items = parseSetlist(sourceWithSetlist(['- 黄金の鐘 (encore)', '- 他']));

		expect(items.map(({ cleanedTitle, encore }) => ({ cleanedTitle, encore }))).toEqual([
			{ cleanedTitle: '黄金の鐘', encore: true },
			{ cleanedTitle: '他', encore: false },
		]);
	});
});

test('reads composition draft sources whose first field follows the list marker', () => {
	const entries = sourceEntries(['  - type: live', "    file: 'first.md'", "    raw_title: '一曲目'", '  -', '    type: live', "    file: 'second.md'", "    raw_title: '二曲目'"].join('\n'));

	expect(entries).toHaveLength(2);
	expect(entries[0]).toContain('- type: live');
	expect(entries[1]).toContain('file:');
});
