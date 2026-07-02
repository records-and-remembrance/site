import { describe, expect, test } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { assignmentFingerprint } from './fingerprint';
import { buildOrganizerDetail, buildOrganizerListResult, createRecordingOrganizerMutationStore, type CompositionRow, type ContributionRow, type TrackRow } from './repository';

const compositionId = '00000000-0000-4000-8000-000000000001';
const recordingId = '00000000-0000-4000-8000-000000000002';
const assignments = [
	{
		trackId: '00000000-0000-4000-8000-000000000003',
		recordingId,
	},
];

function compositionRow(overrides: Partial<CompositionRow> = {}): CompositionRow {
	return {
		id: compositionId,
		title: 'ミナソコ',
		trackCount: 1,
		recordingCount: 1,
		assignmentFingerprint: null,
		reviewedAt: null,
		assignments,
		...overrides,
	};
}

describe('recording organizer repository projections', () => {
	test('marks a changed assignment as pending and preserves matching reviews', () => {
		const fingerprint = assignmentFingerprint(assignments);
		const result = buildOrganizerListResult(
			[
				compositionRow({
					assignmentFingerprint: fingerprint,
					reviewedAt: '2026-07-01T00:00:00.000Z',
				}),
				compositionRow({
					id: '00000000-0000-4000-8000-000000000099',
					title: 'ANALYZE',
					assignmentFingerprint: 'stale-fingerprint',
					reviewedAt: '2026-06-30T00:00:00.000Z',
				}),
			],
			{ search: '', status: 'all', page: 1, pageSize: 20 },
		);

		expect(result.reviewed).toBe(1);
		expect(result.pending).toBe(1);
		expect(result.items.map((item) => [item.title, item.status])).toEqual([
			['ANALYZE', 'pending'],
			['ミナソコ', 'reviewed'],
		]);
	});

	test('filters review status before paging', () => {
		const result = buildOrganizerListResult([compositionRow(), compositionRow({ id: 'another', title: '別の曲' })], { search: '', status: 'pending', page: 2, pageSize: 1 });

		expect(result.total).toBe(2);
		expect(result.items).toHaveLength(1);
	});

	test('groups release tracks and recording contributions', () => {
		const trackRows: TrackRow[] = [
			{
				compositionId,
				compositionTitle: 'ミナソコ',
				assignmentFingerprint: null,
				reviewedAt: null,
				recordingId,
				versionName: 'Album version',
				versionDescription: 'ストリングスを加えたバージョン',
				recordingYear: 2005,
				type: 'studio',
				recordedDate: null,
				recordedFrom: null,
				recordedTo: null,
				recordingReleaseDate: null,
				recordingNotes: null,
				trackId: assignments[0]!.trackId,
				releaseId: 'release-1',
				releaseTitle: 'LOW NAME',
				releaseFormat: 'CD',
				releaseDate: '2005-06-01',
				trackNumber: 1,
				trackRecordedDate: null,
				trackNotes: null,
			},
		];
		const contributionRows: ContributionRow[] = [
			{
				id: 'contribution-1',
				recordingId,
				personId: 'person-1',
				personName: '門田匡陽',
				roleId: 'role-1',
				roleName: 'performer',
				instrumentId: 'instrument-1',
				instrumentName: 'guitar',
				notes: null,
			},
		];

		const detail = buildOrganizerDetail(trackRows, contributionRows);

		expect(detail?.groups[0]).toMatchObject({
			id: recordingId,
			versionName: 'Album version',
			versionDescription: 'ストリングスを加えたバージョン',
			tracks: [{ releaseTitle: 'LOW NAME', releaseFormat: 'CD' }],
			contributions: [{ personName: '門田匡陽', instrumentName: 'guitar' }],
		});
	});

	test('binds UUID collections as an IN list rather than a PostgreSQL record', async () => {
		const dialect = new PgDialect();
		const queries: Array<{ sql: string; params: unknown[] }> = [];
		const store = createRecordingOrganizerMutationStore({
			async execute(statement) {
				const query = dialect.sqlToQuery(statement);
				queries.push(query);
				return { rows: [] };
			},
		});

		await store.loadMergeState('00000000-0000-4000-8000-000000000001', ['00000000-0000-4000-8000-000000000002']);

		expect(queries[0]?.sql).toContain('where id in ($1::uuid, $2::uuid)');
		expect(queries[0]?.sql).not.toContain('any(($1, $2)::uuid[])');
	});

	test('persists version details when recordings are merged or split', async () => {
		const dialect = new PgDialect();
		const queries: Array<{ sql: string; params: unknown[] }> = [];
		const store = createRecordingOrganizerMutationStore({
			async execute(statement) {
				const query = dialect.sqlToQuery(statement);
				queries.push(query);
				return { rows: [] };
			},
		});
		const metadata = {
			versionName: 'Album version',
			versionDescription: 'ストリングスを加えたバージョン',
			recordingYear: 2005,
			type: 'studio' as const,
			recordedDate: null,
			recordedFrom: null,
			recordedTo: null,
			releaseDate: '2005-06-01',
			notes: null,
		};

		await store.applyMerge({
			compositionId,
			targetRecordingId: recordingId,
			sourceRecordingIds: ['00000000-0000-4000-8000-000000000099'],
			metadata,
		});
		const updateRecording = queries.find((query) => query.sql.includes('update recording'));
		expect(updateRecording?.sql).toContain('version_name = $1');
		expect(updateRecording?.sql).toContain('version_description = $2');
		expect(updateRecording?.params.slice(0, 2)).toEqual(['Album version', 'ストリングスを加えたバージョン']);

		queries.length = 0;
		await store.applySplit({
			compositionId,
			sourceRecordingId: recordingId,
			newRecordingId: '00000000-0000-4000-8000-000000000098',
			trackIds: ['00000000-0000-4000-8000-000000000003'],
			metadata,
			contributionCopies: [],
		});
		expect(queries[0]?.sql).toContain('version_name, version_description');
		expect(queries[0]?.params.slice(2, 4)).toEqual(['Album version', 'ストリングスを加えたバージョン']);
	});
});
