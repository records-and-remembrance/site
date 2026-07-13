import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertSiteSnapshotExportable, createSiteSnapshot, emptySiteDatabaseRows, stableStringify, writeSiteSnapshotAtomically, type SiteDatabaseRows } from './export';

const fixtureRows = (): SiteDatabaseRows => {
	const rows = emptySiteDatabaseRows();
	rows.project = [{ id: 'project-1', name: 'BURGER NUDS', scope: 'monden', slug: 'burger-nuds' }];
	rows.person = [{ id: 'person-1', name: '門田匡陽', slug: 'masahi-kadota' }];
	rows.composition = [{ id: 'composition-1', title: 'ANALYZE', slug: 'analyze' }];
	rows.work = [{ id: 'work-1', projectId: 'project-1', title: 'Work', slug: 'work', releasedDate: '2020-02-03' }];
	rows.release = [
		{
			id: 'release-1',
			workId: 'work-1',
			format: 'CD',
			catalogNumber: 'A-1',
			releaseDate: '2020-02-03',
			releaseDatePrecision: 'day',
			artworkUrl: 'https://example.test/artwork.jpg',
			artworkWidth: 1000,
			artworkHeight: 1000,
		},
	];
	rows.recording = [{ id: 'recording-1', compositionId: 'composition-1', type: 'studio' }];
	rows.track = [{ id: 'track-1', releaseId: 'release-1', recordingId: 'recording-1', trackNumber: 1 }];
	rows.venue = [{ id: 'venue-1', name: '新宿LOFT', slug: 'shinjuku-loft' }];
	rows.event = [{ id: 'event-1', projectId: 'project-1', venueId: 'venue-1', eventDate: '2020-02-03', slug: '2020-02-03-shinjuku-loft' }];
	rows.publication = [{ id: 'publication-1', name: '音楽と人' }];
	rows.publicationIssue = [{ id: 'issue-1', publicationId: 'publication-1', issueNumber: '3', publishedDate: '2020-02-03' }];
	rows.article = [{ id: 'article-1', publicationIssueId: 'issue-1', title: 'Interview', publishedDate: '2020-02-03', content: null }];
	return rows;
};

describe('PST-006 site export contract', () => {
	test('全テーブル、関連、key、Dig/MM-DD index、manifestを生成する', () => {
		const snapshot = createSiteSnapshot(fixtureRows(), { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });

		expect(Object.keys(snapshot.tables)).toEqual([
			'project',
			'person',
			'membership',
			'role',
			'instrument',
			'membershipRole',
			'work',
			'workProject',
			'distributor',
			'release',
			'label',
			'labelRelation',
			'composition',
			'compositionCredit',
			'recordingReview',
			'recording',
			'track',
			'venue',
			'event',
			'eventPerformance',
			'contribution',
			'publication',
			'publicationIssue',
			'article',
			'articleMentionWork',
			'articleMentionEvent',
			'articleMentionPerson',
		]);
		expect(snapshot.tables.release[0]).toMatchObject({ editionKey: 'cd-2020-02-03-a-1' });
		expect(snapshot.tables.publication[0]).toMatchObject({ libraryKey: '音楽と人' });
		expect(snapshot.tables.publicationIssue[0]).toMatchObject({ libraryKey: '音楽と人-3-2020-02-03' });
		expect(snapshot.tables.article[0]).toMatchObject({ libraryKey: '音楽と人-3-2020-02-03-interview' });
		expect(snapshot.indexes.monthDay['02-03']).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: 'event', slug: '2020-02-03-shinjuku-loft' }), expect.objectContaining({ type: 'release', editionKey: 'cd-2020-02-03-a-1' })]),
		);
		expect(snapshot.indexes.dig).toEqual(
			expect.arrayContaining([
				{ type: 'project', slug: 'burger-nuds', summary: 'BURGER NUDS' },
				{ type: 'person', slug: 'masahi-kadota', summary: '門田匡陽' },
				{ type: 'composition', slug: 'analyze', summary: 'ANALYZE' },
			]),
		);
		expect(Object.keys(snapshot.indexes.dig[0] ?? {}).sort()).toEqual(['slug', 'summary', 'type']);
		expect(snapshot.manifest).toMatchObject({ schemaVersion: 1, contentHash: expect.stringMatching(/^[a-f0-9]{64}$/), errors: [] });
		expect(snapshot.manifest.counts.release).toBe(1);
	});

	test('入力順とオブジェクトキー順に依存せず同一snapshotを作る', () => {
		const first = fixtureRows();
		const second = fixtureRows();
		second.project = [...second.project].reverse().map((row) => ({ slug: row.slug, name: row.name, id: row.id, scope: row.scope }));
		second.release = second.release.map((row) => ({
			artworkHeight: row.artworkHeight,
			artworkWidth: row.artworkWidth,
			artworkUrl: row.artworkUrl,
			releaseDatePrecision: row.releaseDatePrecision,
			releaseDate: row.releaseDate,
			catalogNumber: row.catalogNumber,
			format: row.format,
			workId: row.workId,
			id: row.id,
		}));

		const left = createSiteSnapshot(first, { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });
		const right = createSiteSnapshot(second, { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });
		expect(stableStringify(left)).toBe(stableStringify(right));
	});

	test('slug欠落、参照切れ、日付・精度・artwork不整合をexport停止エラーとして記録する', () => {
		const rows = fixtureRows();
		rows.project[0]!.slug = null;
		rows.work[0]!.projectId = 'missing-project';
		rows.event[0]!.eventDate = '2020-02-30';
		rows.release[0]!.releaseDate = null;
		rows.release[0]!.releaseDatePrecision = 'day';
		rows.release[0]!.artworkHeight = null;

		const snapshot = createSiteSnapshot(rows, { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });

		expect(snapshot.manifest.errors.map((error) => error.code)).toEqual(
			expect.arrayContaining(['PUBLIC_SLUG_MISSING', 'REFERENCE_MISSING', 'DATE_INVALID', 'DATE_PRECISION_CONFLICT', 'ARTWORK_METADATA_INCONSISTENT']),
		);
		expect(() => assertSiteSnapshotExportable(snapshot)).toThrow(/site export has contract errors/);
	});

	test('検証済みsnapshotだけを一時ディレクトリから原子的に置換する', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'monden-site-export-'));
		const outputPath = join(directory, 'site.generated.json');
		try {
			const snapshot = createSiteSnapshot(fixtureRows(), { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });
			await writeSiteSnapshotAtomically(snapshot, outputPath);
			expect(JSON.parse(await readFile(outputPath, 'utf8'))).toEqual(snapshot);

			const invalidRows = fixtureRows();
			invalidRows.project[0]!.slug = null;
			const invalidSnapshot = createSiteSnapshot(invalidRows, { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });
			await expect(writeSiteSnapshotAtomically(invalidSnapshot, outputPath)).rejects.toThrow(/site export has contract errors/);
			expect(JSON.parse(await readFile(outputPath, 'utf8'))).toEqual(snapshot);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
