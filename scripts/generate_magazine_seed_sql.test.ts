import { describe, expect, test } from 'bun:test';
import type { MagazineReviewArtifact } from './generate_magazine_review';
import { buildMagazineSeedRows, parseArgs, renderSql } from './generate_magazine_seed_sql';

const baseRecord: MagazineReviewArtifact['records'][number] = {
	sourceKey: 'source-approved',
	rawFields: {
		band: 'BN',
		publication: 'Quip',
		issue: 'vol.38',
		publishedDate: '2005/04/01',
		classification: 'I',
		content: "Interview's quoted content",
	},
	subject: { kind: 'project', name: 'BURGER NUDS' },
	publication: { name: 'Quip', rawName: 'Quip', type: 'print' },
	issue: {
		issueKey: 'issue-approved',
		issueNumber: 'vol.38',
		volume: '38',
		publishedDate: '2005-04-01',
		datePrecision: 'day',
		synthetic: false,
	},
	articles: [
		{
			articleKey: 'article-approved',
			title: 'BURGER NUDS掲載（インタビュー）',
			type: 'interview',
			candidateTypes: ['interview'],
			content: "Interview's quoted content",
			classificationSource: 'explicit',
			reviewStatus: 'confirmed',
			diagnostics: [],
		},
	],
	classificationSource: 'explicit',
	reviewStatus: 'confirmed',
	extracted: {
		pageReferences: ['p.1'],
		urls: [],
		workCandidates: [],
		eventDateCandidates: [],
	},
	diagnostics: [],
};

function artifact(records: MagazineReviewArtifact['records']): MagazineReviewArtifact {
	return {
		schemaVersion: 1,
		generatedBy: 'scripts/generate_magazine_review.ts',
		sourceFile: 'rawData/monden-magazine.tsv',
		summary: {
			sourceRows: records.length,
			articleCandidates: records.reduce((total, record) => total + record.articles.length, 0),
			reviewStatuses: { confirmed: 0, inferred: 0, unresolved: 0, not_published: 0 },
			classificationSources: { explicit: 0, inferred: 0, unresolved: 0 },
			parserDiagnostics: [],
		},
		records,
	};
}

describe('generate_magazine_seed_sql', () => {
	test('builds rows only from approved review decisions', () => {
		const rows = buildMagazineSeedRows(
			artifact([
				baseRecord,
				{
					...baseRecord,
					sourceKey: 'source-needs-changes',
					issue: { ...baseRecord.issue, issueKey: 'issue-needs-changes' },
					articles: [{ ...baseRecord.articles[0]!, articleKey: 'article-needs-changes' }],
				},
			]),
			{
				schemaVersion: 1,
				decisions: {
					'source-approved': {
						sourceKey: 'source-approved',
						status: 'approved',
						notes: '',
						updatedAt: '2026-07-06T12:46:42.004Z',
					},
					'source-needs-changes': {
						sourceKey: 'source-needs-changes',
						status: 'needs_changes',
						notes: '要確認',
						updatedAt: '2026-07-06T12:47:07.015Z',
					},
				},
			},
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			publicationName: 'Quip',
			issueNumber: 'vol.38',
			articleTitle: 'BURGER NUDS掲載（インタビュー）',
			articleType: 'interview',
			publishedDate: '2005-04-01',
			content: "Interview's quoted content",
		});
		expect(rows[0]!.summary).toContain('source_key=source-approved');
		expect(rows[0]!.summary).toContain('review_updated_at=2026-07-06T12:46:42.004Z');
	});

	test('renders idempotent upsert SQL with escaped text', () => {
		const sql = renderSql([
			{
				record: baseRecord,
				decision: {
					sourceKey: 'source-approved',
					status: 'approved',
					notes: '',
					updatedAt: '2026-07-06T12:46:42.004Z',
				},
				article: baseRecord.articles[0]!,
				publicationName: 'Quip',
				publicationType: 'print',
				issueNumber: 'vol.38',
				volume: '38',
				publishedDate: '2005-04-01',
				issueDescription: 'source_key=source-approved',
				articleTitle: 'BURGER NUDS掲載（インタビュー）',
				articleType: 'interview',
				summary: "source_key=source-approved\nraw_content=Interview's quoted content",
				content: "Interview's quoted content",
				url: null,
			},
		]);

		expect(sql).toContain('-- approved_records: 1');
		expect(sql).toContain('INSERT INTO publication');
		expect(sql).toContain('INSERT INTO publication_issue');
		expect(sql).toContain('INSERT INTO article');
		expect(sql).toContain("Interview''s quoted content");
		expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
	});

	test('accepts explicit artifact, decisions, and output paths', () => {
		expect(parseArgs(['--artifact', 'review.json', '--decisions', 'decisions.json', '--output', 'magazine.sql'])).toEqual({
			artifact: 'review.json',
			decisions: 'decisions.json',
			output: 'magazine.sql',
		});
	});
});
