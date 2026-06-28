#!/usr/bin/env bun

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

type NormalizedType = 'release' | 'live' | 'event' | 'project';

export type SourceArticle = {
	path: string;
	name: string;
	stem: string;
	title: string;
	date: string | null;
	tags: string[];
	body: string;
};

type ParsedArgs = {
	output: string;
	sourceDir: string;
	types: NormalizedType[];
	files: string[] | null;
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_SOURCE_DIR = join(ROOT, 'rawData', 'articles');
const KIND_MAP: Record<string, NormalizedType> = {
	Release: 'release',
	Live: 'live',
	Event: 'event',
	参加バンド: 'project',
};
const LOCATION_HINTS = new Set(['東京', '大阪', '名古屋', '札幌', '仙台', '神戸', '横浜', '京都', '福岡', '埼玉', '千葉']);
const NON_PROJECT_TAGS = new Set([
	'Release',
	'Live',
	'Event',
	'参加バンド',
	'Biography',
	'Album',
	'Mini-Al',
	'Single',
	'Sg',
	'EP',
	'DVD',
	'Live DVD',
	'CD-R',
	'Demo',
	'memo',
	'予定',
	'単独ライブ',
	'フェス',
	'イベント',
	'_incomplete',
]);

function parseArgs(argv: string[]): ParsedArgs {
	let output: string | null = null;
	let sourceDir = DEFAULT_SOURCE_DIR;
	let files: string[] | null = null;
	let types: NormalizedType[] = ['release', 'live', 'event', 'project'];

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--output') {
			output = argv[++i] ?? null;
			continue;
		}
		if (arg === '--source-dir') {
			sourceDir = resolve(argv[++i] ?? DEFAULT_SOURCE_DIR);
			continue;
		}
		if (arg === '--types') {
			const collected: NormalizedType[] = [];
			while (argv[i + 1] && !argv[i + 1]!.startsWith('--')) {
				const next = argv[++i] as NormalizedType;
				if (next === 'release' || next === 'live' || next === 'event' || next === 'project') {
					collected.push(next);
				} else {
					throw new Error(`Unsupported type: ${next}`);
				}
			}
			types = collected.length > 0 ? collected : types;
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

	if (!output) {
		throw new Error('Missing required --output');
	}

	return {
		output: resolve(output),
		sourceDir,
		types,
		files,
	};
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
			const value = parseScalar(line.slice(colonIndex + 1));
			meta[key] = value;
		}
		index += 1;
	}

	return {
		meta,
		body: lines.slice(index).join('\n').trim(),
	};
}

async function loadSources(sourceDir: string): Promise<SourceArticle[]> {
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
			path,
			name: file,
			stem: basename(file, extname(file)),
			title: String(meta.title ?? basename(file, extname(file))),
			date: String(meta.date ?? '').slice(0, 10) || null,
			tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
			body,
		});
	}
	return sources;
}

function kindOf(source: SourceArticle): NormalizedType | null {
	if (source.tags.length === 0) return null;
	if (source.tags[0] === 'Live' && source.stem.startsWith('live_')) return null;
	return KIND_MAP[source.tags[0]!] ?? null;
}

function normalizeName(name: string): string {
	return name.replace(/\s+/g, ' ').trim();
}

function projectType(name: string): string {
	const lowered = name.toLowerCase();
	if (name.includes('Poet-type.M') || name.includes('門田匡陽') || lowered.includes('solo')) {
		return 'solo';
	}
	return 'band';
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

function parseSections(body: string): Record<string, string> {
	const sections: Record<string, string[]> = { _root: [] };
	let current = '_root';
	for (const line of body.split(/\r?\n/)) {
		const match = line.trim().match(/^##\s+(.+)$/);
		if (match) {
			current = match[1]!.trim();
			sections[current] ??= [];
			continue;
		}
		sections[current] ??= [];
		sections[current]!.push(line);
	}
	return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()]));
}

function parseBasicInfo(section: string): Record<string, string> {
	const info: Record<string, string> = {};
	for (const rawLine of section.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!(line.startsWith('* ') || line.startsWith('- '))) continue;
		const item = line.slice(2).trim();
		const separator = item.includes('：') ? '：' : item.includes(':') ? ':' : null;
		if (!separator) continue;
		const index = item.indexOf(separator);
		const key = item.slice(0, index).trim();
		const value = item.slice(index + 1).trim();
		info[key] = value;
	}
	return info;
}

function stripMarkdown(text: string): string {
	let result = text
		.replace(/`([^`]*)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\[\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/^#+\s*/gm, '')
		.replace(/^\s*[-*]\s*/gm, '')
		.replace(/^\s*\d+\.\s*/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
	let previous = '';
	while (result !== previous) {
		previous = result;
		result = result
			.replace(/\(\([\s\S]*?\)\)/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
	return result;
}

const NAME_ALIASES: Record<string, string> = {
	'uk.project inc.': 'UK.PROJECT',
	自主制作: 'セルフリリース',
};

function normalizeLabelName(value: string | null | undefined): string | null {
	if (!value) return null;
	let name = stripMarkdown(value);
	if (!name) return null;
	name = name.replace(/\s*[:：]\s*$/, '');
	name = name.replace(/\s*\(([^()]*)\)\s*$/, (_, inner: string) => {
		const lowered = inner.toLowerCase();
		if (lowered.includes('非売品') || lowered.includes('限定') || lowered.includes('仮') || lowered.includes('暫定')) return '';
		if (lowered.startsWith('label') || lowered.startsWith('alias') || lowered.startsWith('aka') || lowered.startsWith('旧称') || lowered.startsWith('別名')) return '';
		return ` (${inner})`;
	});
	name = name.replace(/\s+/g, ' ').trim();
	const alias = NAME_ALIASES[name.toLowerCase()];
	if (alias) return alias;
	return name || null;
}

function splitLabelSource(value: string | null | undefined): [string | null, string | null] {
	const normalized = normalizeLabelName(value);
	if (!normalized) return [null, null];
	const parts = normalized
		.split(/\s*\/\s*/)
		.map((part) => normalizeLabelName(part))
		.filter((part): part is string => Boolean(part));
	if (parts.length === 0) return [null, null];
	if (parts.length === 1) return [parts[0]!, null];
	return [parts[0]!, parts[1]!];
}

function summarize(text: string, limit = 280): string | null {
	const summary = stripMarkdown(text);
	if (!summary) return null;
	return summary.slice(0, limit);
}

function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

function parsePartialDate(value: string | null | undefined, end = false): string | null {
	if (!value) return null;
	const text = value.trim().replaceAll(' ', '');

	let match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (match) {
		return `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`;
	}

	match = text.match(/(\d{4})年(\d{1,2})月/);
	if (match) {
		const year = Number(match[1]);
		const month = Number(match[2]);
		const day = end ? daysInMonth(year, month) : 1;
		return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	match = text.match(/(\d{4})年/);
	if (match) {
		return end ? `${match[1]}-12-31` : `${match[1]}-01-01`;
	}

	match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
	if (match) {
		return `${match[1]}-${match[2]}-${match[3]}`;
	}

	return null;
}

function parseActivityPeriod(value: string | null | undefined): [string | null, string | null] {
	if (!value) return [null, null];

	let start: string | null = null;
	let end: string | null = null;

	const parts = value.split(/[~〜～]/);
	if (parts.length > 0) {
		start = parsePartialDate(parts[0], false);
		if (parts.length > 1) {
			end = parsePartialDate(parts[parts.length - 1], true);
		}
	}

	const stopped = value.match(/\(([^)]*活動停止[^)]*)\)/);
	if (!end && stopped) {
		end = parsePartialDate(stopped[1], true);
	}

	const dateTokens = value.match(/\d{4}年\d{1,2}月\d{1,2}日|\d{4}年\d{1,2}月|\d{4}年|\d{4}-\d{2}-\d{2}/g) ?? [];
	if (dateTokens.length > 0) {
		const inferredStart = parsePartialDate(dateTokens[0], false);
		if (inferredStart && (!start || inferredStart < start)) {
			start = inferredStart;
		}
		if (dateTokens.length > 1) {
			const inferredEnd = parsePartialDate(dateTokens[dateTokens.length - 1], true);
			if (inferredEnd && (!end || inferredEnd > end)) {
				end = inferredEnd;
			}
		}
	}

	if (start && end && start > end) {
		return [end, start];
	}

	return [start, end];
}

function parseEventDatetime(value: string | null | undefined, fallbackDate: string | null): [string | null, string | null, string | null] {
	if (!value && !fallbackDate) return [null, null, null];
	const rawValue = value ?? fallbackDate ?? '';
	const eventDate = parsePartialDate(rawValue, false) ?? parsePartialDate(fallbackDate, false);
	const normalized = rawValue.replaceAll('開場', 'OPEN').replaceAll('開演', 'START');
	const openMatch = normalized.match(/OPEN\s*(\d{1,2}:\d{2})/i);
	const startMatch = normalized.match(/START\s*(\d{1,2}:\d{2})/i);
	return [eventDate, openMatch?.[1] ?? null, startMatch?.[1] ?? null];
}

function splitVenue(value: string | null | undefined): [string | null, string | null] {
	if (!value) return [null, null];
	const parts = value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length === 1) return [parts[0]!, null];
	if (LOCATION_HINTS.has(parts[0]!)) return [parts[1]!, parts[0]!];
	if (LOCATION_HINTS.has(parts[parts.length - 1]!)) {
		return [parts[0]!, parts[parts.length - 1]!];
	}
	return [parts[0]!, parts.slice(1).join(', ')];
}

function releaseWorkTitle(source: SourceArticle): string {
	const parts = source.title.split(' - ');
	return normalizeName(parts.length > 1 ? parts.slice(1).join(' - ') : source.title);
}

function projectNameForSource(source: SourceArticle): string {
	const taggedProject = source.tags
		.slice(1)
		.map(normalizeName)
		.find((tag) => tag && !NON_PROJECT_TAGS.has(tag) && !tag.startsWith('_'));
	if (taggedProject) return taggedProject;

	const parts = source.title.split(' - ');
	if (parts.length > 1) {
		return normalizeName(parts[0]!.replace(/^\d{4}-\d{2}-\d{2}:\s*/, ''));
	}

	return normalizeName(source.title.replace(/^\d{4}-\d{2}-\d{2}:\s*/, ''));
}

class SqlBuilder {
	readonly lines: string[] = [];

	line(value = ''): void {
		this.lines.push(value);
	}

	projectUpsert(params: { name: string; kind: string; description: string | null; startDate: string | null; endDate: string | null }): string {
		const projectId = stableUuid('project', params.name);
		this.line('INSERT INTO project (id, name, type, description, start_date, end_date)');
		this.line(`VALUES (${sqlText(projectId)}, ${sqlText(params.name)}, ${sqlText(params.kind)}, ${sqlText(params.description)}, ${sqlText(params.startDate)}, ${sqlText(params.endDate)})`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET name = EXCLUDED.name,');
		this.line('    type = EXCLUDED.type,');
		this.line('    description = COALESCE(project.description, EXCLUDED.description),');
		this.line('    start_date = COALESCE(project.start_date, EXCLUDED.start_date),');
		this.line('    end_date = COALESCE(project.end_date, EXCLUDED.end_date);');
		this.line();
		return projectId;
	}

	workUpsert(params: { projectId: string; title: string; description: string | null; releasedDate: string | null; type: 'original' | 'compilation' | 'best' }): string {
		const workId = stableUuid('work', `${params.projectId}:${params.title}`);
		this.line('INSERT INTO work (id, project_id, title, description, created_date, released_date, type)');
		this.line(`VALUES (${sqlText(workId)}, ${sqlText(params.projectId)}, ${sqlText(params.title)}, ${sqlText(params.description)}, NULL, ${sqlText(params.releasedDate)}, ${sqlText(params.type)})`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET project_id = EXCLUDED.project_id,');
		this.line('    title = EXCLUDED.title,');
		this.line('    description = COALESCE(work.description, EXCLUDED.description),');
		this.line('    released_date = COALESCE(work.released_date, EXCLUDED.released_date),');
		this.line('    type = EXCLUDED.type;');
		this.line();
		return workId;
	}

	workProjectUpsert(workId: string, projectId: string, relationType: 'primary' | 'participant'): void {
		const relationId = stableUuid('work_project', `${workId}:${projectId}`);
		this.line('INSERT INTO work_project (id, work_id, project_id, relation_type)');
		this.line(`VALUES (${sqlText(relationId)}, ${sqlText(workId)}, ${sqlText(projectId)}, ${sqlText(relationType)})`);
		this.line('ON CONFLICT (work_id, project_id) DO UPDATE SET relation_type = EXCLUDED.relation_type;');
		this.line();
	}

	distributorUpsert(name: string | null): string | null {
		const normalizedName = normalizeLabelName(name);
		if (!normalizedName) return null;
		const distributorId = stableUuid('distributor', normalizedName);
		const description = name && normalizeLabelName(name) !== normalizedName ? `source_label=${normalizeLabelName(name)}` : null;
		this.line('INSERT INTO distributor (id, name, description)');
		this.line(`VALUES (${sqlText(distributorId)}, ${sqlText(normalizedName)}, ${sqlText(description)})`);
		this.line('ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = COALESCE(distributor.description, EXCLUDED.description);');
		this.line();
		return distributorId;
	}

	labelUpsert(name: string | null, sourceLabel: string | null = null): string | null {
		const normalizedName = normalizeLabelName(name);
		if (!normalizedName) return null;
		const labelId = stableUuid('label', normalizedName);
		const description = sourceLabel && normalizeLabelName(sourceLabel) !== normalizedName ? `source_label=${normalizeLabelName(sourceLabel)}` : null;
		this.line('INSERT INTO label (id, name, description)');
		this.line(`VALUES (${sqlText(labelId)}, ${sqlText(normalizedName)}, ${sqlText(description)})`);
		this.line('ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = COALESCE(label.description, EXCLUDED.description);');
		this.line();
		return labelId;
	}

	releaseUpsert(params: {
		source: SourceArticle;
		workId: string;
		releaseFormat: string;
		catalogNumber: string | null;
		releaseDate: string | null;
		description: string | null;
		notes: string | null;
		distributorId: string | null;
		editionType: 'original' | 'reissue';
	}): string {
		const releaseId = stableUuid('release', params.source.name);
		this.line(
			'INSERT INTO release (id, work_id, format, catalog_number, release_date, release_date_precision, recorded_from, recorded_to, description, notes, distributor_id, edition_type, reissue_of_release_id)',
		);
		this.line(
			`VALUES (${sqlText(releaseId)}, ${sqlText(params.workId)}, ${sqlText(params.releaseFormat)}, ${sqlText(params.catalogNumber)}, ${sqlText(params.releaseDate)}, NULL, NULL, NULL, ${sqlText(params.description)}, ${sqlText(params.notes)}, ${sqlText(params.distributorId)}, ${sqlText(params.editionType)}, NULL)`,
		);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET work_id = EXCLUDED.work_id,');
		this.line('    format = EXCLUDED.format,');
		this.line('    catalog_number = EXCLUDED.catalog_number,');
		this.line('    release_date = EXCLUDED.release_date,');
		this.line('    description = EXCLUDED.description,');
		this.line('    notes = EXCLUDED.notes,');
		this.line('    distributor_id = EXCLUDED.distributor_id,');
		this.line('    edition_type = EXCLUDED.edition_type;');
		this.line();
		return releaseId;
	}

	labelRelationUpsert(releaseId: string, labelId: string): void {
		const relationId = stableUuid('label_relation', `${releaseId}:${labelId}`);
		this.line('INSERT INTO label_relation (id, release_id, label_id)');
		this.line(`VALUES (${sqlText(relationId)}, ${sqlText(releaseId)}, ${sqlText(labelId)})`);
		this.line('ON CONFLICT (id) DO NOTHING;');
		this.line();
	}

	venueUpsert(params: { name: string; location: string | null; description: string | null }): string {
		const venueId = stableUuid('venue', `${params.name}|${params.location ?? ''}`);
		this.line('INSERT INTO venue (id, name, location, description)');
		this.line(`VALUES (${sqlText(venueId)}, ${sqlText(params.name)}, ${sqlText(params.location)}, ${sqlText(params.description)})`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET name = EXCLUDED.name,');
		this.line('    location = EXCLUDED.location,');
		this.line('    description = COALESCE(venue.description, EXCLUDED.description);');
		this.line();
		return venueId;
	}

	eventUpsert(params: {
		source: SourceArticle;
		projectId: string;
		venueId: string;
		eventType: string;
		eventName: string | null;
		eventDate: string;
		startTime: string | null;
		doorsOpenTime: string | null;
		description: string | null;
		notes: string | null;
	}): string {
		const eventId = stableUuid('event', params.source.name);
		this.line('INSERT INTO event (id, project_id, venue_id, type, event_name, event_date, start_time, end_time, doors_open_time, ticket_price, description, notes)');
		this.line(
			`VALUES (${sqlText(eventId)}, ${sqlText(params.projectId)}, ${sqlText(params.venueId)}, ${sqlText(params.eventType)}, ${sqlText(params.eventName)}, ${sqlText(params.eventDate)}, ${sqlText(params.startTime)}, NULL, ${sqlText(params.doorsOpenTime)}, NULL, ${sqlText(params.description)}, ${sqlText(params.notes)})`,
		);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET project_id = EXCLUDED.project_id,');
		this.line('    venue_id = EXCLUDED.venue_id,');
		this.line('    type = EXCLUDED.type,');
		this.line('    event_date = EXCLUDED.event_date,');
		this.line('    event_name = EXCLUDED.event_name,');
		this.line('    start_time = EXCLUDED.start_time,');
		this.line('    doors_open_time = EXCLUDED.doors_open_time,');
		this.line('    description = EXCLUDED.description,');
		this.line('    notes = EXCLUDED.notes;');
		this.line();
		return eventId;
	}
}

function compactNotes(source: SourceArticle, extra: Record<string, string | null | undefined>): string | null {
	const parts = [`source_file=${source.name}`, `source_tags=${source.tags.join(', ')}`];
	for (const [key, value] of Object.entries(extra)) {
		if (value) parts.push(`${key}=${value}`);
	}
	return parts.length > 0 ? parts.join('\n') : null;
}

export function workType(source: SourceArticle): 'original' | 'compilation' | 'best' {
	if (source.tags.includes('Compilation')) {
		return /^VA\s*-/i.test(source.title) ? 'compilation' : 'best';
	}
	if (/\bBEST\b/i.test(source.title) || /ベスト盤/.test(source.body)) return 'best';
	return 'original';
}

export function compilationProjectNames(source: SourceArticle): string[] {
	const classificationIndex = source.tags.indexOf('Compilation');
	if (classificationIndex < 0) return [];
	return source.tags
		.slice(1, classificationIndex)
		.map(normalizeName)
		.filter((tag) => !/(?:label|records?|recordings?|self-release|uk\.project)/i.test(tag));
}

export function releaseEditionType(source: SourceArticle): 'original' | 'reissue' {
	return source.tags.includes('Reissue/Remaster') ? 'reissue' : 'original';
}

function emitRelease(builder: SqlBuilder, source: SourceArticle): void {
	if (isReleaseIndexSource(source)) {
		builder.line(`-- skipped release index: ${source.path}`);
		builder.line();
		return;
	}

	const sections = parseSections(source.body);
	const basic = parseBasicInfo(sections['基本情報'] ?? '');
	const projectName = projectNameForSource(source);
	const projectId = builder.projectUpsert({
		name: projectName,
		kind: projectType(projectName),
		description: null,
		startDate: null,
		endDate: null,
	});

	const releaseDate = parsePartialDate(basic['リリース'] ?? source.date, false);
	const type = workType(source);
	const workId = builder.workUpsert({
		projectId,
		title: releaseWorkTitle(source),
		description: summarize(sections['その他'] || source.body),
		releasedDate: releaseDate,
		type,
	});
	if (type === 'compilation') {
		const participantNames = compilationProjectNames(source);
		for (const participantName of participantNames.length > 0 ? participantNames : [projectName]) {
			const participantId =
				participantName === projectName
					? projectId
					: builder.projectUpsert({
							name: participantName,
							kind: projectType(participantName),
							description: null,
							startDate: null,
							endDate: null,
						});
			builder.workProjectUpsert(workId, participantId, 'participant');
		}
	} else {
		builder.workProjectUpsert(workId, projectId, 'primary');
	}

	let labelName = basic['レーベル'] ?? basic['発売元'] ?? null;
	let distributorName = basic['販売元'] ?? null;
	if (basic['発売元/販売元']) {
		labelName ??= basic['発売元/販売元'];
		distributorName ??= basic['発売元/販売元'];
	}

	const [parsedLabelName, impliedDistributorName] = splitLabelSource(labelName);
	const resolvedLabelName = parsedLabelName ?? normalizeLabelName(labelName);
	const resolvedDistributorName = normalizeLabelName(distributorName) ?? impliedDistributorName;

	const distributorId = builder.distributorUpsert(resolvedDistributorName);
	const labelId = builder.labelUpsert(resolvedLabelName, labelName);
	const releaseId = builder.releaseUpsert({
		source,
		workId,
		releaseFormat: basic['形態'] ?? 'unknown',
		catalogNumber: basic['品番'] ?? null,
		releaseDate,
		description: summarize(sections['その他'] || source.body),
		notes: compactNotes(source, {
			distribution_method: basic['流通方法'],
			price: basic['定価'],
		}),
		distributorId,
		editionType: releaseEditionType(source),
	});
	if (labelId) {
		builder.labelRelationUpsert(releaseId, labelId);
	}
}

function isReleaseIndexSource(source: SourceArticle): boolean {
	return source.name === '2022-12-18-000000.md' || source.title.includes('デモ音源リスト');
}

function emitLive(builder: SqlBuilder, source: SourceArticle): void {
	const sections = parseSections(source.body);
	const basic = parseBasicInfo(sections['基本情報'] ?? '');
	const projectName = projectNameForSource(source);
	const projectId = builder.projectUpsert({
		name: projectName,
		kind: projectType(projectName),
		description: null,
		startDate: null,
		endDate: null,
	});

	const [venueName, location] = splitVenue(basic['会場']);
	if (!venueName) throw new Error(`Could not parse venue for ${source.name}`);
	const venueId = builder.venueUpsert({ name: venueName, location, description: null });

	const [eventDate, doorsOpenTime, startTime] = parseEventDatetime(basic['日時'], source.date);
	if (!eventDate) throw new Error(`Could not parse event date for ${source.name}`);

	builder.eventUpsert({
		source,
		projectId,
		venueId,
		eventType: 'live',
		eventName: basic['イベント名'] ?? null,
		eventDate,
		startTime,
		doorsOpenTime,
		description: summarize(sections['その他'] || sections['セットリスト'] || source.body),
		notes: compactNotes(source, {
			detail_url: basic['詳細'] ?? basic['公演詳細'],
		}),
	});
}

function eventTypeForSource(source: SourceArticle, eventName: string | null): string {
	const text = `${source.title} ${eventName ?? ''}`;
	if (text.includes('展') || text.includes('展示')) return 'exhibition';
	if (text.includes('試聴会')) return 'listening_event';
	return 'event';
}

function eventDescriptionFromBasic(basic: Record<string, string>): string | null {
	const parts: string[] = [];
	if (basic['日時']?.includes('〜') || basic['日時']?.includes('~')) {
		parts.push(`日時: ${stripMarkdown(basic['日時'])}`);
	}
	if (parts.length === 0) return null;
	return parts.join('\n');
}

function emitEvent(builder: SqlBuilder, source: SourceArticle): void {
	const sections = parseSections(source.body);
	const basic = parseBasicInfo(sections['基本情報'] ?? '');
	const projectName = projectNameForSource(source);
	const projectId = builder.projectUpsert({
		name: projectName,
		kind: projectType(projectName),
		description: null,
		startDate: null,
		endDate: null,
	});

	const [venueName, location] = splitVenue(basic['会場']);
	if (!venueName) throw new Error(`Could not parse venue for ${source.name}`);
	const venueId = builder.venueUpsert({ name: venueName, location, description: null });

	const [eventDate, doorsOpenTime, startTime] = parseEventDatetime(basic['日時'], source.date);
	if (!eventDate) throw new Error(`Could not parse event date for ${source.name}`);
	const eventName = basic['イベント名'] ?? null;

	builder.eventUpsert({
		source,
		projectId,
		venueId,
		eventType: eventTypeForSource(source, eventName),
		eventName,
		eventDate,
		startTime,
		doorsOpenTime,
		description: eventDescriptionFromBasic(basic),
		notes: compactNotes(source, {
			detail_url: basic['詳細'] ?? basic['公演詳細'],
		}),
	});
}

function emitProject(builder: SqlBuilder, source: SourceArticle): void {
	const sections = parseSections(source.body);
	const basic = parseBasicInfo(sections['基本情報'] ?? '');
	const [startDate, endDate] = parseActivityPeriod(basic['活動期間']);
	const projectName = projectNameForSource(source);
	builder.projectUpsert({
		name: projectName,
		kind: projectType(projectName),
		description: summarize(sections['その他'] || source.body, 1000),
		startDate: startDate ?? source.date,
		endDate,
	});
}

function renderSql(sources: SourceArticle[], includeTypes: NormalizedType[]): string {
	const builder = new SqlBuilder();
	const skipped: string[] = [];
	const failed: string[] = [];

	builder.line('-- Generated by scripts/generate_rawdata_seed_sql.ts');
	builder.line('BEGIN;');
	builder.line();

	for (const source of sources) {
		const sourceKind = kindOf(source);
		if (!sourceKind || !includeTypes.includes(sourceKind)) {
			skipped.push(source.name);
			continue;
		}

		builder.line(`-- source: ${source.path}`);
		builder.line(`-- kind: ${source.tags[0]}`);
		builder.line();

		try {
			if (sourceKind === 'release') emitRelease(builder, source);
			if (sourceKind === 'live') emitLive(builder, source);
			if (sourceKind === 'event') emitEvent(builder, source);
			if (sourceKind === 'project') emitProject(builder, source);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failed.push(`${source.name}: ${message}`);
			builder.line(`-- failed_source: ${source.name}`);
			builder.line(`-- failure_reason: ${message.replaceAll('\n', ' ')}`);
			builder.line();
		}
	}

	if (skipped.length > 0) {
		builder.line(`-- skipped: ${skipped.length} files`);
		for (const name of skipped.slice(0, 20)) {
			builder.line(`-- skipped_file: ${name}`);
		}
		builder.line();
	}

	if (failed.length > 0) {
		builder.line(`-- failed: ${failed.length} files`);
		for (const item of failed.slice(0, 50)) {
			builder.line(`-- failed_item: ${item}`);
		}
		builder.line();
	}

	builder.line('COMMIT;');
	builder.line();
	return builder.lines.join('\n');
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	let sources = await loadSources(args.sourceDir);
	if (args.files && args.files.length > 0) {
		const wanted = new Set(args.files);
		sources = sources.filter((source) => wanted.has(source.name));
	}

	const sql = renderSql(sources, args.types);
	await mkdir(dirname(args.output), { recursive: true });
	await writeFile(args.output, sql, 'utf8');
}

if (import.meta.main) {
	await main();
}
