import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSlugReviewRepository } from './repository';

const candidateArtifact = {
	schemaVersion: 1,
	generatedBy: 'scripts/generate_slug_candidates.ts',
	sourceSnapshot: 'db-test',
	entityTypes: ['project', 'person', 'composition', 'work', 'venue'],
	summary: { total: 3, proposed: 1, preserved: 0, needsReview: 2, collisions: 0, unresolved: 2 },
	records: [
		{
			entityType: 'project',
			id: 'project-1',
			displayName: '門田匡陽',
			existingSlug: null,
			candidateSlug: null,
			basis: { method: 'unconvertible', source: 'display-name' },
			status: 'needs_review',
			diagnostics: [{ code: 'untransliterated-characters', message: '読みを確認してください', characters: '門田匡陽' }],
			collision: null,
		},
		{
			entityType: 'person',
			id: 'person-1',
			displayName: 'John Doe',
			existingSlug: null,
			candidateSlug: 'john-doe',
			basis: { method: 'kebab-case', source: 'display-name' },
			status: 'proposed',
			diagnostics: [],
			collision: null,
		},
		{
			entityType: 'venue',
			id: 'venue-1',
			displayName: '渋谷CLUB',
			existingSlug: null,
			candidateSlug: null,
			basis: { method: 'unconvertible', source: 'display-name' },
			status: 'needs_review',
			diagnostics: [{ code: 'empty-candidate', message: '候補が空です' }],
			collision: null,
		},
	],
} as const;

async function repositoryFixture() {
	const directory = await mkdtemp(join(tmpdir(), 'slug-review-'));
	const candidatePath = join(directory, 'slug-candidates.json');
	const decisionsPath = join(directory, 'slug-reviews.json');
	await writeFile(candidatePath, JSON.stringify(candidateArtifact));
	return { directory, candidatePath, decisionsPath };
}

describe('slug review repository', () => {
	test('loads candidates with pending human review state', async () => {
		const paths = await repositoryFixture();
		const repository = createSlugReviewRepository(paths);

		const result = await repository.get();

		expect(result.records).toHaveLength(3);
		expect(result.records[0]?.review).toEqual({ status: 'pending', slug: null });
		expect(result.records[1]?.review).toEqual({ status: 'pending', slug: 'john-doe' });
		expect(result.meta.reviewStatuses).toEqual({ pending: 3, approved: 0, rejected: 0 });
	});

	test('persists decisions separately and returns an apply-compatible artifact', async () => {
		const paths = await repositoryFixture();
		const originalCandidates = await readFile(paths.candidatePath, 'utf8');
		const repository = createSlugReviewRepository({ ...paths, sourceCandidateArtifact: 'slug-candidates.json' });

		await repository.saveDecision('project', 'project-1', { status: 'approved', slug: 'kadota-masaharu' });

		expect(await readFile(paths.candidatePath, 'utf8')).toBe(originalCandidates);
		expect((await repository.get()).records[0]?.review.status).toBe('approved');
		expect(await repository.getArtifact()).toEqual({
			schemaVersion: 1,
			sourceCandidateArtifact: 'slug-candidates.json',
			decisions: [{ entityType: 'project', id: 'project-1', status: 'approved', slug: 'kadota-masaharu' }],
		});
	});

	test('rejects unknown candidates and invalid approved slugs', async () => {
		const paths = await repositoryFixture();
		const repository = createSlugReviewRepository(paths);

		await expect(repository.saveDecision('project', 'missing', { status: 'rejected', slug: null })).rejects.toThrow('Slug review record was not found');
		await expect(repository.saveDecision('project', 'project-1', { status: 'approved', slug: 'Bad Slug' })).rejects.toThrow('Approved slug is invalid');
	});
});
