import { sql } from 'drizzle-orm';
import type { AdminDb } from '../admin/repository/types';
import { assignmentFingerprint, type RecordingAssignment } from './fingerprint';
import type { RecordingType } from '../recording/types';
import { createRecordingOrganizerOperations, type MergeState, type RecordingOrganizerMutationStore, type RecordingState, type SplitState } from './operations';
import type {
	RecordingContribution,
	RecordingGroup,
	RecordingMetadata,
	RecordingOrganizerDetail,
	RecordingOrganizerListQuery,
	RecordingOrganizerListResult,
	RecordingOrganizerRepository,
	RecordingTrack,
} from './types';

interface QueryExecutor {
	execute(statement: ReturnType<typeof sql>): Promise<unknown>;
}

interface TransactionExecutor extends QueryExecutor {
	transaction<T>(operation: (transaction: QueryExecutor) => Promise<T>): Promise<T>;
}

export interface CompositionRow {
	id: string;
	title: string;
	trackCount: number;
	recordingCount: number;
	assignmentFingerprint: string | null;
	reviewedAt: string | null;
	assignments: RecordingAssignment[];
}

export interface TrackRow {
	compositionId: string;
	compositionTitle: string;
	assignmentFingerprint: string | null;
	reviewedAt: string | null;
	recordingId: string;
	recordingYear: number | null;
	type: RecordingType;
	recordedDate: string | null;
	recordedFrom: string | null;
	recordedTo: string | null;
	recordingReleaseDate: string | null;
	recordingNotes: string | null;
	trackId: string;
	releaseId: string;
	releaseTitle: string;
	releaseFormat: string;
	releaseDate: string | null;
	trackNumber: number;
	trackRecordedDate: string | null;
	trackNotes: string | null;
}

export interface ContributionRow extends RecordingContribution {
	recordingId: string;
}

function resultRows(result: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
	if (result && typeof result === 'object' && 'rows' in result) {
		return (result as { rows: Array<Record<string, unknown>> }).rows;
	}
	return [];
}

function reviewedStatus(assignments: RecordingAssignment[], savedFingerprint: string | null) {
	return savedFingerprint === assignmentFingerprint(assignments) ? ('reviewed' as const) : ('pending' as const);
}

export function buildOrganizerListResult(rows: CompositionRow[], query: RecordingOrganizerListQuery): RecordingOrganizerListResult {
	const projected = rows.map((row) => ({
		id: row.id,
		title: row.title,
		trackCount: Number(row.trackCount),
		recordingCount: Number(row.recordingCount),
		status: reviewedStatus(row.assignments, row.assignmentFingerprint),
		reviewedAt: row.reviewedAt,
	}));
	const pending = projected.filter((item) => item.status === 'pending').length;
	const reviewed = projected.length - pending;
	const matchingStatus = query.status === 'all' ? projected : projected.filter((item) => item.status === query.status);
	const sorted = matchingStatus.toSorted((left, right) => {
		const statusOrder = Number(left.status === 'reviewed') - Number(right.status === 'reviewed');
		return statusOrder || left.title.localeCompare(right.title, 'ja');
	});
	const offset = (query.page - 1) * query.pageSize;
	return {
		items: sorted.slice(offset, offset + query.pageSize),
		total: sorted.length,
		pending,
		reviewed,
	};
}

function metadataFromTrackRow(row: TrackRow): RecordingMetadata {
	return {
		recordingYear: row.recordingYear,
		type: row.type,
		recordedDate: row.recordedDate,
		recordedFrom: row.recordedFrom,
		recordedTo: row.recordedTo,
		releaseDate: row.recordingReleaseDate,
		notes: row.recordingNotes,
	};
}

export function buildOrganizerDetail(trackRows: TrackRow[], contributionRows: ContributionRow[]): RecordingOrganizerDetail | null {
	const first = trackRows[0];
	if (!first) return null;
	const assignments = trackRows.map((row) => ({
		trackId: row.trackId,
		recordingId: row.recordingId,
	}));
	const groups = new Map<string, RecordingGroup>();
	for (const row of trackRows) {
		const group = groups.get(row.recordingId) ?? {
			id: row.recordingId,
			...metadataFromTrackRow(row),
			tracks: [],
			contributions: [],
		};
		const track: RecordingTrack = {
			id: row.trackId,
			releaseId: row.releaseId,
			releaseTitle: row.releaseTitle,
			releaseFormat: row.releaseFormat,
			releaseDate: row.releaseDate,
			trackNumber: Number(row.trackNumber),
			recordedDate: row.trackRecordedDate,
			notes: row.trackNotes,
		};
		group.tracks.push(track);
		groups.set(row.recordingId, group);
	}
	for (const row of contributionRows) {
		const group = groups.get(row.recordingId);
		if (!group) continue;
		const { recordingId: _, ...contribution } = row;
		group.contributions.push(contribution);
	}
	return {
		id: first.compositionId,
		title: first.compositionTitle,
		status: reviewedStatus(assignments, first.assignmentFingerprint),
		reviewedAt: first.reviewedAt,
		groups: [...groups.values()],
	};
}

function toCompositionRows(result: unknown): CompositionRow[] {
	return resultRows(result).map((row) => ({
		id: String(row['id']),
		title: String(row['title']),
		trackCount: Number(row['trackCount']),
		recordingCount: Number(row['recordingCount']),
		assignmentFingerprint: row['assignmentFingerprint'] == null ? null : String(row['assignmentFingerprint']),
		reviewedAt: row['reviewedAt'] == null ? null : String(row['reviewedAt']),
		assignments: (row['assignments'] ?? []) as RecordingAssignment[],
	}));
}

const createList =
	(database: QueryExecutor) =>
	async (query: RecordingOrganizerListQuery): Promise<RecordingOrganizerListResult> => {
		const search = `%${query.search}%`;
		const result = await database.execute(sql`
			select
				c.id,
				c.title,
				count(distinct t.id)::int as "trackCount",
				count(distinct r.id)::int as "recordingCount",
				rr.assignment_fingerprint as "assignmentFingerprint",
				rr.reviewed_at as "reviewedAt",
				json_agg(
					json_build_object('trackId', t.id, 'recordingId', t.recording_id)
					order by t.id
				) as assignments
			from composition c
			join recording r on r.composition_id = c.id
			join track t on t.recording_id = r.id
			left join recording_review rr on rr.composition_id = c.id
			where c.title ilike ${search}
			group by c.id, c.title, rr.assignment_fingerprint, rr.reviewed_at
		`);
		return buildOrganizerListResult(toCompositionRows(result), query);
	};

function toTrackRows(result: unknown): TrackRow[] {
	return resultRows(result) as unknown as TrackRow[];
}

function toContributionRows(result: unknown): ContributionRow[] {
	return resultRows(result) as unknown as ContributionRow[];
}

const createDetail =
	(database: QueryExecutor) =>
	async (compositionId: string): Promise<RecordingOrganizerDetail | null> => {
		const [tracksResult, contributionsResult] = await Promise.all([
			database.execute(sql`
				select
					c.id as "compositionId",
					c.title as "compositionTitle",
					rr.assignment_fingerprint as "assignmentFingerprint",
					rr.reviewed_at as "reviewedAt",
					r.id as "recordingId",
					r.recording_year as "recordingYear",
					r.type,
					r.recorded_date as "recordedDate",
					r.recorded_from as "recordedFrom",
					r.recorded_to as "recordedTo",
					r.release_date as "recordingReleaseDate",
					r.notes as "recordingNotes",
					t.id as "trackId",
					rel.id as "releaseId",
					w.title as "releaseTitle",
					rel.format as "releaseFormat",
					rel.release_date as "releaseDate",
					t.track_number as "trackNumber",
					t.recorded_date as "trackRecordedDate",
					t.notes as "trackNotes"
				from composition c
				join recording r on r.composition_id = c.id
				join track t on t.recording_id = r.id
				join release rel on rel.id = t.release_id
				join work w on w.id = rel.work_id
				left join recording_review rr on rr.composition_id = c.id
				where c.id = ${compositionId}
				order by r.id, rel.release_date nulls last, t.track_number, t.id
			`),
			database.execute(sql`
				select
					con.id,
					con.recording_id as "recordingId",
					con.person_id as "personId",
					p.name as "personName",
					con.role_id as "roleId",
					ro.name as "roleName",
					con.instrument_id as "instrumentId",
					i.name as "instrumentName",
					con.notes
				from contribution con
				join recording r on r.id = con.recording_id
				join person p on p.id = con.person_id
				join role ro on ro.id = con.role_id
				left join instrument i on i.id = con.instrument_id
				where r.composition_id = ${compositionId}
				order by p.name, ro.name, i.name nulls last, con.id
			`),
		]);
		return buildOrganizerDetail(toTrackRows(tracksResult), toContributionRows(contributionsResult));
	};

function metadataFromRow(row: Record<string, unknown>): RecordingMetadata {
	return {
		recordingYear: row['recordingYear'] == null ? null : Number(row['recordingYear']),
		type: String(row['type']) as RecordingType,
		recordedDate: row['recordedDate'] == null ? null : String(row['recordedDate']),
		recordedFrom: row['recordedFrom'] == null ? null : String(row['recordedFrom']),
		recordedTo: row['recordedTo'] == null ? null : String(row['recordedTo']),
		releaseDate: row['releaseDate'] == null ? null : String(row['releaseDate']),
		notes: row['notes'] == null ? null : String(row['notes']),
	};
}

function recordingStateFromRow(row: Record<string, unknown>): RecordingState {
	return {
		id: String(row['id']),
		compositionId: String(row['compositionId']),
		metadata: metadataFromRow(row),
	};
}

const recordingSelection = sql`
	id,
	composition_id as "compositionId",
	recording_year as "recordingYear",
	type,
	recorded_date as "recordedDate",
	recorded_from as "recordedFrom",
	recorded_to as "recordedTo",
	release_date as "releaseDate",
	notes
`;

function uuidList(ids: string[]) {
	return sql.join(
		ids.map((id) => sql`${id}::uuid`),
		sql`, `,
	);
}

export function createRecordingOrganizerMutationStore(database: QueryExecutor, transactionRoot?: TransactionExecutor): RecordingOrganizerMutationStore {
	const store: RecordingOrganizerMutationStore = {
		transaction: async (operation) => {
			if (!transactionRoot) return await operation(store);
			return await transactionRoot.transaction(async (transaction) => await operation(createRecordingOrganizerMutationStore(transaction)));
		},
		loadMergeState: async (targetRecordingId, sourceRecordingIds): Promise<MergeState> => {
			const ids = [targetRecordingId, ...sourceRecordingIds];
			const result = await database.execute(sql`
				select ${recordingSelection}
				from recording
				where id in (${uuidList(ids)})
				for update
			`);
			return {
				recordings: resultRows(result).map(recordingStateFromRow),
			};
		},
		applyMerge: async (input) => {
			await database.execute(sql`
				update track
				set recording_id = ${input.targetRecordingId}
				where recording_id in (${uuidList(input.sourceRecordingIds)})
			`);
			await database.execute(sql`
				update contribution
				set recording_id = ${input.targetRecordingId}
				where recording_id in (${uuidList(input.sourceRecordingIds)})
			`);
			await database.execute(sql`
				delete from contribution duplicate
				using contribution keeper
				where duplicate.recording_id = ${input.targetRecordingId}
					and keeper.recording_id = ${input.targetRecordingId}
					and duplicate.id > keeper.id
					and duplicate.person_id = keeper.person_id
					and duplicate.role_id = keeper.role_id
					and duplicate.instrument_id is not distinct from keeper.instrument_id
					and duplicate.notes is not distinct from keeper.notes
			`);
			await database.execute(sql`
				update recording
				set
					recording_year = ${input.metadata.recordingYear},
					type = ${input.metadata.type},
					recorded_date = ${input.metadata.recordedDate},
					recorded_from = ${input.metadata.recordedFrom},
					recorded_to = ${input.metadata.recordedTo},
					release_date = ${input.metadata.releaseDate},
					notes = ${input.metadata.notes}
				where id = ${input.targetRecordingId}
			`);
			await database.execute(sql`
				delete from recording
				where id in (${uuidList(input.sourceRecordingIds)})
			`);
		},
		loadSplitState: async (sourceRecordingId): Promise<SplitState> => {
			const recordingResult = await database.execute(sql`
				select ${recordingSelection}
				from recording
				where id = ${sourceRecordingId}
				for update
			`);
			const tracksResult = await database.execute(sql`
				select id
				from track
				where recording_id = ${sourceRecordingId}
				for update
			`);
			const contributionsResult = await database.execute(sql`
				select id
				from contribution
				where recording_id = ${sourceRecordingId}
				for update
			`);
			const recordingRow = resultRows(recordingResult)[0];
			return {
				recording: recordingRow ? recordingStateFromRow(recordingRow) : null,
				trackIds: resultRows(tracksResult).map((row) => String(row['id'])),
				contributionIds: resultRows(contributionsResult).map((row) => String(row['id'])),
			};
		},
		applySplit: async (input) => {
			await database.execute(sql`
				insert into recording (
					id, composition_id, recording_year, type, recorded_date,
					recorded_from, recorded_to, release_date, notes
				)
				values (
					${input.newRecordingId}, ${input.compositionId},
					${input.metadata.recordingYear}, ${input.metadata.type},
					${input.metadata.recordedDate}, ${input.metadata.recordedFrom},
					${input.metadata.recordedTo}, ${input.metadata.releaseDate},
					${input.metadata.notes}
				)
			`);
			await database.execute(sql`
				update track
				set recording_id = ${input.newRecordingId}
				where id in (${uuidList(input.trackIds)})
					and recording_id = ${input.sourceRecordingId}
			`);
			for (const copy of input.contributionCopies) {
				await database.execute(sql`
					insert into contribution (
						id, person_id, role_id, instrument_id,
						recording_id, release_id, event_id, notes
					)
					select
						${copy.newId}, person_id, role_id, instrument_id,
						${input.newRecordingId}, null, null, notes
					from contribution
					where id = ${copy.sourceId}
						and recording_id = ${input.sourceRecordingId}
				`);
			}
		},
		loadReviewAssignments: async (compositionId) => {
			const result = await database.execute(sql`
				select
					c.id as "compositionId",
					t.id as "trackId",
					t.recording_id as "recordingId"
				from composition c
				left join recording r on r.composition_id = c.id
				left join track t on t.recording_id = r.id
				where c.id = ${compositionId}
				order by t.id
			`);
			const rows = resultRows(result);
			return {
				compositionExists: rows.length > 0,
				assignments: rows
					.filter((row) => row['trackId'] && row['recordingId'])
					.map((row) => ({
						trackId: String(row['trackId']),
						recordingId: String(row['recordingId']),
					})),
			};
		},
		saveReview: async (input) => {
			await database.execute(sql`
				insert into recording_review (
					composition_id, assignment_fingerprint, reviewed_at
				)
				values (
					${input.compositionId}, ${input.assignmentFingerprint},
					${input.reviewedAt}
				)
				on conflict (composition_id) do update
				set
					assignment_fingerprint = excluded.assignment_fingerprint,
					reviewed_at = excluded.reviewed_at
			`);
		},
	};
	return store;
}

export function createRecordingOrganizerRepository(database: AdminDb, options: { uuid?: () => string; now?: () => string } = {}): RecordingOrganizerRepository {
	const executor = database as unknown as TransactionExecutor;
	const store = createRecordingOrganizerMutationStore(executor, executor);
	const operations = createRecordingOrganizerOperations(store, {
		uuid: options.uuid ?? (() => crypto.randomUUID()),
		now: options.now ?? (() => new Date().toISOString()),
	});
	return {
		list: createList(executor),
		detail: createDetail(executor),
		...operations,
	};
}
