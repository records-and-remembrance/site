import { describe, expect, test } from 'bun:test';
import { buildTimeline, mergeFilterValues, TIMELINE_KIND_LABELS } from './timeline';

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
		expect(entries.find((entry) => entry.kind === 'event')?.projectColor).toBe('var(--project-other)');
	});

	test('集約行のフィルタ値はまとめた個別エントリの和集合になる', () => {
		const entries = buildTimeline({
			project: [
				{ id: 'p1', name: 'A', slug: 'project-a', scope: 'monden' },
				{ id: 'p2', name: 'B', slug: 'project-b', scope: 'monden' },
			],
			release: [],
			work: [],
			event: [
				{ id: 'e1', projectId: 'p1', eventDate: '2006-07-08', eventName: 'Live A', slug: 'live-a' },
				{ id: 'e2', projectId: 'p2', eventDate: '2006-07-20', eventName: 'Live B', slug: 'live-b' },
			],
			membership: [],
			person: [],
		}).filter((entry) => entry.aggregated);

		expect(mergeFilterValues(entries)).toEqual({ project: ['project-a', 'project-b'], kind: ['event'] });
		expect(mergeFilterValues([])).toEqual({ project: [], kind: [] });
	});

	test('種別はDBのテーブル名ではなくサイト表記で示す', () => {
		expect(TIMELINE_KIND_LABELS).toEqual({ event: 'ライブ', membership: '在籍', project: 'プロジェクト', release: '発売' });
	});

	test('external projectと空日付をtimelineへ含めない', () => {
		expect(buildTimeline({ project: [{ id: 'external', name: 'External', scope: 'external' }], release: [], work: [], event: [], membership: [], person: [] })).toEqual([]);
	});
});
