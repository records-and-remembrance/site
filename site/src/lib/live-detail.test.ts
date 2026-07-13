import { describe, expect, test } from 'bun:test';
import { buildLiveDetail } from './live-detail';

describe('PST-016 live detail', () => {
	test('setlistをorderIndex・encore順で表示し、variationNote・人物・前後公演を解決する', () => {
		const detail = buildLiveDetail(
			{
				event: [
					{ id: 'e2', slug: '2020-01-02-v', eventDate: '2020-01-02', eventName: 'Next', projectId: 'p', venueId: 'v' },
					{ id: 'e1', slug: '2020-01-01-v', eventDate: '2020-01-01', eventName: 'Current', projectId: 'p', venueId: 'v' },
					{ id: 'e0', slug: '2019-01-01-v', eventDate: '2019-01-01', eventName: 'Previous', projectId: 'p', venueId: 'v' },
				],
				eventPerformance: [
					{ eventId: 'e1', orderIndex: 2, compositionId: 'c2', encore: true, variationNote: '別名義版' },
					{ eventId: 'e1', orderIndex: 1, compositionId: 'c1', encore: false },
				],
				composition: [
					{ id: 'c1', title: 'Song 1', slug: 'song-1' },
					{ id: 'c2', title: 'Song 2', slug: 'song-2' },
				],
				project: [{ id: 'p', name: 'Project', slug: 'project' }],
				venue: [{ id: 'v', name: 'Venue', slug: 'venue' }],
				person: [{ id: 'person', name: 'Person', slug: 'person' }],
				contribution: [{ eventId: 'e1', personId: 'person', role: 'support' }],
			},
			'2020-01-01-v',
		);
		expect(detail?.performances.map((item) => [item.orderIndex, item.title, item.encore])).toEqual([
			[1, 'Song 1', false],
			[2, '別名義版', true],
		]);
		expect(detail?.performances[1]?.href).toBe('/songs/song-2');
		expect(detail?.previous?.href).toBe('/lives/2019-01-01-v');
		expect(detail?.next?.href).toBe('/lives/2020-01-02-v');
		expect(detail?.participants[0]?.href).toBe('/people/person');
	});

	test('setlist 0件・slug欠落でも安全なmodelを返す', () => {
		const detail = buildLiveDetail(
			{
				event: [{ id: 'e', slug: 'e', eventDate: '2020-01-01', projectId: 'p', venueId: 'v' }],
				eventPerformance: [],
				composition: [],
				project: [{ id: 'p', name: 'P' }],
				venue: [{ id: 'v', name: 'V' }],
				person: [],
				contribution: [],
			},
			'e',
		);
		expect(detail?.performances).toEqual([]);
		expect(detail?.project.href).toBeUndefined();
		expect(detail?.venue.href).toBeUndefined();
	});
});
