import { describe, expect, test } from 'bun:test';
import { buildDigCandidates, pickDigCards } from './dig';

describe('PST-020 Dig', () => {
	const snapshot = {
		snapshotGeneratedAt: '2026-07-13T00:00:00.000Z',
		tables: { event: [{ id: 'future', slug: 'future', eventDate: '2026-12-01' }] },
		indexes: {
			dig: [
				{ type: 'composition', slug: 'analyze', summary: '曲の旅' },
				{ type: 'event', slug: 'future', summary: '未来' },
				{ type: 'venue', slug: 'venue', summary: '会場史' },
				{ type: 'venue', slug: 'venue-2', summary: '会場史2' },
			],
			monthDay: {},
		},
	} as never;

	test('composition・venueの候補を作り、未来eventは除外する', () => {
		const candidates = buildDigCandidates(snapshot);
		expect(candidates.composition).toHaveLength(1);
		expect(candidates.event).toHaveLength(0);
		expect(candidates.venue).toHaveLength(2);
	});

	test('random sourceで同じ候補を再現できる', () => {
		const candidates = buildDigCandidates(snapshot);
		expect(pickDigCards(candidates, () => 0).map((card) => card.href)).toEqual(['/songs/analyze', '/venues/venue-2']);
	});
});
