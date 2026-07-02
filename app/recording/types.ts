export const recordingTypes = ['studio', 'live', 'demo', 'rehearsal', 'other'] as const;

export type RecordingType = (typeof recordingTypes)[number];
