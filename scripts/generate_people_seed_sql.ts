#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePersonAlias } from './lib/personAliases';

type SourceArticle = {
	path: string;
	name: string;
	title: string;
	date: string | null;
	tags: string[];
	body: string;
};

type PersonSeed = {
	name: string;
	birthDate: string | null;
	descriptionParts: Set<string>;
};

export type MembershipSeed = {
	personName: string;
	projectName: string;
	fromDate: string;
	toDate: string | null;
	fromPrecision: string | null;
	toPrecision: string | null;
	support: boolean;
	note: string | null;
	instruments: string[];
};

type ParsedArgs = {
	output: string;
	personDir: string;
	biographyDir: string;
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_PERSON_DIR = join(ROOT, 'rawData', 'articles_by_category', 'person');
const DEFAULT_BIOGRAPHY_DIR = join(ROOT, 'rawData', 'articles_by_category', 'biography');
const DEFAULT_OUTPUT = join(ROOT, 'sql', 'people_seed.sql');

const PROJECT_NAME_BY_ENTRY = new Map<string, string>([
	['band:burger', 'BURGER NUDS'],
	['band:GDHM', 'Good Dog Happy Men'],
	['band:PtM', 'Poet-type.M'],
	['band:solo', '門田匡陽 (ソロ名義/2010)'],
	['band:solo2020', '門田匡陽 (ソロ名義/2020-)'],
	['band:sweetgirls', 'sweet girls'],
	['band:sunchester', 'サンチェスター・ユナイテッドFC'],
]);

const INSTRUMENT_ALIASES = new Map<string, string>([
	['vo', 'vocal'],
	['vocal', 'vocal'],
	['vocals', 'vocal'],
	['cho', 'chorus'],
	['chorus', 'chorus'],
	['gt', 'guitar'],
	['guitar', 'guitar'],
	['guitars', 'guitar'],
	['ba', 'bass'],
	['bass', 'bass'],
	['dr', 'drums'],
	['drums', 'drums'],
	['drum', 'drums'],
	['perc', 'percussion'],
	['percussion', 'percussion'],
	['key', 'keyboard'],
	['keys', 'keyboard'],
	['keyboard', 'keyboard'],
	['pf', 'piano'],
	['piano', 'piano'],
	['synth', 'synthesizer'],
	['synthesizer', 'synthesizer'],
	['program', 'programming'],
	['prog', 'programming'],
	['programming', 'programming'],
	['vn', 'violin'],
	['violin', 'violin'],
	['vj', 'vj'],
	['dance', 'dance'],
	['harp', 'harp'],
	['painting', 'painting'],
	['photo', 'photo'],
	['manipulator', 'manipulator'],
]);

function parseArgs(argv: string[]): ParsedArgs {
	let output = DEFAULT_OUTPUT;
	let personDir = DEFAULT_PERSON_DIR;
	let biographyDir = DEFAULT_BIOGRAPHY_DIR;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--output') {
			output = resolve(argv[++i] ?? DEFAULT_OUTPUT);
			continue;
		}
		if (arg === '--person-dir') {
			personDir = resolve(argv[++i] ?? DEFAULT_PERSON_DIR);
			continue;
		}
		if (arg === '--biography-dir') {
			biographyDir = resolve(argv[++i] ?? DEFAULT_BIOGRAPHY_DIR);
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return { output, personDir, biographyDir };
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

async function loadArticles(dir: string): Promise<SourceArticle[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.'))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b, 'ja'));

	const articles: SourceArticle[] = [];
	for (const file of files) {
		const path = join(dir, file);
		const raw = await readFile(path, 'utf8');
		const { meta, body } = parseFrontMatter(raw);
		articles.push({
			path,
			name: file,
			title: cleanText(String(meta.title ?? basename(file, extname(file)))),
			date: String(meta.date ?? '').slice(0, 10) || null,
			tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
			body,
		});
	}
	return articles;
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

function cleanText(value: string): string {
	return value
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\[\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\(\([^)]*\)\)/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
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
		info[item.slice(0, index).trim()] = cleanText(item.slice(index + 1));
	}
	return info;
}

function parseDateLike(value: string | null | undefined, end = false): { date: string | null; precision: string | null } {
	if (!value) return { date: null, precision: null };
	const text = value.trim().replaceAll(' ', '');

	let match = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
	if (match)
		return {
			date: `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`,
			precision: 'day',
		};

	match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (match)
		return {
			date: `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`,
			precision: 'day',
		};

	match = text.match(/(\d{4})年(\d{1,2})月/);
	if (match) {
		const year = Number(match[1]);
		const month = Number(match[2]);
		const day = end ? new Date(year, month, 0).getDate() : 1;
		return {
			date: `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
			precision: 'month',
		};
	}

	match = text.match(/(\d{4})/);
	if (match) return { date: `${match[1]}-${end ? '12-31' : '01-01'}`, precision: 'year' };

	return { date: null, precision: null };
}

function parsePeriod(value: string | null | undefined): {
	fromDate: string | null;
	toDate: string | null;
	fromPrecision: string | null;
	toPrecision: string | null;
} {
	if (!value) return { fromDate: null, toDate: null, fromPrecision: null, toPrecision: null };
	const parts = value
		.split(/[~〜～-]/)
		.map((part) => part.trim())
		.filter(Boolean);
	const from = parseDateLike(parts[0], false);
	const openEnded = /現在|現行|活動中|～\s*$|〜\s*$/.test(value);
	const to = parts.length > 1 && !openEnded ? parseDateLike(parts[parts.length - 1], true) : { date: null, precision: null };
	return {
		fromDate: from.date,
		toDate: to.date,
		fromPrecision: from.precision,
		toPrecision: to.precision,
	};
}

function projectType(name: string): string {
	const lowered = name.toLowerCase();
	if (name.includes('門田匡陽') || lowered.includes('solo')) return 'solo';
	return 'band';
}

function personNameFromHeading(value: string): string {
	return cleanText(value)
		.replace(/\s*\([^)]*\)\s*$/u, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function canonicalPersonName(value: string): string | null {
	let name = cleanText(value)
		.replace(/^\[|\]$/g, '')
		.replace(/\s*※\s*$/u, '')
		.replace(/（[^）]*）/g, '')
		.replace(/\([^)]*\)$/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	name = name.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '');
	name = name.replace(/^First Violin\s+|^Second Violin\s+|^Viola\s+|^Cello\s+/i, '').trim();
	name = resolvePersonAlias(name);
	if (!name || name === '友人' || name === '高校の友人' || name.startsWith('(')) return null;
	if (/^(ex\.|from\s|and\s|with\s)/i.test(name)) return null;
	return name;
}

function ensurePerson(people: Map<string, PersonSeed>, name: string): PersonSeed {
	const existing = people.get(name);
	if (existing) return existing;
	const seed = { name, birthDate: null, descriptionParts: new Set<string>() };
	people.set(name, seed);
	return seed;
}

function addRelatedPeople(article: SourceArticle, people: Map<string, PersonSeed>): void {
	const blocks = article.body.split(/^###\s+/gm).slice(1);
	for (const block of blocks) {
		const [headingLine = '', ...rest] = block.split(/\r?\n/);
		const names = personNamesFromHeading(headingLine);
		if (names.length === 0) continue;

		const body = rest.join('\n');
		const birth = body.match(/^\*\s*(?:誕生|誕生日):\s*(.+)$/m)?.[1];
		const birthDate = parseDateLike(birth, false).date;
		const roleLine = body.match(/^\*\s*担当:\s*(.+)$/m)?.[1];
		const bandLine = body.match(/^\*\s*主な参加バンド:\s*(.+)$/m)?.[1];

		for (const name of names) {
			const person = ensurePerson(people, name);
			if (birthDate) person.birthDate ??= birthDate;
			if (roleLine) person.descriptionParts.add(`担当: ${cleanText(roleLine)}`);
			if (bandLine) person.descriptionParts.add(`主な参加バンド: ${cleanText(bandLine)}`);
			person.descriptionParts.add(`source_file=${article.name}`);
		}
	}
}

function personNamesFromHeading(value: string): string[] {
	return splitPersonNameCandidates(personNameFromHeading(value))
		.map((candidate) => canonicalPersonName(candidate))
		.filter((name): name is string => Boolean(name));
}

function splitPersonNameCandidates(value: string): string[] {
	return value
		.split(/\s*(?:&| and |、)\s*/iu)
		.map((candidate) => candidate.trim())
		.filter(Boolean);
}

function addIndividualPerson(article: SourceArticle, people: Map<string, PersonSeed>): void {
	const name = canonicalPersonName(article.title.replace(/^\[人物\]\s*/, ''));
	if (!name) return;
	const person = ensurePerson(people, name);
	const basic = parseBasicInfo(parseSections(article.body)['基本情報'] ?? '');
	const birthDate = parseDateLike(basic['誕生日'] ?? article.date, false).date;
	if (birthDate) person.birthDate = birthDate;
	if (basic['読み']) person.descriptionParts.add(`読み: ${basic['読み']}`);
	if (basic['出身地']) person.descriptionParts.add(`出身地: ${basic['出身地']}`);
	person.descriptionParts.add(`source_file=${article.name}`);
}

function splitMemberLine(line: string): { name: string; instruments: string[]; period: string | null; note: string | null } | null {
	const item = line.trim().replace(/^[-*]\s+/, '');
	if (!item || item.startsWith('※') || item.startsWith('「')) return null;

	const withoutFootnote = item.replace(/\(\([^)]*\)\)/g, '').trim();
	const period = withoutFootnote.match(/\[([^\]]+)\]\s*$/)?.[1] ?? null;
	const withoutPeriod = withoutFootnote.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
	const roleMatch = withoutPeriod.match(/^(.*?)\s*[（(]([^（）()]*)[）)]/u);
	const nameText = roleMatch?.[1] ?? withoutPeriod;
	const roleText = roleMatch?.[2] ?? '';
	const name = canonicalPersonName(nameText);
	if (!name) return null;

	return {
		name,
		instruments: parseInstruments(roleText),
		period,
		note: cleanText(withoutFootnote) || null,
	};
}

function parseInstruments(value: string): string[] {
	const normalized = value
		.replace(/など|他|etc\.?/gi, '')
		.replace(/&/g, '/')
		.replace(/,/g, '/')
		.replace(/・/g, '/');
	const result: string[] = [];
	for (const token of normalized.split('/')) {
		const key = token.trim().replace(/\.$/, '').toLowerCase();
		const instrument = INSTRUMENT_ALIASES.get(key);
		if (instrument && !result.includes(instrument)) result.push(instrument);
	}
	return result;
}

function projectNameForBiography(article: SourceArticle): string {
	if (article.tags[1] && article.tags[1] !== 'Biography') return article.tags[1];
	return article.title;
}

function addBiographyMemberships(article: SourceArticle, people: Map<string, PersonSeed>, memberships: MembershipSeed[]): void {
	if (!article.tags.includes('参加バンド')) return;

	const sections = parseSections(article.body);
	const projectName = projectNameForBiography(article);
	const projectPeriod = parsePeriod(parseBasicInfo(sections['基本情報'] ?? '')['活動期間']);
	const defaultFrom = projectPeriod.fromDate ?? article.date ?? '1900-01-01';
	const defaultFromPrecision = projectPeriod.fromPrecision ?? (article.date ? 'day' : 'unknown');

	let inMembers = false;
	let support = false;
	for (const rawLine of article.body.split(/\r?\n/)) {
		const h2 = rawLine.match(/^##\s+(.+)$/);
		if (h2) {
			inMembers = h2[1]!.trim() === 'メンバー';
			support = false;
			continue;
		}
		if (!inMembers) continue;

		const h3 = rawLine.match(/^###\s+(.+)$/);
		if (h3) {
			support = h3[1]!.includes('サポート');
			continue;
		}
		if (!/^\s*[-*]\s+/.test(rawLine)) continue;

		const parsed = splitMemberLine(rawLine);
		if (!parsed) continue;

		ensurePerson(people, parsed.name).descriptionParts.add(`source_file=${article.name}`);
		const period = parsePeriod(parsed.period);
		memberships.push({
			personName: parsed.name,
			projectName,
			fromDate: period.fromDate ?? defaultFrom,
			toDate: period.toDate ?? projectPeriod.toDate,
			fromPrecision: period.fromPrecision ?? defaultFromPrecision,
			toPrecision: period.toPrecision ?? projectPeriod.toPrecision,
			support,
			note: parsed.note ?? `source_file=${article.name}`,
			instruments: parsed.instruments,
		});
	}
}

export function renderSql(people: Map<string, PersonSeed>, memberships: MembershipSeed[], biographyArticles: SourceArticle[]): string {
	const lines: string[] = [];
	const projectNames = new Set<string>();
	const instruments = new Set<string>();
	const roleId = stableUuid('role', 'performer');

	for (const article of biographyArticles) {
		if (article.tags.includes('参加バンド')) projectNames.add(projectNameForBiography(article));
	}
	for (const membership of memberships) {
		projectNames.add(membership.projectName);
		for (const instrument of membership.instruments) instruments.add(instrument);
	}

	lines.push('-- Generated by scripts/generate_people_seed_sql.ts');
	lines.push(`-- people: ${people.size}`);
	lines.push(`-- memberships: ${memberships.length}`);
	lines.push('BEGIN;');
	lines.push('');

	lines.push('INSERT INTO role (id, name, category, description)');
	lines.push(`VALUES (${sqlText(roleId)}, 'performer', 'performance', '演奏・パフォーマンス')`);
	lines.push('ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;');
	lines.push('');

	for (const instrument of [...instruments].sort((a, b) => a.localeCompare(b, 'ja'))) {
		const id = stableUuid('instrument', instrument);
		lines.push('INSERT INTO instrument (id, name, description)');
		lines.push(`VALUES (${sqlText(id)}, ${sqlText(instrument)}, NULL)`);
		lines.push('ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;');
		lines.push('');
	}

	for (const projectName of [...projectNames].sort((a, b) => a.localeCompare(b, 'ja'))) {
		const id = stableUuid('project', projectName);
		lines.push('INSERT INTO project (id, name, type, description, start_date, end_date)');
		lines.push(`VALUES (${sqlText(id)}, ${sqlText(projectName)}, ${sqlText(projectType(projectName))}, NULL, NULL, NULL)`);
		lines.push('ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type;');
		lines.push('');
	}

	for (const person of [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'))) {
		const id = stableUuid('person', person.name);
		const description = [...person.descriptionParts].join('\n') || null;
		lines.push('INSERT INTO person (id, name, description, birth_date, death_date, active_from, active_to)');
		lines.push(`VALUES (${sqlText(id)}, ${sqlText(person.name)}, ${sqlText(description)}, ${sqlText(person.birthDate)}, NULL, NULL, NULL)`);
		lines.push('ON CONFLICT (id) DO UPDATE');
		lines.push('SET name = EXCLUDED.name,');
		lines.push('    description = CASE');
		lines.push("      WHEN person.description = 'source=contribution_seed' THEN EXCLUDED.description");
		lines.push('      ELSE COALESCE(person.description, EXCLUDED.description)');
		lines.push('    END,');
		lines.push('    birth_date = COALESCE(person.birth_date, EXCLUDED.birth_date);');
		lines.push('');
	}

	const emittedMembershipKeys = new Set<string>();
	for (const membership of memberships.sort((a, b) => `${a.projectName}:${a.personName}`.localeCompare(`${b.projectName}:${b.personName}`, 'ja'))) {
		const personId = stableUuid('person', membership.personName);
		const projectId = stableUuid('project', membership.projectName);
		const membershipKey = `${membership.personName}|${membership.projectName}|${membership.fromDate}|${membership.toDate ?? ''}`;
		if (emittedMembershipKeys.has(membershipKey)) continue;
		emittedMembershipKeys.add(membershipKey);

		const membershipId = stableUuid('membership', membershipKey);
		lines.push('INSERT INTO membership (id, person_id, project_id, from_date, to_date, from_date_precision, to_date_precision, support, note)');
		lines.push(
			`VALUES (${sqlText(membershipId)}, ${sqlText(personId)}, ${sqlText(projectId)}, ${sqlText(membership.fromDate)}, ${sqlText(membership.toDate)}, ${sqlText(membership.fromPrecision)}, ${sqlText(membership.toPrecision)}, ${membership.support ? 'TRUE' : 'FALSE'}, ${sqlText(membership.note)})`,
		);
		lines.push('ON CONFLICT (id) DO UPDATE');
		lines.push('SET to_date = EXCLUDED.to_date,');
		lines.push('    from_date_precision = EXCLUDED.from_date_precision,');
		lines.push('    to_date_precision = EXCLUDED.to_date_precision,');
		lines.push('    support = EXCLUDED.support,');
		lines.push('    note = EXCLUDED.note;');
		lines.push('');

		const membershipInstruments = membership.instruments.length > 0 ? membership.instruments : [null];
		for (const instrument of membershipInstruments) {
			const instrumentId = instrument ? stableUuid('instrument', instrument) : null;
			const membershipRoleId = stableUuid('membership_role', `${membershipId}:${roleId}:${instrumentId ?? ''}`);
			lines.push('INSERT INTO membership_role (id, membership_id, role_id, instrument_id)');
			lines.push(`VALUES (${sqlText(membershipRoleId)}, ${sqlText(membershipId)}, ${sqlText(roleId)}, ${sqlText(instrumentId)})`);
			lines.push('ON CONFLICT (id) DO NOTHING;');
			lines.push('');
		}
	}

	lines.push('COMMIT;');
	lines.push('');
	return lines.join('\n');
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	const people = new Map<string, PersonSeed>();
	const memberships: MembershipSeed[] = [];
	const personArticles = await loadArticles(args.personDir);
	const biographyArticles = await loadArticles(args.biographyDir);

	for (const article of personArticles) {
		if (article.name === '2016-03-10-000000.md') addRelatedPeople(article, people);
		else addIndividualPerson(article, people);
	}
	for (const article of biographyArticles) {
		addBiographyMemberships(article, people, memberships);
	}

	const sql = renderSql(people, memberships, biographyArticles);
	await mkdir(dirname(args.output), { recursive: true });
	await writeFile(args.output, sql, 'utf8');
	console.log(`Wrote ${args.output}`);
	console.log(`People: ${people.size}`);
	console.log(`Memberships: ${memberships.length}`);
}

if (import.meta.main) await main();
