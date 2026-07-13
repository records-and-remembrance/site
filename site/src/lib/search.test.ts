import { describe, expect, test } from 'bun:test';
import { buildSearchRecords, searchRecords } from './search';

describe('PST-026 search', () => {
	test('公開slugとlibraryKeyのある対象だけを検索index用recordsへ変換する', () => {
		const records = buildSearchRecords({
			tables: {
				project: [{ id: 'p', name: 'BURGER NUDS', slug: 'burger-nuds' }],
				person: [],
				membership: [],
				role: [],
				instrument: [],
				membershipRole: [],
				work: [],
				workProject: [],
				distributor: [],
				release: [],
				label: [],
				labelRelation: [],
				composition: [{ id: 'c', title: 'ANALYZE', slug: 'analyze' }],
				compositionCredit: [],
				recordingReview: [],
				recording: [],
				track: [],
				venue: [],
				event: [],
				eventPerformance: [],
				contribution: [],
				publication: [],
				publicationIssue: [],
				article: [{ id: 'a', title: '資料記事', libraryKey: 'pub-issue-article', content: null }],
				articleMentionWork: [],
				articleMentionEvent: [],
				articleMentionPerson: [],
			},
			indexes: { dig: [], monthDay: {} },
			manifest: { counts: {}, errors: [], warnings: [], contentHash: '', schemaVersion: 1, snapshotGeneratedAt: '' },
			schemaVersion: 1,
			snapshotGeneratedAt: '',
			title: 'site',
			description: '',
			featuredProject: '',
		} as never);
		expect(records.map((record) => record.href)).toContain('/songs/analyze');
		expect(records.find((record) => record.kind === '記事')?.href).toBe('/library#article-pub-issue-article');
	});

	test('日本語・英字・空白を扱い、空queryは結果を返さない', () => {
		const records = [{ id: '1', title: 'ANALYZE', kind: '楽曲', href: '/songs/analyze', text: 'ANALYZE 黄金の鐘' }];
		expect(searchRecords(records, 'analyze')).toHaveLength(1);
		expect(searchRecords(records, '黄金')).toHaveLength(1);
		expect(searchRecords(records, '   ')).toEqual([]);
	});
});
