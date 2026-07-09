#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MagazineReviewArtifact } from './generate_magazine_review';
import type { MagazineReviewDecision } from '../app/magazine-review/types';

type ParsedArgs = {
	artifact: string;
	decisions: string;
	output: string;
};

export type MagazineReviewDecisionsArtifact = {
	schemaVersion: 1;
	decisions: Record<string, MagazineReviewDecision>;
};

type MagazineReviewRecord = MagazineReviewArtifact['records'][number];
type MagazineReviewArticle = MagazineReviewRecord['articles'][number];

export type MagazineSeedRow = {
	record: MagazineReviewRecord;
	decision: MagazineReviewDecision;
	article: MagazineReviewArticle;
	publicationName: string;
	publicationType: string;
	issueNumber: string | null;
	volume: string | null;
	publishedDate: string | null;
	issueDescription: string | null;
	articleTitle: string;
	articleType: string;
	summary: string | null;
	content: string | null;
	url: string | null;
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_ARTIFACT = join(ROOT, 'drafts', 'magazines', 'monden-magazine.json');
const DEFAULT_DECISIONS = join(ROOT, 'drafts', 'magazines', 'monden-magazine-decisions.json');
const DEFAULT_OUTPUT = join(ROOT, 'sql', 'magazine_seed.sql');

export function parseArgs(argv: string[]): ParsedArgs {
	let artifact = DEFAULT_ARTIFACT;
	let decisions = DEFAULT_DECISIONS;
	let output = DEFAULT_OUTPUT;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--artifact' && argv[index + 1]) {
			artifact = argv[++index]!;
			continue;
		}
		if (arg === '--decisions' && argv[index + 1]) {
			decisions = argv[++index]!;
			continue;
		}
		if (arg === '--output' && argv[index + 1]) {
			output = argv[++index]!;
			continue;
		}
		throw new Error(`Unknown or incomplete argument: ${arg}`);
	}

	return { artifact, decisions, output };
}

function stableUuid(namespace: string, value: string): string {
	const hash = createHash('sha1').update(`mondenDatabase/${namespace}/${value}`).digest('hex');
	const chars = hash.slice(0, 32).split('');
	chars[12] = '5';
	const variant = Number.parseInt(chars[16]!, 16);
	chars[16] = ((variant & 0x3) | 0x8).toString(16);
	return [chars.slice(0, 8).join(''), chars.slice(8, 12).join(''), chars.slice(12, 16).join(''), chars.slice(16, 20).join(''), chars.slice(20, 32).join('')].join('-');
}

function sqlText(value: string | null): string {
	if (value == null) return 'NULL';
	return `'${value.replaceAll("'", "''")}'`;
}

function compactText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function notesFor(record: MagazineReviewRecord, decision: MagazineReviewDecision, article: MagazineReviewArticle): string {
	return [
		`source_key=${record.sourceKey}`,
		`article_key=${article.articleKey}`,
		`review_status=${decision.status}`,
		`review_updated_at=${decision.updatedAt}`,
		`subject=${record.subject.name ?? record.rawFields.band}`,
		`raw_band=${record.rawFields.band}`,
		`raw_publication=${record.rawFields.publication}`,
		`raw_issue=${record.rawFields.issue}`,
		`raw_published_date=${record.rawFields.publishedDate}`,
		`raw_classification=${record.rawFields.classification}`,
		decision.notes ? `review_notes=${compactText(decision.notes)}` : null,
		record.extracted.pageReferences.length > 0 ? `page_references=${record.extracted.pageReferences.join(', ')}` : null,
		record.extracted.workCandidates.length > 0 ? `work_candidates=${record.extracted.workCandidates.join(', ')}` : null,
		record.extracted.eventDateCandidates.length > 0 ? `event_date_candidates=${record.extracted.eventDateCandidates.join(', ')}` : null,
		record.diagnostics.length > 0 ? `record_diagnostics=${record.diagnostics.join(' / ')}` : null,
		article.diagnostics.length > 0 ? `article_diagnostics=${article.diagnostics.join(' / ')}` : null,
	]
		.filter((value): value is string => value != null && value.length > 0)
		.join('\n');
}

function issueDescriptionFor(record: MagazineReviewRecord): string {
	return [
		`source_key=${record.sourceKey}`,
		`date_precision=${record.issue.datePrecision}`,
		record.issue.synthetic ? 'synthetic_issue=true' : null,
		record.rawFields.content ? `raw_content=${compactText(record.rawFields.content)}` : null,
	]
		.filter((value): value is string => value != null && value.length > 0)
		.join('\n');
}

function articleTitleFor(record: MagazineReviewRecord, article: MagazineReviewArticle): string {
	const title = compactText(article.title);
	if (title) return title;
	const subject = record.subject.name ?? record.rawFields.band;
	return `${subject}掲載`;
}

function articleTypeFor(article: MagazineReviewArticle): string {
	return article.type ?? article.candidateTypes[0] ?? 'magazine_article';
}

export function buildMagazineSeedRows(artifact: MagazineReviewArtifact, decisionsArtifact: MagazineReviewDecisionsArtifact): MagazineSeedRow[] {
	const rows: MagazineSeedRow[] = [];
	const recordsBySourceKey = new Map(artifact.records.map((record) => [record.sourceKey, record]));

	for (const decision of Object.values(decisionsArtifact.decisions)) {
		if (decision.status !== 'approved') continue;
		const record = recordsBySourceKey.get(decision.sourceKey);
		if (!record) throw new Error(`Approved decision has no review record: ${decision.sourceKey}`);

		for (const article of record.articles) {
			rows.push({
				record,
				decision,
				article,
				publicationName: record.publication.name,
				publicationType: record.publication.type,
				issueNumber: record.issue.issueNumber,
				volume: record.issue.volume,
				publishedDate: record.issue.publishedDate,
				issueDescription: issueDescriptionFor(record),
				articleTitle: articleTitleFor(record, article),
				articleType: articleTypeFor(article),
				summary: notesFor(record, decision, article),
				content: article.content || record.rawFields.content || null,
				url: record.extracted.urls[0] ?? null,
			});
		}
	}

	return rows;
}

class SqlBuilder {
	readonly lines: string[] = [];

	line(value = ''): void {
		this.lines.push(value);
	}

	publicationUpsert(row: MagazineSeedRow): string {
		const id = stableUuid('publication', row.publicationName);
		this.line('INSERT INTO publication (id, name, type, publisher, description)');
		this.line(`VALUES (${sqlText(id)}, ${sqlText(row.publicationName)}, ${sqlText(row.publicationType)}, NULL, NULL)`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET name = EXCLUDED.name,');
		this.line('    type = EXCLUDED.type;');
		this.line();
		return id;
	}

	issueUpsert(row: MagazineSeedRow, publicationId: string): string {
		const id = stableUuid('publication_issue', row.record.issue.issueKey);
		this.line('INSERT INTO publication_issue (id, publication_id, issue_number, volume, published_date, description)');
		this.line(`VALUES (${sqlText(id)}, ${sqlText(publicationId)}, ${sqlText(row.issueNumber)}, ${sqlText(row.volume)}, ${sqlText(row.publishedDate)}, ${sqlText(row.issueDescription)})`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET publication_id = EXCLUDED.publication_id,');
		this.line('    issue_number = EXCLUDED.issue_number,');
		this.line('    volume = EXCLUDED.volume,');
		this.line('    published_date = EXCLUDED.published_date,');
		this.line('    description = EXCLUDED.description;');
		this.line();
		return id;
	}

	articleUpsert(row: MagazineSeedRow, issueId: string): void {
		const id = stableUuid('article', row.article.articleKey);
		this.line('INSERT INTO article (id, publication_issue_id, title, type, published_date, summary, content, url)');
		this.line(
			`VALUES (${sqlText(id)}, ${sqlText(issueId)}, ${sqlText(row.articleTitle)}, ${sqlText(row.articleType)}, ${sqlText(row.publishedDate)}, ${sqlText(row.summary)}, ${sqlText(row.content)}, ${sqlText(row.url)})`,
		);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET publication_issue_id = EXCLUDED.publication_issue_id,');
		this.line('    title = EXCLUDED.title,');
		this.line('    type = EXCLUDED.type,');
		this.line('    published_date = EXCLUDED.published_date,');
		this.line('    summary = EXCLUDED.summary,');
		this.line('    content = EXCLUDED.content,');
		this.line('    url = EXCLUDED.url,');
		this.line('    updated_at = CURRENT_TIMESTAMP;');
		this.line();
	}
}

export function renderSql(rows: MagazineSeedRow[]): string {
	const builder = new SqlBuilder();
	const publicationIds = new Map<string, string>();
	const issueIds = new Map<string, string>();

	builder.line('-- Generated by scripts/generate_magazine_seed_sql.ts');
	builder.line(`-- approved_records: ${new Set(rows.map((row) => row.record.sourceKey)).size}`);
	builder.line(`-- approved_articles: ${rows.length}`);
	builder.line('BEGIN;');
	builder.line();

	for (const row of rows) {
		builder.line(`-- source_key: ${row.record.sourceKey}`);
		builder.line(`-- publication: ${row.publicationName}`);
		builder.line();

		let publicationId = publicationIds.get(row.publicationName);
		if (!publicationId) {
			publicationId = builder.publicationUpsert(row);
			publicationIds.set(row.publicationName, publicationId);
		}

		let issueId = issueIds.get(row.record.issue.issueKey);
		if (!issueId) {
			issueId = builder.issueUpsert(row, publicationId);
			issueIds.set(row.record.issue.issueKey, issueId);
		}

		builder.articleUpsert(row, issueId);
	}

	builder.line('COMMIT;');
	builder.line();
	return builder.lines.join('\n');
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	const artifact = JSON.parse(await readFile(resolve(args.artifact), 'utf8')) as MagazineReviewArtifact;
	const decisions = JSON.parse(await readFile(resolve(args.decisions), 'utf8')) as MagazineReviewDecisionsArtifact;
	const rows = buildMagazineSeedRows(artifact, decisions);
	const sql = renderSql(rows);

	await mkdir(dirname(resolve(args.output)), { recursive: true });
	await writeFile(resolve(args.output), sql, 'utf8');

	console.log(`Wrote ${resolve(args.output)}`);
	console.log(`Approved records: ${new Set(rows.map((row) => row.record.sourceKey)).size}`);
	console.log(`Approved articles: ${rows.length}`);
}

if (import.meta.main) {
	await main();
}
