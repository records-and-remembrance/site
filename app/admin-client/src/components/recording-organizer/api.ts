import type {
	MergeRecordingsInput,
	RecordingOrganizerDetail,
	RecordingOrganizerListItem,
	RecordingOrganizerListQuery,
	RecordingMetadata,
	SplitRecordingInput,
} from '../../../../recording-organizer/types';
import { request, saveRecord } from '../../api';

interface OrganizerListResponse {
	data: RecordingOrganizerListItem[];
	meta: {
		page: number;
		pageSize: number;
		total: number;
		pending: number;
		reviewed: number;
	};
}

export async function listOrganizerCompositions(query: RecordingOrganizerListQuery): Promise<OrganizerListResponse> {
	const search = new URLSearchParams({
		search: query.search,
		status: query.status,
		page: String(query.page),
		pageSize: String(query.pageSize),
	});
	return await request<OrganizerListResponse>(`/api/recording-organizer/compositions?${search}`);
}

export async function getOrganizerComposition(compositionId: string): Promise<RecordingOrganizerDetail> {
	const response = await request<{ data: RecordingOrganizerDetail }>(`/api/recording-organizer/compositions/${compositionId}`);
	return response.data;
}

export async function mergeOrganizerRecordings(input: MergeRecordingsInput): Promise<{ compositionId: string }> {
	const response = await request<{ data: { compositionId: string } }>('/api/recording-organizer/merge', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input),
	});
	return response.data;
}

export async function splitOrganizerRecording(input: SplitRecordingInput): Promise<{ compositionId: string; recordingId: string }> {
	const response = await request<{
		data: { compositionId: string; recordingId: string };
	}>('/api/recording-organizer/split', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input),
	});
	return response.data;
}

export async function reviewOrganizerComposition(compositionId: string): Promise<void> {
	await request(`/api/recording-organizer/compositions/${compositionId}/review`, { method: 'POST' });
}

export async function updateOrganizerRecording(compositionId: string, recordingId: string, metadata: RecordingMetadata): Promise<void> {
	await saveRecord('recordings', { compositionId, ...metadata }, recordingId);
}
