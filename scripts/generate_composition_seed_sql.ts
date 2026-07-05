#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCompositionCredits, type CompositionCreditSource } from './lib/compositionCredits';

type DraftStatus = 'draft' | 'reviewed' | 'merged' | 'split' | 'ignore';

export type CompositionDraft = {
	file: string;
	canonicalTitle: string;
	status: DraftStatus;
	compositionId: string | null;
	aliases: string[];
	sourceCount: number;
	releaseCount: number;
	liveCount: number;
	sources: CompositionCreditSource[];
};

type ParsedArgs = {
	output: string;
	sourceDir: string;
	statuses: DraftStatus[];
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_SOURCE_DIR = join(ROOT, 'drafts', 'compositions');
const DEFAULT_OUTPUT = join(ROOT, 'sql', 'composition_seed.sql');
const STATUSES = new Set<DraftStatus>(['draft', 'reviewed', 'merged', 'split', 'ignore']);

function parseArgs(argv: string[]): ParsedArgs {
	let output = DEFAULT_OUTPUT;
	let sourceDir = DEFAULT_SOURCE_DIR;
	let statuses: DraftStatus[] = ['reviewed'];

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--output') {
			output = resolve(argv[++i] ?? DEFAULT_OUTPUT);
			continue;
		}
		if (arg === '--source-dir') {
			sourceDir = resolve(argv[++i] ?? DEFAULT_SOURCE_DIR);
			continue;
		}
		if (arg === '--statuses') {
			const collected: DraftStatus[] = [];
			while (argv[i + 1] && !argv[i + 1]!.startsWith('--')) {
				const status = argv[++i] as DraftStatus;
				if (!STATUSES.has(status)) throw new Error(`Unsupported status: ${status}`);
				collected.push(status);
			}
			statuses = collected.length > 0 ? collected : statuses;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return { output, sourceDir, statuses };
}

function parseYamlScalar(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed === 'null' || trimmed === '~' || trimmed === '') return null;
	if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return trimmed.slice(1, -1);
		}
	}
	return trimmed;
}

function parseFrontMatter(markdown: string): string {
	const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
	if (!match) throw new Error('missing front matter');
	return match[1]!;
}

function extractField(frontMatter: string, key: string): string | null {
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = frontMatter.match(new RegExp(`^${escaped}:\\s*(.*)$`, 'm'));
	return match ? parseYamlScalar(match[1]!) : null;
}

function extractBlock(frontMatter: string, key: string): string {
	const lines = frontMatter.split(/\r?\n/);
	const start = lines.findIndex((line) => line.trim() === `${key}:`);
	if (start < 0) return '';

	const block: string[] = [];
	for (const line of lines.slice(start + 1)) {
		if (/^[A-Za-z_][A-Za-z0-9_]*:/.test(line)) break;
		block.push(line);
	}

	return block.join('\n').replace(/\s+$/u, '');
}

function extractAliases(frontMatter: string): string[] {
	return extractBlock(frontMatter, 'aliases')
		.split(/\r?\n/)
		.map((line) => line.match(/^\s*-\s*(.+?)\s*$/)?.[1])
		.filter((value): value is string => Boolean(value))
		.map((value) => parseYamlScalar(value))
		.filter((value): value is string => Boolean(value));
}

function countSources(sourcesYaml: string): {
	sourceCount: number;
	releaseCount: number;
	liveCount: number;
} {
	const sourceCount = (sourcesYaml.match(/^\s*-\s*$/gm) ?? []).length;
	const releaseCount = (sourcesYaml.match(/^\s*type:\s*release\s*$/gm) ?? []).length;
	const liveCount = (sourcesYaml.match(/^\s*type:\s*live\s*$/gm) ?? []).length;
	return { sourceCount, releaseCount, liveCount };
}

function sourceEntries(sourcesYaml: string): string[] {
	const entries: string[] = [];
	let current: string[] = [];

	for (const line of sourcesYaml.split(/\r?\n/)) {
		if (/^\s*-\s+type:\s*/.test(line)) {
			if (current.length > 0) entries.push(current.join('\n'));
			current = [line];
			continue;
		}
		if (current.length > 0) current.push(line);
	}

	if (current.length > 0) entries.push(current.join('\n'));
	return entries;
}

function extractSourceField(sourceEntry: string, key: string): string | null {
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = sourceEntry.match(new RegExp(`^\\s*(?:-\\s*)?${escaped}:\\s*(.*)$`, 'm'));
	return match ? parseYamlScalar(match[1]!) : null;
}

function extractSources(sourcesYaml: string): CompositionCreditSource[] {
	return sourceEntries(sourcesYaml)
		.map((entry) => {
			const type = extractSourceField(entry, 'type');
			const file = extractSourceField(entry, 'file');
			if ((type !== 'release' && type !== 'live') || !file) return null;
			return {
				type,
				file,
				project: extractSourceField(entry, 'project'),
				date: extractSourceField(entry, 'date'),
			} satisfies CompositionCreditSource;
		})
		.filter((source): source is CompositionCreditSource => source !== null);
}

async function readDrafts(sourceDir: string): Promise<CompositionDraft[]> {
	const entries = await readdir(sourceDir, { withFileTypes: true });
	const drafts: CompositionDraft[] = [];

	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'README.md') continue;
		const markdown = await readFile(join(sourceDir, entry.name), 'utf8');
		const frontMatter = parseFrontMatter(markdown);
		const status = extractField(frontMatter, 'status') ?? 'draft';
		if (!STATUSES.has(status as DraftStatus)) {
			throw new Error(`unsupported status in ${entry.name}: ${status}`);
		}

		const sourcesYaml = extractBlock(frontMatter, 'sources');
		drafts.push({
			file: entry.name,
			canonicalTitle: extractField(frontMatter, 'canonical_title') ?? basename(entry.name, extname(entry.name)),
			status: status as DraftStatus,
			compositionId: extractField(frontMatter, 'composition_id'),
			aliases: extractAliases(frontMatter),
			...countSources(sourcesYaml),
			sources: extractSources(sourcesYaml),
		});
	}

	return drafts.sort((a, b) => {
		const titleDiff = a.canonicalTitle.localeCompare(b.canonicalTitle, 'ja');
		return titleDiff !== 0 ? titleDiff : a.file.localeCompare(b.file, 'ja');
	});
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

function descriptionFor(draft: CompositionDraft): string | null {
	const aliases = draft.aliases.filter((alias) => alias !== draft.canonicalTitle);
	const draftFiles = draft.file.split('\n');
	const lines = [
		`${draftFiles.length === 1 ? 'draft_file' : 'draft_files'}=${draftFiles.join(' / ')}`,
		`source_count=${draft.sourceCount}`,
		`release_count=${draft.releaseCount}`,
		`live_count=${draft.liveCount}`,
	];
	if (aliases.length > 0) lines.push(`aliases=${aliases.join(' / ')}`);
	return lines.join('\n');
}

function mergeDrafts(drafts: CompositionDraft[]): CompositionDraft[] {
	const merged = new Map<string, CompositionDraft>();

	for (const draft of drafts) {
		const compositionId = draft.compositionId ?? stableUuid('composition', draft.canonicalTitle);
		const current = merged.get(compositionId);
		if (!current) {
			merged.set(compositionId, { ...draft, aliases: [...draft.aliases], sources: [...draft.sources] });
			continue;
		}

		current.file = `${current.file}\n${draft.file}`;
		current.aliases = [...new Set([...current.aliases, ...draft.aliases])];
		current.sourceCount += draft.sourceCount;
		current.releaseCount += draft.releaseCount;
		current.liveCount += draft.liveCount;
		current.sources.push(...draft.sources);
	}

	return [...merged.values()];
}

export function renderSql(drafts: CompositionDraft[], statuses: DraftStatus[]): string {
	const selected = mergeDrafts(drafts.filter((draft) => statuses.includes(draft.status)));
	const lines: string[] = [];
	let creditCount = 0;

	lines.push('-- Generated by scripts/generate_composition_seed_sql.ts');
	lines.push(`-- statuses: ${statuses.join(', ')}`);
	lines.push(`-- compositions: ${selected.length}`);
	lines.push('BEGIN;');
	lines.push('');

	for (const draft of selected) {
		const compositionId = draft.compositionId ?? stableUuid('composition', draft.canonicalTitle);
		for (const file of draft.file.split('\n')) lines.push(`-- source: drafts/compositions/${file}`);
		lines.push('INSERT INTO composition (id, title, description)');
		lines.push(`VALUES (${sqlText(compositionId)}, ${sqlText(draft.canonicalTitle)}, ${sqlText(descriptionFor(draft))})`);
		lines.push('ON CONFLICT (id) DO UPDATE');
		lines.push('SET title = EXCLUDED.title,');
		lines.push('    description = EXCLUDED.description;');
		lines.push('');

		const credits = resolveCompositionCredits(draft.canonicalTitle, draft.sources);
		lines.push(`DELETE FROM composition_credit WHERE composition_id = ${sqlText(compositionId)};`);
		lines.push('');
		for (const creditType of ['composer', 'lyricist'] as const) {
			for (const [index, personName] of credits[creditType].entries()) {
				const creditId = stableUuid('composition_credit', `${compositionId}:${creditType}:${personName}`);
				const personId = stableUuid('person', personName);
				lines.push('INSERT INTO composition_credit (id, composition_id, person_id, credit_type, order_index)');
				lines.push(`VALUES (${sqlText(creditId)}, ${sqlText(compositionId)}, ${sqlText(personId)}, ${sqlText(creditType)}, ${index + 1});`);
				lines.push('');
				creditCount += 1;
			}
		}
	}

	lines.push(`-- composition_credits: ${creditCount}`);
	lines.push('COMMIT;');
	lines.push('');
	return lines.join('\n');
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	const drafts = await readDrafts(args.sourceDir);
	const sql = renderSql(drafts, args.statuses);
	await mkdir(dirname(args.output), { recursive: true });
	await writeFile(args.output, sql, 'utf8');

	const counts = Object.fromEntries([...STATUSES].map((status) => [status, drafts.filter((draft) => draft.status === status).length]));
	console.log(`Wrote ${args.output}`);
	console.log(`Status counts: ${JSON.stringify(counts)}`);
}

if (import.meta.main) await main();
