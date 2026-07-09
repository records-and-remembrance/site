#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export type SourceArticle = {
	path: string;
	name: string;
	title: string;
	date: string | null;
	tags: string[];
	body: string;
};

type ParsedArgs = {
	output: string;
	sourceDir: string;
	candidateDir: string;
	files: string[] | null;
};

type MediaSeed = {
	publicationName: string;
	publicationType: string;
	publisher: string | null;
	issueNumber: string | null;
	volume: string | null;
	publishedDate: string | null;
	issueDescription: string | null;
	articleTitle: string;
	articleType: string;
	summary: string | null;
	content: string | null;
	url: string | null;
	notes: string | null;
};

export type ArticleCandidateSeed = {
	candidateFile: string;
	sourceFile: string;
	sourceHeading: string;
	sourceGroup: string | null;
	publicationName: string;
	publicationType: string;
	articleTitle: string;
	articleType: string;
	publishedDate: string | null;
	datePrecision: string | null;
	url: string;
	mentionProject: string | null;
	mentionKind: string | null;
	summary: string | null;
	notes: string | null;
};

type MarkdownNode = {
	type: string;
	value?: string;
	url?: string;
	alt?: string;
	depth?: number;
	children?: MarkdownNode[];
};

type ListItemNode = MarkdownNode & {
	type: 'listItem';
	children: MarkdownNode[];
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_SOURCE_DIR = join(ROOT, 'rawData', 'articles_by_category', 'media');
const DEFAULT_CANDIDATE_DIR = join(ROOT, 'rawData', 'article_candidates');
const DEFAULT_OUTPUT = join(ROOT, 'sql', 'media_seed.sql');
const MARKDOWN_PROCESSOR = unified().use(remarkParse).use(remarkGfm);

const PROGRAM_PATTERNS: Array<{
	pattern: RegExp;
	publication: string;
	publisher: string | null;
	type: string;
}> = [
	{ pattern: /PONTSUKA!!/i, publication: 'PONTSUKA!!', publisher: 'bayfm78', type: 'radio' },
	{
		pattern: /ミュージックスクエア|MUSIC SQUARE/i,
		publication: 'ミュージックスクエア',
		publisher: 'NHK-FM',
		type: 'radio',
	},
	{
		pattern: /Around the MARK'E SONIC STYLE/i,
		publication: "Around the MARK'E SONIC STYLE",
		publisher: 'FM802',
		type: 'radio',
	},
	{ pattern: /MOZAIKU NIGHT/i, publication: 'MOZAIKU NIGHT', publisher: 'bayfm78', type: 'radio' },
	{
		pattern: /Good Time Rolls/i,
		publication: 'Good Time Rolls',
		publisher: 'bayfm78 NEO STREAM NIGHT',
		type: 'radio',
	},
	{
		pattern: /クエスト\s*★\s*クエスト|クエスト★クエスト/i,
		publication: 'クエスト★クエスト Poet-type.Mコーナー',
		publisher: 'FM諫早',
		type: 'radio',
	},
	{
		pattern: /サキドリ!.*ZOOM UP/i,
		publication: 'MUSIC ON! TV サキドリ!～ZOOM UP～',
		publisher: 'MUSIC ON! TV',
		type: 'tv',
	},
	{
		pattern: /festival M\.O\.N -美学の勝利-/i,
		publication: 'festival M.O.N -美学の勝利-',
		publisher: 'MUSIC ON! TV',
		type: 'tv',
	},
	{ pattern: /MUSIC ON! TV/i, publication: 'MUSIC ON! TV', publisher: 'MUSIC ON! TV', type: 'tv' },
];

function parseArgs(argv: string[]): ParsedArgs {
	let output = DEFAULT_OUTPUT;
	let sourceDir = DEFAULT_SOURCE_DIR;
	let candidateDir = DEFAULT_CANDIDATE_DIR;
	let files: string[] | null = null;

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
		if (arg === '--candidate-dir') {
			candidateDir = resolve(argv[++i] ?? DEFAULT_CANDIDATE_DIR);
			continue;
		}
		if (arg === '--files') {
			const collected: string[] = [];
			while (argv[i + 1] && !argv[i + 1]!.startsWith('--')) {
				collected.push(argv[++i]!);
			}
			files = collected;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return { output, sourceDir, candidateDir, files };
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
	if (lines[0]?.trim() !== '---') throw new Error('missing front matter');

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
			meta[line.slice(0, colonIndex).trim()] = parseScalar(line.slice(colonIndex + 1));
		}
		index += 1;
	}

	return { meta, body: lines.slice(index).join('\n').trim() };
}

async function loadSources(sourceDir: string): Promise<SourceArticle[]> {
	const entries = await readdir(sourceDir, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.'))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b, 'ja'));

	const sources: SourceArticle[] = [];
	for (const file of files) {
		const path = join(sourceDir, file);
		const raw = await readFile(path, 'utf8');
		const { meta, body } = parseFrontMatter(raw);
		sources.push({
			path,
			name: file,
			title: cleanText(String(meta.title ?? basename(file, extname(file)))),
			date: String(meta.date ?? '').slice(0, 10) || null,
			tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
			body,
		});
	}
	return sources;
}

async function loadArticleCandidates(candidateDir: string): Promise<ArticleCandidateSeed[]> {
	let files: string[];
	try {
		const entries = await readdir(candidateDir, { withFileTypes: true });
		files = entries
			.filter((entry) => entry.isFile() && entry.name.endsWith('.tsv') && !entry.name.startsWith('.'))
			.map((entry) => entry.name)
			.sort((a, b) => a.localeCompare(b, 'ja'));
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return [];
		throw error;
	}

	const candidates: ArticleCandidateSeed[] = [];
	for (const file of files) {
		const path = join(candidateDir, file);
		candidates.push(...parseApprovedArticleCandidates(await readFile(path, 'utf8'), relativePath(path)));
	}
	return candidates;
}

export function parseApprovedArticleCandidates(source: string, candidateFile: string): ArticleCandidateSeed[] {
	const lines = source
		.replace(/^\uFEFF/u, '')
		.replaceAll('\r\n', '\n')
		.replaceAll('\r', '\n')
		.split('\n')
		.filter((line) => line.trim() && !line.startsWith('#'));
	if (lines.length === 0) return [];

	const header = lines[0]!.split('\t');
	const columnIndex = new Map(header.map((column, index) => [column, index]));
	const requiredColumns = [
		'review_status',
		'source_file',
		'source_heading',
		'publication_name',
		'publication_type',
		'article_title',
		'article_type',
		'url',
	];
	for (const column of requiredColumns) {
		if (!columnIndex.has(column)) throw new Error(`Missing article candidate column: ${column} (${candidateFile})`);
	}

	const valueAt = (columns: string[], name: string): string => {
		const index = columnIndex.get(name);
		return index == null ? '' : (columns[index] ?? '').trim();
	};
	const nullable = (value: string): string | null => value || null;

	return lines.slice(1).flatMap((line, lineIndex) => {
		const columns = line.split('\t');
		if (valueAt(columns, 'review_status') !== 'approved') return [];

		const publicationName = valueAt(columns, 'publication_name');
		const articleTitle = valueAt(columns, 'article_title');
		const url = valueAt(columns, 'url');
		if (!publicationName || !articleTitle || !url) {
			throw new Error(`Approved article candidate is missing required data: ${candidateFile}:${lineIndex + 2}`);
		}

		const sourceFile = valueAt(columns, 'source_file');
		const sourceHeading = valueAt(columns, 'source_heading');
		const sourceGroup = nullable(valueAt(columns, 'source_group'));
		const datePrecision = nullable(valueAt(columns, 'date_precision'));
		const mentionProject = nullable(valueAt(columns, 'mention_project'));
		const mentionKind = nullable(valueAt(columns, 'mention_kind'));
		const rawNotes = nullable(valueAt(columns, 'notes'));
		const metadataNotes = [
			`candidate_file=${candidateFile}`,
			`source_file=${sourceFile}`,
			sourceHeading ? `source_heading=${sourceHeading}` : null,
			sourceGroup ? `source_group=${sourceGroup}` : null,
			mentionProject ? `mention_project=${mentionProject}` : null,
			mentionKind ? `mention_kind=${mentionKind}` : null,
			datePrecision ? `date_precision=${datePrecision}` : null,
			rawNotes ? `candidate_notes=${rawNotes}` : null,
		].filter((value): value is string => value != null);

		return [
			{
				candidateFile,
				sourceFile,
				sourceHeading,
				sourceGroup,
				publicationName,
				publicationType: valueAt(columns, 'publication_type') || 'web',
				articleTitle,
				articleType: valueAt(columns, 'article_type') || 'web_article',
				publishedDate: nullable(valueAt(columns, 'published_date')),
				datePrecision,
				url,
				mentionProject,
				mentionKind,
				summary: nullable(valueAt(columns, 'summary')),
				notes: metadataNotes.join('\n') || null,
			},
		];
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

function relativePath(path: string): string {
	const relative = path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path;
	return relative.replaceAll('\\', '/');
}

function cleanText(value: string): string {
	return value
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\[\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\(\([^)]*\)\)/g, ' ')
		.replace(/^#+\s*/gm, '')
		.replace(/^\s*[-*]\s*/gm, '')
		.replace(/^\s*\d+\.\s*/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function markdownTree(markdown: string): MarkdownNode {
	return MARKDOWN_PROCESSOR.parse(markdown) as MarkdownNode;
}

function plainTextFromNode(node: MarkdownNode, options: { includeLinkUrls?: boolean } = {}): string {
	if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code' || node.type === 'html') return node.value ?? '';
	if (node.type === 'break') return ' ';
	if (node.type === 'image') return options.includeLinkUrls && node.url ? `${node.alt ?? ''} (${node.url})` : (node.alt ?? '');

	const text = (node.children ?? []).map((child) => plainTextFromNode(child, options)).join(' ');
	if (node.type === 'link' && options.includeLinkUrls && node.url) return `${text} (${node.url})`;
	return text;
}

function markdownPlainText(markdown: string, options: { includeLinkUrls?: boolean } = {}): string {
	return cleanText(plainTextFromNode(markdownTree(markdown), options));
}

function summarize(text: string, limit = 480): string | null {
	const summary = markdownPlainText(text);
	if (!summary) return null;
	return summary.slice(0, limit);
}

function parseSections(body: string): Record<string, string> {
	const sections: Record<string, string[]> = { _root: [] };
	let current = '_root';
	let fallbackCurrent = '_root';
	const tree = markdownTree(body);

	for (const node of tree.children ?? []) {
		if (node.type === 'heading' && node.depth === 2) {
			current = cleanText(plainTextFromNode(node));
			sections[current] ??= [];
			continue;
		}

		const rendered = body.slice(
			(node as { position?: { start: { offset: number }; end: { offset: number } } }).position?.start.offset ?? 0,
			(node as { position?: { start: { offset: number }; end: { offset: number } } }).position?.end.offset ?? 0,
		);
		if (rendered) {
			sections[current] ??= [];
			sections[current]!.push(rendered);
		}
	}

	for (const line of body.split(/\r?\n/)) {
		const htmlHeading = line.trim().match(/^<h[23]>(.+)<\/h[23]>$/i);
		if (htmlHeading) {
			fallbackCurrent = cleanText(htmlHeading[1]!);
			sections[fallbackCurrent] ??= [];
			continue;
		}
		if (fallbackCurrent !== '_root') {
			sections[fallbackCurrent] ??= [];
			sections[fallbackCurrent]!.push(line);
			continue;
		}
		if ((tree.children ?? []).length === 0) {
			sections[current] ??= [];
			sections[current]!.push(line);
		}
	}

	return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()]));
}

function parseBasicInfo(section: string): Record<string, string> {
	const info: Record<string, string> = {};
	const tree = markdownTree(section);
	const items = collectListItems(tree);

	for (const listItem of items) {
		const item = cleanText(plainTextFromNode(listItem, { includeLinkUrls: true }));
		const separator = item.includes('：') ? '：' : item.includes(':') ? ':' : null;
		if (!separator) continue;
		const index = item.indexOf(separator);
		info[item.slice(0, index).trim()] = item.slice(index + 1).trim();
	}

	for (const rawLine of section.split(/\r?\n/)) {
		const line = rawLine.trim();
		const htmlItem = line.match(/^<li>(.+?)<\/li>$/i)?.[1];
		if (!htmlItem) continue;
		const item = cleanText(htmlItem);
		const separator = item.includes('：') ? '：' : item.includes(':') ? ':' : null;
		if (!separator) continue;
		const index = item.indexOf(separator);
		info[item.slice(0, index).trim()] = item.slice(index + 1).trim();
	}

	return info;
}

function collectListItems(node: MarkdownNode): ListItemNode[] {
	const result: ListItemNode[] = [];
	visit(node as never, 'listItem', (listItem) => {
		result.push(listItem as ListItemNode);
	});
	return result;
}

function parseDateLike(value: string | null | undefined): string | null {
	if (!value) return null;
	const text = value.trim().replaceAll(' ', '');

	let match = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
	if (match) return `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`;

	match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (match) return `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`;

	return null;
}

function firstUrl(text: string | null | undefined): string | null {
	if (!text) return null;
	return text.match(/\((https?:\/\/[^)\s]+)\)/)?.[1] ?? text.match(/https?:\/\/[^\s)"'<]+/)?.[0] ?? null;
}

function issueNumberFor(source: SourceArticle, basic: Record<string, string>): string | null {
	const explicit = source.title.match(/#\s*(\d+)/)?.[1];
	if (explicit) return explicit.padStart(2, '0');

	const date = parseDateLike(basic['放送日'] ?? basic['日時']) ?? source.date;
	if (date) return date;

	return basename(source.name, extname(source.name));
}

function articleTypeFor(source: SourceArticle, sections: Record<string, string>, publicationType: string): string {
	if (source.title === 'Web掲載') return 'link_index';
	if (source.name === 'radio.md') return 'appearance_index';
	if (sections['放送リスト']) return 'episode_list';
	if (sections['書き起こし']) return 'transcript';
	if (source.name === '2016-04-19-170000.md') return 'excerpt';
	if (sections['放送内容']) return 'broadcast_summary';
	if (publicationType === 'web') return 'web_article';
	return `${publicationType}_article`;
}

function classifySource(source: SourceArticle): MediaSeed {
	const sections = parseSections(source.body);
	const basic = parseBasicInfo(sections['基本情報'] ?? '');
	const joined = `${source.title}\n${source.body}`;
	const matched = source.title === 'Web掲載' || source.name === 'radio.md' ? undefined : PROGRAM_PATTERNS.find((item) => item.pattern.test(joined));
	const tagType = source.tags.includes('TV') ? 'tv' : source.tags.includes('Radio') ? 'radio' : 'web';
	const publicationType = source.title === 'Web掲載' ? 'web_index' : source.name === 'radio.md' ? 'radio_index' : (matched?.type ?? tagType);
	const publicationName = source.title === 'Web掲載' ? 'Web掲載情報' : source.name === 'radio.md' ? 'ラジオ出演' : (matched?.publication ?? source.title);
	const publisher = basic['放送局'] ?? matched?.publisher ?? null;
	const publishedDate = parseDateLike(basic['放送日'] ?? basic['日時']) ?? source.date;
	const detailUrl = firstUrl(basic['詳細']);
	const contentSection = sections['書き起こし'] ?? sections['内容'] ?? sections['放送内容'] ?? sections['放送リスト'] ?? source.body;

	return {
		publicationName,
		publicationType,
		publisher,
		issueNumber: issueNumberFor(source, basic),
		volume: null,
		publishedDate,
		issueDescription: summarize(sections['基本情報'] ?? source.body, 320),
		articleTitle: source.title,
		articleType: articleTypeFor(source, sections, publicationType),
		summary: summarize(contentSection),
		content: source.body || null,
		url: detailUrl,
		notes: compactNotes(source),
	};
}

function compactNotes(source: SourceArticle): string {
	return [`source_file=${source.name}`, `source_tags=${source.tags.join(', ')}`].join('\n');
}

class SqlBuilder {
	readonly lines: string[] = [];

	line(value = ''): void {
		this.lines.push(value);
	}

	publicationUpsert(seed: MediaSeed): string {
		const id = stableUuid('publication', seed.publicationName);
		this.line('INSERT INTO publication (id, name, type, publisher, description)');
		this.line(`VALUES (${sqlText(id)}, ${sqlText(seed.publicationName)}, ${sqlText(seed.publicationType)}, ${sqlText(seed.publisher)}, NULL)`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET name = EXCLUDED.name,');
		this.line('    type = EXCLUDED.type,');
		this.line('    publisher = EXCLUDED.publisher;');
		this.line();
		return id;
	}

	issueUpsert(seed: MediaSeed, publicationId: string, source: SourceArticle): string {
		const id = stableUuid('publication_issue', source.name);
		this.line('INSERT INTO publication_issue (id, publication_id, issue_number, volume, published_date, description)');
		this.line(`VALUES (${sqlText(id)}, ${sqlText(publicationId)}, ${sqlText(seed.issueNumber)}, ${sqlText(seed.volume)}, ${sqlText(seed.publishedDate)}, ${sqlText(seed.issueDescription)})`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET publication_id = EXCLUDED.publication_id,');
		this.line('    issue_number = EXCLUDED.issue_number,');
		this.line('    volume = EXCLUDED.volume,');
		this.line('    published_date = EXCLUDED.published_date,');
		this.line('    description = EXCLUDED.description;');
		this.line();
		return id;
	}

	articleUpsert(seed: MediaSeed, issueId: string, source: SourceArticle): void {
		const id = stableUuid('article', source.name);
		const summary = [seed.summary, seed.notes].filter(Boolean).join('\n\n') || null;
		this.line('INSERT INTO article (id, publication_issue_id, title, type, published_date, summary, content, url)');
		this.line(
			`VALUES (${sqlText(id)}, ${sqlText(issueId)}, ${sqlText(seed.articleTitle)}, ${sqlText(seed.articleType)}, ${sqlText(seed.publishedDate)}, ${sqlText(summary)}, ${sqlText(seed.content)}, ${sqlText(seed.url)})`,
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

	candidateIssueUpsert(candidate: ArticleCandidateSeed, publicationId: string): string {
		const id = stableUuid('publication_issue', `article_candidate/${candidate.url}`);
		this.line('INSERT INTO publication_issue (id, publication_id, issue_number, volume, published_date, description)');
		this.line(
			`VALUES (${sqlText(id)}, ${sqlText(publicationId)}, ${sqlText(candidate.publishedDate)}, NULL, ${sqlText(candidate.publishedDate)}, ${sqlText(candidate.summary)})`,
		);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET publication_id = EXCLUDED.publication_id,');
		this.line('    issue_number = EXCLUDED.issue_number,');
		this.line('    volume = EXCLUDED.volume,');
		this.line('    published_date = EXCLUDED.published_date,');
		this.line('    description = EXCLUDED.description;');
		this.line();
		return id;
	}

	candidateArticleUpsert(candidate: ArticleCandidateSeed, issueId: string): void {
		const id = stableUuid('article', `article_candidate/${candidate.url}`);
		const summary = [candidate.summary, candidate.notes].filter(Boolean).join('\n\n') || null;
		this.line('INSERT INTO article (id, publication_issue_id, title, type, published_date, summary, content, url)');
		this.line(
			`VALUES (${sqlText(id)}, ${sqlText(issueId)}, ${sqlText(candidate.articleTitle)}, ${sqlText(candidate.articleType)}, ${sqlText(candidate.publishedDate)}, ${sqlText(summary)}, NULL, ${sqlText(candidate.url)})`,
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

export function renderSql(sources: SourceArticle[], articleCandidates: ArticleCandidateSeed[] = []): string {
	const builder = new SqlBuilder();
	const mediaSources = sources.filter((source) => source.tags[0] === 'Media');

	builder.line('-- Generated by scripts/generate_media_seed_sql.ts');
	builder.line(`-- media_sources: ${mediaSources.length}`);
	builder.line(`-- approved_article_candidates: ${articleCandidates.length}`);
	builder.line('BEGIN;');
	builder.line();

	for (const source of mediaSources) {
		const seed = classifySource(source);
		builder.line(`-- source: ${source.path}`);
		builder.line(`-- publication: ${seed.publicationName}`);
		builder.line();
		const publicationId = builder.publicationUpsert(seed);
		const issueId = builder.issueUpsert(seed, publicationId, source);
		builder.articleUpsert(seed, issueId, source);
	}

	const publicationIds = new Map<string, string>();
	for (const candidate of articleCandidates) {
		builder.line(`-- candidate: ${candidate.candidateFile}`);
		builder.line(`-- source: ${candidate.sourceFile}`);
		builder.line(`-- publication: ${candidate.publicationName}`);
		builder.line();

		let publicationId = publicationIds.get(candidate.publicationName);
		if (!publicationId) {
			publicationId = builder.publicationUpsert({
				publicationName: candidate.publicationName,
				publicationType: candidate.publicationType,
				publisher: null,
				issueNumber: null,
				volume: null,
				publishedDate: null,
				issueDescription: null,
				articleTitle: candidate.articleTitle,
				articleType: candidate.articleType,
				summary: candidate.summary,
				content: null,
				url: candidate.url,
				notes: candidate.notes,
			});
			publicationIds.set(candidate.publicationName, publicationId);
		}

		const issueId = builder.candidateIssueUpsert(candidate, publicationId);
		builder.candidateArticleUpsert(candidate, issueId);
	}

	const skipped = sources.filter((source) => source.tags[0] !== 'Media');
	if (skipped.length > 0) {
		builder.line(`-- skipped: ${skipped.length} files`);
		for (const source of skipped) {
			builder.line(`-- skipped_file: ${source.name}`);
		}
		builder.line();
	}

	builder.line('COMMIT;');
	builder.line();
	return builder.lines.join('\n');
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	let sources = await loadSources(args.sourceDir);
	const articleCandidates = await loadArticleCandidates(args.candidateDir);
	if (args.files && args.files.length > 0) {
		const wanted = new Set(args.files);
		sources = sources.filter((source) => wanted.has(source.name));
	}

	const sql = renderSql(sources, articleCandidates);
	await mkdir(dirname(args.output), { recursive: true });
	await writeFile(args.output, sql, 'utf8');
	console.log(`Wrote ${args.output}`);
	console.log(`Media sources: ${sources.filter((source) => source.tags[0] === 'Media').length}`);
	console.log(`Approved article candidates: ${articleCandidates.length}`);
}

if (import.meta.main) {
	await main();
}
