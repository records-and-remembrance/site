import { describe, expect, test } from 'bun:test';
import { assignmentFingerprint } from './fingerprint';

describe('assignmentFingerprint', () => {
	test('is stable regardless of input order', () => {
		const assignments = [
			{ trackId: 'track-b', recordingId: 'recording-2' },
			{ trackId: 'track-a', recordingId: 'recording-1' },
		];

		expect(assignmentFingerprint(assignments)).toBe(assignmentFingerprint(assignments.toReversed()));
	});

	test('changes when a track is assigned to another recording', () => {
		const before = assignmentFingerprint([{ trackId: 'track-a', recordingId: 'recording-1' }]);
		const after = assignmentFingerprint([{ trackId: 'track-a', recordingId: 'recording-2' }]);

		expect(after).not.toBe(before);
	});
});
