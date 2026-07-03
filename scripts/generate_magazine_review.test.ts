import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildMagazineReviewArtifact, parseArgs } from './generate_magazine_review';

const ROOT = join(import.meta.dir, '..');

describe('generate_magazine_review', () => {
	test('builds a deterministic review artifact whose status totals cover every source row', async () => {
		const source = await readFile(join(ROOT, 'rawData', 'monden-magazine.tsv'), 'utf8');
		const first = buildMagazineReviewArtifact(source);
		const second = buildMagazineReviewArtifact(source);

		expect(second).toEqual(first);
		expect(first.summary.sourceRows).toBe(241);
		expect(Object.values(first.summary.reviewStatuses).reduce((total, count) => total + count, 0)).toBe(241);
		expect(first.summary.articleCandidates).toBeGreaterThanOrEqual(241);
		expect(first.records).toHaveLength(241);
	});

	test('accepts explicit input and output paths', () => {
		expect(parseArgs(['--input', 'source.tsv', '--output', 'review.json'])).toEqual({
			input: 'source.tsv',
			output: 'review.json',
		});
	});
});
