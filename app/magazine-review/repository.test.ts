import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMagazineReviewRepository } from './repository';

const artifact = {
	schemaVersion: 1,
	generatedBy: 'scripts/generate_magazine_review.ts',
	sourceFile: 'rawData/monden-magazine.tsv',
	summary: {
		sourceRows: 1,
		articleCandidates: 1,
		reviewStatuses: { confirmed: 0, inferred: 0, unresolved: 1, not_published: 0 },
		classificationSources: { explicit: 1, inferred: 0, unresolved: 0 },
		parserDiagnostics: [],
	},
	records: [
		{
			sourceKey: 'source-1',
			rawFields: {
				band: 'BN',
				publication: 'Quip',
				issue: 'vol.38',
				publishedDate: '',
				classification: 'I',
				content: 'インタビュー',
			},
			subject: { kind: 'project', name: 'BURGER NUDS' },
			publication: { name: 'Quip', rawName: 'Quip', type: 'print' },
			issue: {
				issueKey: 'issue-1',
				issueNumber: 'vol.38',
				volume: '38',
				publishedDate: null,
				datePrecision: 'none',
				synthetic: false,
			},
			articles: [],
			classificationSource: 'explicit',
			reviewStatus: 'unresolved',
			extracted: { pageReferences: [], urls: [], workCandidates: [], eventDateCandidates: [] },
			diagnostics: ['発売日が空欄です'],
		},
	],
} as const;

describe('magazine review repository', () => {
	test('loads the generated artifact and starts records as pending', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'magazine-review-'));
		const artifactPath = join(directory, 'artifact.json');
		const decisionsPath = join(directory, 'decisions.json');
		await writeFile(artifactPath, JSON.stringify(artifact));
		const repository = createMagazineReviewRepository({ artifactPath, decisionsPath });

		const result = await repository.get();

		expect(result.records).toHaveLength(1);
		expect(result.records[0]?.humanReview.status).toBe('pending');
		expect(result.meta.humanReviewStatuses.pending).toBe(1);
	});

	test('persists a decision separately without changing the generated artifact', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'magazine-review-'));
		const artifactPath = join(directory, 'artifact.json');
		const decisionsPath = join(directory, 'decisions.json');
		const original = JSON.stringify(artifact);
		await writeFile(artifactPath, original);
		const repository = createMagazineReviewRepository({ artifactPath, decisionsPath });

		await repository.saveDecision('source-1', {
			status: 'needs_changes',
			notes: '発売日を現物で確認する',
		});

		expect(await readFile(artifactPath, 'utf8')).toBe(original);
		const saved = JSON.parse(await readFile(decisionsPath, 'utf8'));
		expect(saved.decisions['source-1']).toMatchObject({
			status: 'needs_changes',
			notes: '発売日を現物で確認する',
		});
	});

	test('rejects decisions for unknown source keys', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'magazine-review-'));
		const artifactPath = join(directory, 'artifact.json');
		await writeFile(artifactPath, JSON.stringify(artifact));
		const repository = createMagazineReviewRepository({
			artifactPath,
			decisionsPath: join(directory, 'decisions.json'),
		});

		expect(repository.saveDecision('missing', { status: 'approved', notes: '' })).rejects.toThrow('Magazine review record was not found');
	});
});
