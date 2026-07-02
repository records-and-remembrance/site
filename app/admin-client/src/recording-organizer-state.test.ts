import { describe, expect, test } from 'bun:test';
import { completeSourceRecordingIds, nextPendingCompositionId, splitSourceRecording } from './recording-organizer-state';
import type { RecordingOrganizerDetail, RecordingOrganizerListItem } from '../../recording-organizer/types';

const detail: RecordingOrganizerDetail = {
	id: 'composition',
	title: 'ミナソコ',
	status: 'pending',
	reviewedAt: null,
	groups: [
		{
			id: 'recording-a',
			recordingYear: null,
			type: 'studio',
			recordedDate: null,
			recordedFrom: null,
			recordedTo: null,
			releaseDate: null,
			notes: null,
			contributions: [],
			tracks: [
				{
					id: 'track-a1',
					releaseId: 'release-a',
					releaseTitle: 'LOW NAME',
					releaseFormat: 'CD',
					releaseDate: null,
					trackNumber: 1,
					recordedDate: null,
					notes: null,
				},
			],
		},
		{
			id: 'recording-b',
			recordingYear: null,
			type: 'studio',
			recordedDate: null,
			recordedFrom: null,
			recordedTo: null,
			releaseDate: null,
			notes: null,
			contributions: [],
			tracks: [
				{
					id: 'track-b1',
					releaseId: 'release-b',
					releaseTitle: '線',
					releaseFormat: 'CD',
					releaseDate: null,
					trackNumber: 2,
					recordedDate: null,
					notes: null,
				},
				{
					id: 'track-b2',
					releaseId: 'release-c',
					releaseTitle: 'BEST',
					releaseFormat: 'CD',
					releaseDate: null,
					trackNumber: 3,
					recordedDate: null,
					notes: null,
				},
			],
		},
	],
};

describe('recording organizer selection rules', () => {
	test('merges only complete source recording groups', () => {
		expect(completeSourceRecordingIds(detail, new Set(['track-a1']), 'recording-b')).toEqual(['recording-a']);
		expect(completeSourceRecordingIds(detail, new Set(['track-b1']), 'recording-a')).toEqual([]);
		expect(completeSourceRecordingIds(detail, new Set(['track-a1', 'track-b1']), 'recording-b')).toEqual([]);
	});

	test('splits a non-empty proper subset from one recording', () => {
		expect(splitSourceRecording(detail, new Set(['track-b1']))).toMatchObject({ id: 'recording-b' });
		expect(splitSourceRecording(detail, new Set(['track-a1', 'track-b1']))).toBeNull();
		expect(splitSourceRecording(detail, new Set(['track-b1', 'track-b2']))).toBeNull();
	});

	test('finds the next pending composition and wraps around', () => {
		const item = (id: string, status: 'pending' | 'reviewed') => ({ id, title: id, status }) as RecordingOrganizerListItem;
		const items = [item('a', 'pending'), item('b', 'reviewed'), item('c', 'pending')];

		expect(nextPendingCompositionId(items, 'a')).toBe('c');
		expect(nextPendingCompositionId(items, 'c')).toBe('a');
	});
});
