import { expect, test } from 'bun:test';
import type { AdminRepository } from './admin/types';
import type { RecordingOrganizerRepository } from './recording-organizer/types';
import type { MagazineReviewRepository } from './magazine-review/types';
import { createApp } from './server';

const repository: AdminRepository = {
	async list() {
		return { items: [], total: 0 };
	},
	async detail() {
		return null;
	},
	async create(_resource, value) {
		return value;
	},
	async update(_resource, id, value) {
		return { id, ...value };
	},
	async lookup() {
		return [];
	},
};

const recordingOrganizerRepository: RecordingOrganizerRepository = {
	async list() {
		return { items: [], total: 0, pending: 0, reviewed: 0 };
	},
	async detail() {
		return null;
	},
	async merge() {
		return { compositionId: '00000000-0000-4000-8000-000000000001' };
	},
	async split() {
		return {
			compositionId: '00000000-0000-4000-8000-000000000001',
			recordingId: '00000000-0000-4000-8000-000000000002',
		};
	},
	async review(compositionId) {
		return {
			compositionId,
			assignmentFingerprint: 'fingerprint',
			reviewedAt: '2026-07-01T00:00:00.000Z',
		};
	},
};

const magazineReviewRepository: MagazineReviewRepository = {
	async get() {
		return {
			summary: {
				sourceRows: 241,
				articleCandidates: 255,
				reviewStatuses: { confirmed: 131, inferred: 7, unresolved: 98, not_published: 5 },
				classificationSources: { explicit: 194, inferred: 17, unresolved: 30 },
				parserDiagnostics: [],
			},
			meta: { humanReviewStatuses: { pending: 241, approved: 0, needs_changes: 0, excluded: 0 } },
			records: [],
		};
	},
	async saveDecision(sourceKey, input) {
		return { sourceKey, ...input, updatedAt: '2026-07-03T00:00:00.000Z' };
	},
};

test('keeps the composition review UI and mounts the admin API', async () => {
	const app = createApp({ adminRepository: repository, recordingOrganizerRepository, magazineReviewRepository });

	const reviewResponse = await app.request('/');
	expect(reviewResponse.status).toBe(200);
	expect(reviewResponse.headers.get('content-type')).toContain('text/html');

	const adminResponse = await app.request('/api/admin/people');
	expect(adminResponse.status).toBe(200);
	expect(await adminResponse.json()).toEqual({
		data: [],
		meta: { page: 1, pageSize: 20, total: 0 },
	});

	const organizerResponse = await app.request('/api/recording-organizer/compositions');
	expect(organizerResponse.status).toBe(200);
	expect(await organizerResponse.json()).toMatchObject({
		data: [],
		meta: { pending: 0, reviewed: 0 },
	});

	const magazineResponse = await app.request('/api/magazine-review');
	expect(magazineResponse.status).toBe(200);
	expect(await magazineResponse.json()).toMatchObject({
		data: { summary: { sourceRows: 241 } },
	});
});
