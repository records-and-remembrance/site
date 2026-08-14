import { describe, expect, test } from 'bun:test';
import { isoDateOf, MONTH_DAY_KIND_LABELS, monthDayKey, selectAnniversaryEntries } from './month-day';

describe('PST-020 この日なんの日', () => {
	const entries = [
		{ type: 'event' as const, date: '2005-07-01', label: '古い公演', href: '/lives/old' },
		{ type: 'release' as const, date: '2013-07-01', label: '新しい発売', href: '/discography/new' },
		{ type: 'event' as const, date: '2030-07-01', label: '未来の公演', href: '/lives/future' },
	];

	test('MM-DDキーを0埋めで作る', () => {
		expect(monthDayKey(new Date(2026, 0, 3))).toBe('01-03');
		expect(monthDayKey(new Date(2026, 11, 31))).toBe('12-31');
		expect(isoDateOf(new Date(2026, 7, 15))).toBe('2026-08-15');
	});

	test('閲覧日より前の記録だけを新しい順に返す', () => {
		expect(selectAnniversaryEntries(entries, '2026-07-01').map((entry) => entry.label)).toEqual(['新しい発売', '古い公演']);
	});

	test('該当がない日やキー未定義でも空配列を返す', () => {
		expect(selectAnniversaryEntries(entries, '2000-07-01')).toEqual([]);
		expect(selectAnniversaryEntries(undefined, '2026-07-01')).toEqual([]);
	});

	test('種別はサイト表記で示す', () => {
		expect(MONTH_DAY_KIND_LABELS).toEqual({ event: 'ライブ', release: '発売' });
	});
});
