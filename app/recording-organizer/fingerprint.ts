import { createHash } from 'node:crypto';

export interface RecordingAssignment {
	trackId: string;
	recordingId: string;
}

export function assignmentFingerprint(assignments: RecordingAssignment[]): string {
	const canonical = assignments
		.toSorted((left, right) => left.trackId.localeCompare(right.trackId))
		.map(({ trackId, recordingId }) => `${trackId}:${recordingId}`)
		.join('\n');
	return createHash('sha256').update(canonical).digest('hex');
}
