import { describe, expect, test } from 'bun:test';
import { applySlugReviews, createInMemorySlugStore, type SlugReviewArtifact } from './apply_slug_reviews';

const reviewArtifact = (decisions: SlugReviewArtifact['decisions']): SlugReviewArtifact => ({
	schemaVersion: 1,
	sourceCandidateArtifact: 'slug-candidates.json',
	decisions,
	redirects: [],
});

describe('applySlugReviews', () => {
	test('承認済みslugだけを反映し、却下値は変更せずevent slugを決定する', async () => {
		const store = createInMemorySlugStore({
			entities: {
				project: [
					{ id: 'project-1', slug: null },
					{ id: 'project-2', slug: null },
				],
				person: [],
				composition: [],
				work: [],
				venue: [{ id: 'venue-1', slug: null }],
			},
			events: [
				{ id: 'event-1', eventDate: '2020-01-01', venueId: 'venue-1', slug: null },
				{ id: 'event-2', eventDate: '2020-01-01', venueId: 'venue-1', slug: null },
			],
		});

		const result = await applySlugReviews(store, {
			...reviewArtifact([
				{ entityType: 'project', id: 'project-1', status: 'approved', slug: 'burger-nuds' },
				{ entityType: 'project', id: 'project-2', status: 'rejected', slug: 'not-published' },
				{ entityType: 'venue', id: 'venue-1', status: 'approved', slug: 'shinjuku-loft' },
			]),
			redirects: [{ entityType: 'project', id: 'project-1', from: 'old-burger-nuds', to: 'burger-nuds' }],
		});

		expect(result).toMatchObject({
			updatedEntitySlugs: 2,
			updatedEventSlugs: 2,
			rejected: 1,
			diagnostics: [],
			redirects: [{ entityType: 'project', id: 'project-1', from: 'old-burger-nuds', to: 'burger-nuds' }],
		});
		expect(await store.readEntity('project', 'project-1')).toEqual({ id: 'project-1', slug: 'burger-nuds' });
		expect(await store.readEntity('project', 'project-2')).toEqual({ id: 'project-2', slug: null });
		expect(await store.readEntity('venue', 'venue-1')).toEqual({ id: 'venue-1', slug: 'shinjuku-loft' });
		expect(await store.readEvent('event-1')).toMatchObject({ slug: '2020-01-01-shinjuku-loft' });
		expect(await store.readEvent('event-2')).toMatchObject({ slug: '2020-01-01-shinjuku-loft-2' });

		const secondRun = await applySlugReviews(store, reviewArtifact([]));
		expect(secondRun).toMatchObject({ updatedEntitySlugs: 0, updatedEventSlugs: 0, rejected: 0, diagnostics: [] });
	});

	test('既存slugは再レビュー時に上書きし、同一種別の重複、形式不正は反映前に拒否する', async () => {
		const store = createInMemorySlugStore({
			entities: {
				project: [
					{ id: 'project-1', slug: 'published-slug' },
					{ id: 'project-2', slug: null },
				],
				person: [],
				composition: [],
				work: [],
				venue: [],
			},
			events: [],
		});

		const result = await applySlugReviews(store, reviewArtifact([{ entityType: 'project', id: 'project-1', status: 'approved', slug: 'changed-slug' }]));
		expect(result).toMatchObject({ updatedEntitySlugs: 1, updatedEventSlugs: 0, rejected: 0, diagnostics: [] });
		expect(await store.readEntity('project', 'project-1')).toEqual({ id: 'project-1', slug: 'changed-slug' });

		await expect(applySlugReviews(store, reviewArtifact([{ entityType: 'project', id: 'project-2', status: 'approved', slug: 'changed-slug' }]))).rejects.toMatchObject({ code: 'SLUG_CONFLICT' });

		await expect(applySlugReviews(store, reviewArtifact([{ entityType: 'project', id: 'project-2', status: 'approved', slug: 'Bad Slug' }]))).rejects.toMatchObject({ code: 'SLUG_INVALID' });

		expect(await store.readEntity('project', 'project-1')).toEqual({ id: 'project-1', slug: 'changed-slug' });
	});

	test('venue slugが未確定のeventは更新せず診断を返す', async () => {
		const store = createInMemorySlugStore({
			entities: {
				project: [],
				person: [],
				composition: [],
				work: [],
				venue: [{ id: 'venue-1', slug: null }],
			},
			events: [{ id: 'event-1', eventDate: '2020-01-01', venueId: 'venue-1', slug: null }],
		});

		const result = await applySlugReviews(store, reviewArtifact([]));

		expect(result.updatedEventSlugs).toBe(0);
		expect(result.diagnostics).toEqual([{ code: 'EVENT_VENUE_SLUG_MISSING', eventId: 'event-1', venueId: 'venue-1' }]);
		expect(await store.readEvent('event-1')).toMatchObject({ slug: null });
	});

	test('redirectの重複と連鎖を反映前に拒否する', async () => {
		const store = createInMemorySlugStore({
			entities: {
				project: [
					{ id: 'project-1', slug: 'new-slug' },
					{ id: 'project-2', slug: 'current-slug' },
				],
				person: [],
				composition: [],
				work: [],
				venue: [],
			},
			events: [],
		});

		await expect(
			applySlugReviews(store, {
				schemaVersion: 1,
				sourceCandidateArtifact: 'slug-candidates.json',
				decisions: [],
				redirects: [
					{ entityType: 'project', id: 'project-1', from: 'old-slug', to: 'new-slug' },
					{ entityType: 'project', id: 'project-1', from: 'old-slug', to: 'new-slug' },
				],
			}),
		).rejects.toMatchObject({ code: 'SLUG_REDIRECT_DUPLICATE' });

		await expect(
			applySlugReviews(store, {
				schemaVersion: 1,
				sourceCandidateArtifact: 'slug-candidates.json',
				decisions: [],
				redirects: [
					{ entityType: 'project', id: 'project-1', from: 'old-slug', to: 'new-slug' },
					{ entityType: 'project', id: 'project-2', from: 'new-slug', to: 'current-slug' },
				],
			}),
		).rejects.toMatchObject({ code: 'SLUG_REDIRECT_CHAIN' });
	});
});
