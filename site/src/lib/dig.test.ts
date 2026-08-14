import { describe, expect, test } from 'bun:test';
import { buildDigCandidates, pickDigCards } from './dig';

describe('PST-020 Dig', () => {
	const snapshot = {
		snapshotGeneratedAt: '2026-07-13T00:00:00.000Z',
		tables: {
			composition: [{ id: 'composition-analyze', slug: 'analyze', title: 'ANALYZE' }],
			venue: [
				{ id: 'venue-1', slug: 'venue', name: '新宿LOFT' },
				{ id: 'venue-2', slug: 'venue-2', name: '下北沢GARAGE' },
			],
			event: [
				{ id: 'future', slug: 'future', eventDate: '2026-12-01', venueId: 'venue-1' },
				{ id: 'past', slug: 'past', eventDate: '2005-04-02', venueId: 'venue-1' },
			],
			eventPerformance: [
				{ id: 'performance-1', eventId: 'past', compositionId: 'composition-analyze' },
				{ id: 'performance-2', eventId: 'past', compositionId: 'composition-analyze' },
			],
		},
		indexes: {
			dig: [
				{ type: 'composition', slug: 'analyze', summary: 'ANALYZE' },
				{ type: 'event', slug: 'future', summary: '未来の公演' },
				{ type: 'event', slug: 'past', summary: '過去の公演' },
				{ type: 'venue', slug: 'venue', summary: '新宿LOFT' },
				{ type: 'venue', slug: 'venue-2', summary: '下北沢GARAGE' },
			],
			monthDay: {},
		},
	} as never;

	test('composition・venueの候補を作り、未来eventは除外する', () => {
		const candidates = buildDigCandidates(snapshot);
		expect(candidates.composition).toHaveLength(1);
		expect(candidates.event.map((card) => card.href)).toEqual(['/lives/past']);
		expect(candidates.venue).toHaveLength(2);
	});

	test('カードのラベルは表示名にし、slugを本文へ出さない', () => {
		const candidates = buildDigCandidates(snapshot);
		expect(candidates.composition[0]).toMatchObject({ label: 'ANALYZE', href: '/songs/analyze' });
		expect(candidates.venue.map((card) => card.label)).toEqual(['下北沢GARAGE', '新宿LOFT']);
	});

	test('種別に応じた件数・日付を一言として添える', () => {
		const candidates = buildDigCandidates(snapshot);
		expect(candidates.composition[0]?.summary).toBe('ライブ演奏 2回');
		expect(candidates.event[0]?.summary).toBe('2005年4月2日 · 2曲');
		expect(candidates.venue.find((card) => card.label === '新宿LOFT')?.summary).toBe('公演記録 2件');
		expect(candidates.venue.find((card) => card.label === '下北沢GARAGE')?.summary).toBe('記録上の公演なし');
	});

	test('random sourceで同じ候補を再現できる', () => {
		const candidates = buildDigCandidates(snapshot);
		expect(pickDigCards(candidates, () => 0).map((card) => card.href)).toEqual(['/songs/analyze', '/lives/past', '/venues/venue-2']);
	});
});
