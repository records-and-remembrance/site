import { describe, expect, test } from 'bun:test';
import { createRecordingOrganizerOperations, isRecordingOrganizerError, type MergeState, type RecordingMetadata, type RecordingOrganizerMutationStore, type SplitState } from './operations';

const targetId = '00000000-0000-4000-8000-000000000001';
const sourceId = '00000000-0000-4000-8000-000000000002';
const compositionId = '00000000-0000-4000-8000-000000000003';
const newRecordingId = '00000000-0000-4000-8000-000000000004';
const newContributionId = '00000000-0000-4000-8000-000000000005';
const metadata: RecordingMetadata = {
	recordingYear: 2005,
	type: 'studio',
	recordedDate: null,
	recordedFrom: null,
	recordedTo: null,
	releaseDate: '2005-06-01',
	notes: null,
};

function mutationStore(overrides: Partial<RecordingOrganizerMutationStore> = {}) {
	const calls: Array<{ method: string; value?: unknown }> = [];
	const mergeState: MergeState = {
		recordings: [
			{ id: targetId, compositionId, metadata },
			{ id: sourceId, compositionId, metadata },
		],
	};
	const splitState: SplitState = {
		recording: { id: targetId, compositionId, metadata },
		trackIds: ['track-1', 'track-2'],
		contributionIds: ['contribution-1', 'contribution-2'],
	};
	const store: RecordingOrganizerMutationStore = {
		transaction: async (operation) => await operation(store),
		loadMergeState: async () => mergeState,
		applyMerge: async (input) => {
			calls.push({ method: 'applyMerge', value: input });
		},
		loadSplitState: async () => splitState,
		applySplit: async (input) => {
			calls.push({ method: 'applySplit', value: input });
		},
		loadReviewAssignments: async () => ({
			compositionExists: true,
			assignments: [
				{ trackId: 'track-2', recordingId: sourceId },
				{ trackId: 'track-1', recordingId: targetId },
			],
		}),
		saveReview: async (input) => {
			calls.push({ method: 'saveReview', value: input });
		},
		...overrides,
	};
	return { store, calls };
}

function operations(store: RecordingOrganizerMutationStore) {
	const ids = [newRecordingId, newContributionId];
	return createRecordingOrganizerOperations(store, {
		uuid: () => ids.shift() ?? newContributionId,
		now: () => '2026-07-01T12:00:00.000Z',
	});
}

describe('recording organizer operations', () => {
	test('rejects merging recordings from different compositions', async () => {
		const { store, calls } = mutationStore({
			loadMergeState: async () => ({
				recordings: [
					{ id: targetId, compositionId, metadata },
					{
						id: sourceId,
						compositionId: '00000000-0000-4000-8000-000000000099',
						metadata,
					},
				],
			}),
		});

		expect(
			operations(store).merge({
				targetRecordingId: targetId,
				sourceRecordingIds: [sourceId],
				metadata,
			}),
		).rejects.toMatchObject({ code: 'CONSTRAINT_VIOLATION' });
		expect(calls).toEqual([]);
	});

	test('returns metadata conflicts instead of choosing a value', async () => {
		const { store } = mutationStore({
			loadMergeState: async () => ({
				recordings: [
					{ id: targetId, compositionId, metadata },
					{
						id: sourceId,
						compositionId,
						metadata: { ...metadata, type: 'live', recordingYear: 2006 },
					},
				],
			}),
		});

		try {
			await operations(store).merge({
				targetRecordingId: targetId,
				sourceRecordingIds: [sourceId],
			});
			throw new Error('expected merge to fail');
		} catch (error) {
			expect(isRecordingOrganizerError(error)).toBe(true);
			expect(error).toMatchObject({
				code: 'METADATA_CONFLICT',
				details: { fields: ['recordingYear', 'type'] },
			});
		}
	});

	test('merges tracks and contributions in one transactional store operation', async () => {
		const { store, calls } = mutationStore();

		await operations(store).merge({
			targetRecordingId: targetId,
			sourceRecordingIds: [sourceId],
			metadata,
		});

		expect(calls).toEqual([
			{
				method: 'applyMerge',
				value: {
					compositionId,
					targetRecordingId: targetId,
					sourceRecordingIds: [sourceId],
					metadata,
				},
			},
		]);
	});

	test('rejects a missing recording', async () => {
		const { store } = mutationStore({
			loadMergeState: async () => ({ recordings: [] }),
		});

		expect(
			operations(store).merge({
				targetRecordingId: targetId,
				sourceRecordingIds: [sourceId],
				metadata,
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	test('rejects moving every source track during a split', async () => {
		const { store, calls } = mutationStore();

		expect(
			operations(store).split({
				sourceRecordingId: targetId,
				trackIds: ['track-1', 'track-2'],
				metadata,
				contributionIds: [],
			}),
		).rejects.toMatchObject({ code: 'CONSTRAINT_VIOLATION' });
		expect(calls).toEqual([]);
	});

	test('rejects tracks and contributions that do not belong to the source recording', async () => {
		const { store } = mutationStore();

		expect(
			operations(store).split({
				sourceRecordingId: targetId,
				trackIds: ['another-track'],
				metadata,
				contributionIds: ['another-contribution'],
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	test('creates a split recording and copies only selected contributions', async () => {
		const { store, calls } = mutationStore();

		const result = await operations(store).split({
			sourceRecordingId: targetId,
			trackIds: ['track-1'],
			metadata: { ...metadata, type: 'live' },
			contributionIds: ['contribution-2'],
		});

		expect(result).toEqual({ recordingId: newRecordingId, compositionId });
		expect(calls[0]).toEqual({
			method: 'applySplit',
			value: {
				compositionId,
				sourceRecordingId: targetId,
				newRecordingId,
				trackIds: ['track-1'],
				metadata: { ...metadata, type: 'live' },
				contributionCopies: [{ sourceId: 'contribution-2', newId: newContributionId }],
			},
		});
	});

	test('stores a fingerprint of the current assignment when reviewed', async () => {
		const { store, calls } = mutationStore();

		const result = await operations(store).review(compositionId);

		expect(result.reviewedAt).toBe('2026-07-01T12:00:00.000Z');
		expect(result.assignmentFingerprint).toMatch(/^[a-f0-9]{64}$/);
		expect(calls[0]).toMatchObject({
			method: 'saveReview',
			value: {
				compositionId,
				reviewedAt: '2026-07-01T12:00:00.000Z',
				assignmentFingerprint: result.assignmentFingerprint,
			},
		});
	});
});
