import { describe, expect, test } from 'bun:test';
import { createSlugReviewRoutes } from './routes';
import type { SlugReviewRepository } from './types';

const repository: SlugReviewRepository = {
	async get() {
		return {
			summary: { total: 1, proposed: 0, preserved: 0, needsReview: 1, collisions: 0, unresolved: 1 },
			meta: { reviewStatuses: { pending: 1, approved: 0, rejected: 0 } },
			records: [],
		};
	},
	async saveDecision(entityType, id, input) {
		return { entityType, id, ...input };
	},
	async getArtifact() {
		return { schemaVersion: 1, sourceCandidateArtifact: 'slug-candidates.json', decisions: [] };
	},
};

describe('slug review routes', () => {
	test('serves the current candidate and review state', async () => {
		const response = await createSlugReviewRoutes(repository).request('/');

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ data: { summary: { needsReview: 1 } } });
	});

	test('serves the apply-compatible review artifact', async () => {
		const response = await createSlugReviewRoutes(repository).request('/artifact');

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: { schemaVersion: 1, sourceCandidateArtifact: 'slug-candidates.json', decisions: [] } });
	});

	test('validates and saves a slug decision', async () => {
		const response = await createSlugReviewRoutes(repository).request('/records/project/project-1/decision', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status: 'approved', slug: 'kadota-masaharu' }),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ data: { entityType: 'project', id: 'project-1', status: 'approved' } });
	});

	test('rejects an incomplete decision payload', async () => {
		const response = await createSlugReviewRoutes(repository).request('/records/project/project-1/decision', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status: 'pending', slug: null }),
		});

		expect(response.status).toBe(400);
	});
});
