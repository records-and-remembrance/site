import { assignmentFingerprint, type RecordingAssignment } from './fingerprint';
import { recordingOrganizerError, type MergeRecordingsInput, type RecordingMetadata, type SplitRecordingInput } from './types';

export { isRecordingOrganizerError, recordingOrganizerError, type RecordingOrganizerError, type RecordingMetadata } from './types';

export interface RecordingState {
	id: string;
	compositionId: string;
	metadata: RecordingMetadata;
}

export interface MergeState {
	recordings: RecordingState[];
}

export interface SplitState {
	recording: RecordingState | null;
	trackIds: string[];
	contributionIds: string[];
}

export interface RecordingOrganizerMutationStore {
	transaction<T>(operation: (transaction: RecordingOrganizerMutationStore) => Promise<T>): Promise<T>;
	loadMergeState(targetRecordingId: string, sourceRecordingIds: string[]): Promise<MergeState>;
	applyMerge(input: { compositionId: string; targetRecordingId: string; sourceRecordingIds: string[]; metadata: RecordingMetadata }): Promise<void>;
	loadSplitState(sourceRecordingId: string): Promise<SplitState>;
	applySplit(input: {
		compositionId: string;
		sourceRecordingId: string;
		newRecordingId: string;
		trackIds: string[];
		metadata: RecordingMetadata;
		contributionCopies: Array<{ sourceId: string; newId: string }>;
	}): Promise<void>;
	loadReviewAssignments(compositionId: string): Promise<{
		compositionExists: boolean;
		assignments: RecordingAssignment[];
	}>;
	saveReview(input: { compositionId: string; assignmentFingerprint: string; reviewedAt: string }): Promise<void>;
}

interface OperationOptions {
	uuid: () => string;
	now: () => string;
}

const metadataKeys = ['recordingYear', 'type', 'recordedDate', 'recordedFrom', 'recordedTo', 'releaseDate', 'notes'] as const satisfies readonly (keyof RecordingMetadata)[];

function uniqueIds(ids: string[]): string[] {
	return [...new Set(ids)];
}

function metadataConflicts(recordings: RecordingState[]): string[] {
	return metadataKeys.filter((key) => {
		const values = recordings.map((recording) => recording.metadata[key]);
		return values.some((value) => value !== values[0]);
	});
}

function validateMergeState(state: MergeState, targetRecordingId: string, sourceRecordingIds: string[]): RecordingState[] {
	const requestedIds = [targetRecordingId, ...sourceRecordingIds];
	if (state.recordings.length !== requestedIds.length || requestedIds.some((id) => !state.recordings.some((recording) => recording.id === id))) {
		throw recordingOrganizerError('NOT_FOUND', 'One or more recordings were not found');
	}
	const compositionIds = new Set(state.recordings.map((recording) => recording.compositionId));
	if (compositionIds.size !== 1) {
		throw recordingOrganizerError('CONSTRAINT_VIOLATION', 'Recordings from different compositions cannot be merged');
	}
	return state.recordings;
}

function validateSplitSelection(state: SplitState, trackIds: string[], contributionIds: string[]): asserts state is SplitState & { recording: RecordingState } {
	if (!state.recording) {
		throw recordingOrganizerError('NOT_FOUND', 'Recording was not found');
	}
	if (trackIds.some((id) => !state.trackIds.includes(id)) || contributionIds.some((id) => !state.contributionIds.includes(id))) {
		throw recordingOrganizerError('NOT_FOUND', 'A selected track or contribution does not belong to the recording');
	}
	if (trackIds.length === state.trackIds.length) {
		throw recordingOrganizerError('CONSTRAINT_VIOLATION', 'At least one track must remain in the source recording');
	}
}

export function createRecordingOrganizerOperations(store: RecordingOrganizerMutationStore, options: OperationOptions) {
	const merge = async (input: MergeRecordingsInput): Promise<{ compositionId: string }> =>
		await store.transaction(async (transaction) => {
			const sourceRecordingIds = uniqueIds(input.sourceRecordingIds).filter((id) => id !== input.targetRecordingId);
			if (sourceRecordingIds.length === 0) {
				throw recordingOrganizerError('CONSTRAINT_VIOLATION', 'Select at least one different source recording');
			}
			const state = await transaction.loadMergeState(input.targetRecordingId, sourceRecordingIds);
			const recordings = validateMergeState(state, input.targetRecordingId, sourceRecordingIds);
			const conflicts = metadataConflicts(recordings);
			if (!input.metadata && conflicts.length > 0) {
				throw recordingOrganizerError('METADATA_CONFLICT', 'Recording metadata conflicts', { fields: conflicts });
			}
			const target = recordings.find((recording) => recording.id === input.targetRecordingId)!;
			const metadata = input.metadata ?? target.metadata;
			await transaction.applyMerge({
				compositionId: target.compositionId,
				targetRecordingId: input.targetRecordingId,
				sourceRecordingIds,
				metadata,
			});
			return { compositionId: target.compositionId };
		});

	const split = async (input: SplitRecordingInput): Promise<{ compositionId: string; recordingId: string }> =>
		await store.transaction(async (transaction) => {
			const trackIds = uniqueIds(input.trackIds);
			const contributionIds = uniqueIds(input.contributionIds);
			if (trackIds.length === 0) {
				throw recordingOrganizerError('CONSTRAINT_VIOLATION', 'Select at least one track to split');
			}
			const state = await transaction.loadSplitState(input.sourceRecordingId);
			validateSplitSelection(state, trackIds, contributionIds);
			const recordingId = options.uuid();
			const contributionCopies = contributionIds.map((sourceId) => ({
				sourceId,
				newId: options.uuid(),
			}));
			await transaction.applySplit({
				compositionId: state.recording.compositionId,
				sourceRecordingId: input.sourceRecordingId,
				newRecordingId: recordingId,
				trackIds,
				metadata: input.metadata,
				contributionCopies,
			});
			return { compositionId: state.recording.compositionId, recordingId };
		});

	const review = async (compositionId: string) =>
		await store.transaction(async (transaction) => {
			const state = await transaction.loadReviewAssignments(compositionId);
			if (!state.compositionExists) {
				throw recordingOrganizerError('NOT_FOUND', 'Composition was not found');
			}
			const fingerprint = assignmentFingerprint(state.assignments);
			const reviewedAt = options.now();
			await transaction.saveReview({
				compositionId,
				assignmentFingerprint: fingerprint,
				reviewedAt,
			});
			return {
				compositionId,
				assignmentFingerprint: fingerprint,
				reviewedAt,
			};
		});

	return { merge, split, review };
}
