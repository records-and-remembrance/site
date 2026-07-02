export type RecordingReviewStatus = 'pending' | 'reviewed';
export type RecordingReviewFilter = RecordingReviewStatus | 'all';

export interface RecordingMetadata {
	recordingYear: number | null;
	type: string | null;
	recordedDate: string | null;
	recordedFrom: string | null;
	recordedTo: string | null;
	releaseDate: string | null;
	notes: string | null;
}

export interface RecordingOrganizerListQuery {
	search: string;
	status: RecordingReviewFilter;
	page: number;
	pageSize: number;
}

export interface RecordingOrganizerListItem {
	id: string;
	title: string;
	trackCount: number;
	recordingCount: number;
	status: RecordingReviewStatus;
	reviewedAt: string | null;
}

export interface RecordingOrganizerListResult {
	items: RecordingOrganizerListItem[];
	total: number;
	pending: number;
	reviewed: number;
}

export interface RecordingContribution {
	id: string;
	personId: string;
	personName: string;
	roleId: string;
	roleName: string;
	instrumentId: string | null;
	instrumentName: string | null;
	notes: string | null;
}

export interface RecordingTrack {
	id: string;
	releaseId: string;
	releaseTitle: string;
	releaseFormat: string;
	releaseDate: string | null;
	trackNumber: number;
	recordedDate: string | null;
	notes: string | null;
}

export interface RecordingGroup extends RecordingMetadata {
	id: string;
	tracks: RecordingTrack[];
	contributions: RecordingContribution[];
}

export interface RecordingOrganizerDetail {
	id: string;
	title: string;
	status: RecordingReviewStatus;
	reviewedAt: string | null;
	groups: RecordingGroup[];
}

export interface MergeRecordingsInput {
	targetRecordingId: string;
	sourceRecordingIds: string[];
	metadata?: RecordingMetadata | undefined;
}

export interface SplitRecordingInput {
	sourceRecordingId: string;
	trackIds: string[];
	metadata: RecordingMetadata;
	contributionIds: string[];
}

export interface RecordingOrganizerRepository {
	list(query: RecordingOrganizerListQuery): Promise<RecordingOrganizerListResult>;
	detail(compositionId: string): Promise<RecordingOrganizerDetail | null>;
	merge(input: MergeRecordingsInput): Promise<{ compositionId: string }>;
	split(input: SplitRecordingInput): Promise<{ compositionId: string; recordingId: string }>;
	review(compositionId: string): Promise<{
		compositionId: string;
		assignmentFingerprint: string;
		reviewedAt: string;
	}>;
}

export type RecordingOrganizerErrorCode = 'NOT_FOUND' | 'CONSTRAINT_VIOLATION' | 'METADATA_CONFLICT';

export interface RecordingOrganizerError extends Error {
	code: RecordingOrganizerErrorCode;
	details?: Record<string, unknown>;
}

export function recordingOrganizerError(code: RecordingOrganizerErrorCode, message: string, details?: Record<string, unknown>): RecordingOrganizerError {
	return Object.assign(new Error(message), {
		code,
		...(details ? { details } : {}),
	});
}

export function isRecordingOrganizerError(error: unknown): error is RecordingOrganizerError {
	return error instanceof Error && 'code' in error && ['NOT_FOUND', 'CONSTRAINT_VIOLATION', 'METADATA_CONFLICT'].includes(String(error.code));
}
