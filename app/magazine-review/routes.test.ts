import { describe, expect, test } from 'bun:test';
import { createMagazineReviewRoutes } from './routes';
import type { MagazineReviewRepository } from './types';

const saved: Array<{ sourceKey: string; status: string; notes: string }> = [];
const repository: MagazineReviewRepository = {
	async get() {
		return {
			summary: {
				sourceRows: 241,
				articleCandidates: 255,
				reviewStatuses: { confirmed: 131, inferred: 7, unresolved: 98, not_published: 5 },
				classificationSources: { explicit: 194, inferred: 17, unresolved: 30 },
				parserDiagnostics: [],
			},
			meta: {
				humanReviewStatuses: { pending: 241, approved: 0, needs_changes: 0, excluded: 0 },
			},
			records: [],
		};
	},
	async saveDecision(sourceKey, input) {
		saved.push({ sourceKey, ...input });
		return { sourceKey, ...input, updatedAt: '2026-07-03T00:00:00.000Z' };
	},
};

describe('magazine review routes', () => {
	test('serves the review dataset', async () => {
		const response = await createMagazineReviewRoutes(repository).request('/');

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			data: { summary: { sourceRows: 241 } },
		});
	});

	test('validates and saves a human decision', async () => {
		saved.length = 0;
		const response = await createMagazineReviewRoutes(repository).request('/records/source-1/decision', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status: 'approved', notes: '確認済み' }),
		});

		expect(response.status).toBe(200);
		expect(saved).toEqual([{ sourceKey: 'source-1', status: 'approved', notes: '確認済み' }]);
	});

	test('rejects pending as a persisted decision', async () => {
		const response = await createMagazineReviewRoutes(repository).request('/records/source-1/decision', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status: 'pending', notes: '' }),
		});

		expect(response.status).toBe(400);
	});
});
