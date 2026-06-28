#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type SourceKind = 'release' | 'live';

type SourceArticle = {
	kind: SourceKind;
	path: string;
	name: string;
	title: string;
	date: string | null;
	tags: string[];
	body: string;
};

type SongOccurrence = {
	sourceKind: SourceKind;
	sourceFile: string;
	sourceTitle: string;
	sourceDate: string | null;
	projectName: string | null;
	section: string;
	position: number;
	rawTitle: string;
	cleanedTitle: string;
};

type SongDraft = {
	groupKey: string;
	canonicalTitle: string;
	aliases: Set<string>;
	sources: SongOccurrence[];
};

type ParsedArgs = {
	releaseDir: string;
	liveDir: string;
	outputDir: string;
	overwrite: boolean;
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_RELEASE_DIR = join(ROOT, 'rawData', 'articles_by_category', 'release');
const DEFAULT_LIVE_DIR = join(ROOT, 'rawData', 'articles_by_category', 'Live');
const DEFAULT_OUTPUT_DIR = join(ROOT, 'drafts', 'compositions');

function parseArgs(argv: string[]): ParsedArgs {
	const args: ParsedArgs = {
		releaseDir: DEFAULT_RELEASE_DIR,
		liveDir: DEFAULT_LIVE_DIR,
		outputDir: DEFAULT_OUTPUT_DIR,
		overwrite: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];

		if (arg === '--release-dir' && next) {
			args.releaseDir = resolve(next);
			index += 1;
			continue;
		}

		if (arg === '--live-dir' && next) {
			args.liveDir = resolve(next);
			index += 1;
			continue;
		}

		if (arg === '--output' && next) {
			args.outputDir = resolve(next);
			index += 1;
			continue;
		}

		if (arg === '--overwrite') {
			args.overwrite = true;
			continue;
		}

		throw new Error(`Unknown or incomplete argument: ${arg}`);
	}

	return args;
}

function parseScalar(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length >= 2 && ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"')))) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function parseFrontMatter(text: string): { meta: Record<string, string | string[]>; body: string } {
	const lines = text.split(/\r?\n/);
	if (lines[0]?.trim() !== '---') {
		throw new Error('missing front matter');
	}

	const meta: Record<string, string | string[]> = {};
	const tags: string[] = [];
	let index = 1;

	while (index < lines.length) {
		const line = lines[index];
		if (line === undefined) break;
		if (line.trim() === '---') {
			index += 1;
			break;
		}

		if (line.startsWith('tags:')) {
			index += 1;
			while (index < lines.length && lines[index]!.startsWith('  - ')) {
				tags.push(parseScalar(lines[index]!.slice(4)));
				index += 1;
			}
			meta.tags = tags;
			continue;
		}

		const colonIndex = line.indexOf(':');
		if (colonIndex >= 0) {
			const key = line.slice(0, colonIndex).trim();
			meta[key] = parseScalar(line.slice(colonIndex + 1));
		}
		index += 1;
	}

	return {
		meta,
		body: lines.slice(index).join('\n').trim(),
	};
}

async function loadSources(kind: SourceKind, sourceDir: string): Promise<SourceArticle[]> {
	const entries = await readdir(sourceDir, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.'))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));

	const sources: SourceArticle[] = [];
	for (const file of files) {
		const path = join(sourceDir, file);
		const raw = await readFile(path, 'utf8');
		const { meta, body } = parseFrontMatter(raw);
		sources.push({
			kind,
			path,
			name: file,
			title: String(meta.title ?? basename(file, extname(file))),
			date: String(meta.date ?? '').slice(0, 10) || null,
			tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
			body,
		});
	}

	return sources;
}

function parseSections(body: string): Record<string, string> {
	const sections: Record<string, string[]> = { _root: [] };
	let current = '_root';

	for (const line of body.split(/\r?\n/)) {
		const heading = line.trim().match(/^##\s+(.+)$/);
		if (heading) {
			current = heading[1]!.trim();
			sections[current] ??= [];
			continue;
		}

		sections[current] ??= [];
		sections[current]!.push(line);
	}

	return Object.fromEntries(Object.entries(sections).map(([name, lines]) => [name, lines.join('\n').trim()]));
}

function stripMarkdown(value: string): string {
	return value
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\[\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/~~([^~]+)~~/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\(\([^)]+\)\)/g, ' ')
		.replace(/^\s*[-*]\s*/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanTitle(value: string): string {
	return stripMarkdown(value)
		.replace(/\s+【[^】]+のみ収録】$/u, '')
		.replace(/\s+\(bonus track\)$/i, '')
		.trim();
}

function groupTitle(value: string): string {
	return cleanTitle(value)
		.replace(/\s+\/\s+[^/]+$/u, '')
		.replace(/\s+(demo|DEMO)$/u, '')
		.replace(/\s*～\s*/gu, '～')
		.replace(/\s+/g, ' ')
		.trim()
		.toLocaleLowerCase('ja-JP');
}

function isIgnorableTitle(value: string): boolean {
	const normalized = cleanTitle(value).toLocaleLowerCase('ja-JP');
	return normalized.length === 0 || normalized === '不明' || normalized === 'unknown' || normalized === 'se' || normalized === '【encore break】' || normalized === 'encore break';
}

function parseListItems(section: string): Array<{ position: number; rawTitle: string }> {
	const items: Array<{ position: number; rawTitle: string }> = [];

	for (const rawLine of section.split(/\r?\n/)) {
		const line = rawLine.trimEnd();
		const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
		const bullet = line.match(/^[-*]\s+(.+)$/);

		if (!ordered && !bullet) continue;

		const rawTitle = (ordered?.[2] ?? bullet?.[1] ?? '').trim();
		if (isIgnorableTitle(rawTitle)) continue;

		items.push({
			position: items.length + 1,
			rawTitle,
		});
	}

	return items;
}

function extractOccurrences(source: SourceArticle): SongOccurrence[] {
	const sections = parseSections(source.body);
	const sectionEntries = Object.entries(sections).filter(([sectionName]) => {
		if (source.kind === 'release') {
			return sectionName === '収録曲' || sectionName === '曲リスト';
		}
		return sectionName.startsWith('セットリスト');
	});

	const occurrences: SongOccurrence[] = [];
	for (const [section, content] of sectionEntries) {
		for (const item of parseListItems(content)) {
			occurrences.push({
				sourceKind: source.kind,
				sourceFile: source.name,
				sourceTitle: source.title,
				sourceDate: source.date,
				projectName: source.tags[1] ?? null,
				section,
				position: item.position,
				rawTitle: item.rawTitle,
				cleanedTitle: cleanTitle(item.rawTitle),
			});
		}
	}

	return occurrences;
}

function buildDrafts(occurrences: SongOccurrence[]): SongDraft[] {
	const draftsByKey = new Map<string, SongDraft>();

	for (const occurrence of occurrences) {
		const key = groupTitle(occurrence.cleanedTitle);
		if (!key) continue;

		const draft = draftsByKey.get(key) ?? {
			groupKey: key,
			canonicalTitle: occurrence.cleanedTitle,
			aliases: new Set<string>(),
			sources: [],
		};

		draft.aliases.add(occurrence.cleanedTitle);
		draft.sources.push(occurrence);
		draftsByKey.set(key, draft);
	}

	for (const draft of draftsByKey.values()) {
		draft.canonicalTitle = chooseCanonicalTitle(draft);
	}

	return [...draftsByKey.values()].sort((a, b) => {
		const countDiff = b.sources.length - a.sources.length;
		return countDiff !== 0 ? countDiff : a.canonicalTitle.localeCompare(b.canonicalTitle);
	});
}

function chooseCanonicalTitle(draft: SongDraft): string {
	const aliases = [...draft.aliases].sort((a, b) => {
		const slashDiff = Number(a.includes(' / ')) - Number(b.includes(' / '));
		if (slashDiff !== 0) return slashDiff;

		const demoDiff = Number(/\bdemo\b/i.test(a)) - Number(/\bdemo\b/i.test(b));
		if (demoDiff !== 0) return demoDiff;

		const lengthDiff = a.length - b.length;
		return lengthDiff !== 0 ? lengthDiff : a.localeCompare(b);
	});

	const exact = aliases.find((alias) => groupTitle(alias) === draft.groupKey && !alias.includes(' / '));
	return exact ?? aliases[0] ?? draft.canonicalTitle;
}

function hash(value: string): string {
	return createHash('sha1').update(value).digest('hex').slice(0, 8);
}

function safeFileName(value: string): string {
	const safe = value
		.replace(/[/:\\?%*"<>|]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/^\.+$/, '_')
		.slice(0, 80);
	return safe || 'untitled';
}

function yamlString(value: string | null): string {
	if (value == null) return 'null';
	return JSON.stringify(value);
}

function renderDraft(draft: SongDraft): string {
	const aliases = [...draft.aliases].sort((a, b) => a.localeCompare(b));
	const lines: string[] = [
		'---',
		'# generated_by: scripts/generate_composition_drafts.ts',
		`canonical_title: ${yamlString(draft.canonicalTitle)}`,
		'status: draft',
		'composition_id: null',
		`group_key: ${yamlString(draft.groupKey)}`,
		'aliases:',
	];

	for (const alias of aliases) {
		lines.push(`  - ${yamlString(alias)}`);
	}

	lines.push('sources:');
	for (const source of draft.sources) {
		lines.push('  -');
		lines.push(`    type: ${source.sourceKind}`);
		lines.push(`    file: ${yamlString(source.sourceFile)}`);
		lines.push(`    title: ${yamlString(source.sourceTitle)}`);
		lines.push(`    date: ${yamlString(source.sourceDate)}`);
		lines.push(`    project: ${yamlString(source.projectName)}`);
		lines.push(`    section: ${yamlString(source.section)}`);
		lines.push(`    position: ${source.position}`);
		lines.push(`    raw_title: ${yamlString(source.rawTitle)}`);
	}

	lines.push('---', '', `# ${draft.canonicalTitle}`, '', '## Review Notes', '', '- ');
	lines.push('');
	return lines.join('\n');
}

function renderIndex(drafts: SongDraft[], releaseCount: number, liveCount: number): string {
	const lines = [
		'# Composition Drafts',
		'',
		'release / live の Markdown に登場する曲名候補を、機械的に正規化してまとめたレビュー用下書きです。',
		'',
		`- release occurrences: ${releaseCount}`,
		`- live occurrences: ${liveCount}`,
		`- draft files: ${drafts.length}`,
		'',
		'## Review Workflow',
		'',
		'1. `sources` が多いファイルから確認する。',
		'2. `canonical_title` を正式な曲名に直す。',
		'3. 同一曲の表記ゆれを `aliases` に残す。',
		'4. 別曲が混ざっていたら、該当 source を別の draft md に分割する。',
		'5. 他の draft と同一曲だったら、片方に `sources` / `aliases` を寄せて、不要側は `status: merged` にする。',
		'6. DB に入れてよい状態になったら `status: reviewed` にする。',
		'',
		'## Status',
		'',
		'| status | meaning |',
		'| --- | --- |',
		'| `draft` | 自動生成直後。未確認。 |',
		'| `reviewed` | 人間確認済み。DB 生成対象。 |',
		'| `merged` | 他の draft に統合済み。DB 生成対象外。 |',
		'| `split` | 別 draft に分割済み。DB 生成対象外。 |',
		'| `ignore` | 曲として扱わない。DB 生成対象外。 |',
		'',
		'## Review Rules',
		'',
		'- `canonical_title` は1曲に1つだけの代表表記にする。',
		'- `aliases` は表記ゆれだけを入れる。別バージョン名や演奏形態を同一曲として扱うかは人間が判断する。',
		'- `sources` は出典なので、基本的には消さない。誤抽出だけ削除する。',
		'- `composition_id` は未定なら `null` のままでよい。後続の SQL 生成時に決める。',
		'- 判断に迷うものは `status: draft` のまま残す。',
		'',
		'| sources | canonical title | file |',
		'| ---: | --- | --- |',
	];

	for (const draft of drafts) {
		const fileName = `${safeFileName(draft.canonicalTitle)}-${hash(draft.groupKey)}.md`;
		lines.push(`| ${draft.sources.length} | ${draft.canonicalTitle.replace(/\|/g, '\\|')} | \`${fileName}\` |`);
	}

	lines.push('');
	return lines.join('\n');
}

async function fileExists(path: string): Promise<boolean> {
	return await Bun.file(path).exists();
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	const [releaseSources, liveSources] = await Promise.all([loadSources('release', args.releaseDir), loadSources('live', args.liveDir)]);

	const releaseOccurrences = releaseSources.flatMap(extractOccurrences);
	const liveOccurrences = liveSources.flatMap(extractOccurrences);
	const drafts = buildDrafts([...releaseOccurrences, ...liveOccurrences]);

	await mkdir(args.outputDir, { recursive: true });
	let written = 0;
	let skipped = 0;

	for (const draft of drafts) {
		const fileName = `${safeFileName(draft.canonicalTitle)}-${hash(draft.groupKey)}.md`;
		const outputPath = join(args.outputDir, fileName);
		if (!args.overwrite && (await fileExists(outputPath))) {
			skipped += 1;
			continue;
		}
		await writeFile(outputPath, renderDraft(draft), 'utf8');
		written += 1;
	}

	await writeFile(join(args.outputDir, 'README.md'), renderIndex(drafts, releaseOccurrences.length, liveOccurrences.length), 'utf8');

	console.log(`release occurrences: ${releaseOccurrences.length}`);
	console.log(`live occurrences: ${liveOccurrences.length}`);
	console.log(`drafts: ${drafts.length}`);
	console.log(`written: ${written}`);
	console.log(`skipped existing: ${skipped}`);
	console.log(`output: ${args.outputDir}`);
}

await main();
