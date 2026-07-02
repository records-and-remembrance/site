import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { createRecordingOrganizerRoutes } from './routes';
import { recordingOrganizerError, type RecordingOrganizerRepository } from './types';

const compositionId = '00000000-0000-4000-8000-000000000001';
const recordingId = '00000000-0000-4000-8000-000000000002';

function fakeRepository(overrides: Partial<RecordingOrganizerRepository> = {}): RecordingOrganizerRepository {
	return {
		list: async () => ({ items: [], total: 0, pending: 0, reviewed: 0 }),
		detail: async () => null,
		merge: async () => ({ compositionId }),
		split: async () => ({ compositionId, recordingId }),
		review: async () => ({
			compositionId,
			assignmentFingerprint: 'fingerprint',
			reviewedAt: '2026-07-01T00:00:00.000Z',
		}),
		...overrides,
	};
}

function testApp(repository: RecordingOrganizerRepository) {
	const app = new Hono();
	app.route('/api/recording-organizer', createRecordingOrganizerRoutes(repository));
	return app;
}

describe('recording organizer API', () => {
	test('normalizes list search, review status, and paging', async () => {
		let received: unknown;
		const response = await testApp(
			fakeRepository({
				list: async (query) => {
					received = query;
					return { items: [], total: 0, pending: 12, reviewed: 4 };
				},
			}),
		).request('/api/recording-organizer/compositions?search=%E3%83%9F%E3%83%8A&status=reviewed&page=2&pageSize=25');

		expect(response.status).toBe(200);
		expect(received).toEqual({
			search: 'ミナ',
			status: 'reviewed',
			page: 2,
			pageSize: 25,
		});
		expect(await response.json()).toEqual({
			data: [],
			meta: {
				page: 2,
				pageSize: 25,
				total: 0,
				pending: 12,
				reviewed: 4,
			},
		});
	});

	test('returns composition detail', async () => {
		const detail = {
			id: compositionId,
			title: 'ミナソコ',
			status: 'pending' as const,
			reviewedAt: null,
			groups: [],
		};
		const response = await testApp(fakeRepository({ detail: async () => detail })).request(`/api/recording-organizer/compositions/${compositionId}`);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: detail });
	});

	test('validates merge input', async () => {
		const response = await testApp(fakeRepository()).request('/api/recording-organizer/merge', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				targetRecordingId: recordingId,
				sourceRecordingIds: [],
			}),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: 'VALIDATION_ERROR' },
		});
	});

	test('returns metadata conflict details', async () => {
		const response = await testApp(
			fakeRepository({
				merge: async () => {
					throw recordingOrganizerError('METADATA_CONFLICT', 'Recording metadata conflicts', { fields: ['type'] });
				},
			}),
		).request('/api/recording-organizer/merge', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				targetRecordingId: recordingId,
				sourceRecordingIds: ['00000000-0000-4000-8000-000000000003'],
			}),
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: {
				code: 'METADATA_CONFLICT',
				message: 'Recording metadata conflicts',
				details: { fields: ['type'] },
			},
		});
	});

	test('maps not found and constraint violations', async () => {
		const notFound = await testApp(
			fakeRepository({
				split: async () => {
					throw recordingOrganizerError('NOT_FOUND', 'Recording was not found');
				},
			}),
		).request('/api/recording-organizer/split', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				sourceRecordingId: recordingId,
				trackIds: ['00000000-0000-4000-8000-000000000004'],
				contributionIds: [],
				metadata: {
					recordingYear: null,
					type: null,
					recordedDate: null,
					recordedFrom: null,
					recordedTo: null,
					releaseDate: null,
					notes: null,
				},
			}),
		});

		expect(notFound.status).toBe(404);
		expect(await notFound.json()).toMatchObject({
			error: { code: 'NOT_FOUND' },
		});

		const constraintViolation = await testApp(
			fakeRepository({
				merge: async () => {
					throw Object.assign(new Error('recorded_to is before recorded_from'), {
						code: '23514',
						constraint: 'recording_recorded_to_check',
					});
				},
			}),
		).request('/api/recording-organizer/merge', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				targetRecordingId: recordingId,
				sourceRecordingIds: ['00000000-0000-4000-8000-000000000003'],
				metadata: {
					recordingYear: null,
					type: null,
					recordedDate: null,
					recordedFrom: '2026-07-02',
					recordedTo: '2026-07-01',
					releaseDate: null,
					notes: null,
				},
			}),
		});

		expect(constraintViolation.status).toBe(400);
		expect(await constraintViolation.json()).toEqual({
			error: {
				code: 'CONSTRAINT_VIOLATION',
				message: 'The values violate a database constraint',
				constraint: 'recording_recorded_to_check',
			},
		});
	});

	test('marks the current assignment as reviewed', async () => {
		let reviewedId: string | undefined;
		const response = await testApp(
			fakeRepository({
				review: async (id) => {
					reviewedId = id;
					return {
						compositionId: id,
						assignmentFingerprint: 'fingerprint',
						reviewedAt: '2026-07-01T00:00:00.000Z',
					};
				},
			}),
		).request(`/api/recording-organizer/compositions/${compositionId}/review`, { method: 'POST' });

		expect(response.status).toBe(200);
		expect(reviewedId).toBe(compositionId);
	});
});
