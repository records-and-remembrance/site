import { describe, expect, test } from 'bun:test';
import { buildTimeline } from './timeline';

describe('PST-021 timeline', () => {
	test('release・event・membership・projectを日付順に並べ、月anchorと2006-2007集約ポリシーを持つ', () => {
		const entries = buildTimeline({
			project: [{ id: 'p', name: 'Project', slug: 'project', startDate: '1999-01-01', scope: 'monden' }],
			release: [{ id: 'r', workId: 'w', releaseDate: '2000-02-03', format: 'CD' }],
			work: [{ id: 'w', projectId: 'p', title: 'Work', slug: 'work' }],
			event: [{ id: 'e', projectId: 'p', eventDate: '2006-07-08', eventName: 'Live', slug: 'live' }],
			membership: [{ id: 'm', projectId: 'p', personId: 'person', fromDate: '2001-01-01' }],
			person: [{ id: 'person', name: 'Person', slug: 'person' }],
		});
		expect(entries.map((entry) => entry.date)).toEqual(['1999-01-01', '2000-02-03', '2001-01-01', '2006-07-08']);
		expect(entries.find((entry) => entry.kind === 'event')?.aggregated).toBe(true);
		expect(entries.find((entry) => entry.kind === 'release')?.href).toBe('/discography/work');
	});

	test('external projectと空日付をtimelineへ含めない', () => {
		expect(buildTimeline({ project: [{ id: 'external', name: 'External', scope: 'external' }], release: [], work: [], event: [], membership: [], person: [] })).toEqual([]);
	});
});
