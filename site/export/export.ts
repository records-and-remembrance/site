import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../app/db/schema';

const defaultFixturePath = fileURLToPath(new URL('../fixtures/site.json', import.meta.url));
const defaultOutputPath = fileURLToPath(new URL('../src/data/site.generated.json', import.meta.url));

export const SITE_TABLE_NAMES = [
	'project',
	'person',
	'membership',
	'role',
	'instrument',
	'membershipRole',
	'work',
	'workProject',
	'distributor',
	'release',
	'label',
	'labelRelation',
	'composition',
	'compositionCredit',
	'recordingReview',
	'recording',
	'track',
	'venue',
	'event',
	'eventPerformance',
	'contribution',
	'publication',
	'publicationIssue',
	'article',
	'articleMentionWork',
	'articleMentionEvent',
	'articleMentionPerson',
] as const;

export type SiteTableName = (typeof SITE_TABLE_NAMES)[number];
export type SiteRow = Record<string, unknown>;
export type SiteDatabaseRows = { [TableName in SiteTableName]: SiteRow[] };

export type SiteMeta = {
	title: string;
	description: string;
	featuredProject: string;
};

export type SiteDiagnostic = {
	code: string;
	table?: SiteTableName;
	field?: string;
	id?: string;
	message: string;
};

export type SiteDigEntry = {
	type: 'project' | 'person' | 'composition' | 'work' | 'venue' | 'event';
	slug: string;
	summary: string;
};

export type SiteMonthDayEntry = {
	type: 'event' | 'release';
	date: string;
	label: string;
	href: string;
	slug?: string;
	editionKey?: string;
};

export type SiteSnapshot = SiteMeta & {
	schemaVersion: 1;
	snapshotGeneratedAt: string;
	tables: SiteDatabaseRows;
	indexes: {
		dig: SiteDigEntry[];
		monthDay: Record<string, SiteMonthDayEntry[]>;
	};
	manifest: {
		schemaVersion: 1;
		snapshotGeneratedAt: string;
		contentHash: string;
		counts: Record<SiteTableName, number>;
		errors: SiteDiagnostic[];
		warnings: SiteDiagnostic[];
	};
};

export type SiteDataSource = {
	readRows: () => Promise<SiteDatabaseRows>;
};

export class SiteExportError extends Error {
	constructor(readonly diagnostics: readonly SiteDiagnostic[]) {
		super(`site export has contract errors (${diagnostics.length})`);
	}
}

const DEFAULT_SITE_META: SiteMeta = {
	title: '門田匡陽アーカイブ',
	description: '門田匡陽の活動と作品をたどる公開アーカイブ。',
	featuredProject: 'BURGER NUDS',
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DATE_FIELDS: Partial<Record<SiteTableName, readonly string[]>> = {
	project: ['startDate', 'endDate'],
	person: ['birthDate', 'deathDate', 'activeFrom', 'activeTo'],
	membership: ['fromDate', 'toDate'],
	work: ['createdDate', 'releasedDate'],
	release: ['releaseDate', 'recordedFrom', 'recordedTo'],
	recording: ['recordedDate', 'recordedFrom', 'recordedTo', 'releaseDate'],
	track: ['recordedDate'],
	event: ['eventDate'],
	publicationIssue: ['publishedDate'],
	article: ['publishedDate'],
};
const TIMESTAMP_FIELDS: Partial<Record<SiteTableName, readonly string[]>> = {
	recordingReview: ['reviewedAt'],
	article: ['createdAt', 'updatedAt'],
};

type ForeignKey = {
	table: SiteTableName;
	field: string;
	target: SiteTableName;
	optional?: boolean;
};

const FOREIGN_KEYS: readonly ForeignKey[] = [
	{ table: 'membership', field: 'personId', target: 'person' },
	{ table: 'membership', field: 'projectId', target: 'project' },
	{ table: 'membershipRole', field: 'membershipId', target: 'membership' },
	{ table: 'membershipRole', field: 'roleId', target: 'role' },
	{ table: 'membershipRole', field: 'instrumentId', target: 'instrument', optional: true },
	{ table: 'work', field: 'projectId', target: 'project' },
	{ table: 'workProject', field: 'workId', target: 'work' },
	{ table: 'workProject', field: 'projectId', target: 'project' },
	{ table: 'release', field: 'workId', target: 'work' },
	{ table: 'release', field: 'distributorId', target: 'distributor', optional: true },
	{ table: 'release', field: 'reissueOfReleaseId', target: 'release', optional: true },
	{ table: 'labelRelation', field: 'releaseId', target: 'release' },
	{ table: 'labelRelation', field: 'labelId', target: 'label' },
	{ table: 'compositionCredit', field: 'compositionId', target: 'composition' },
	{ table: 'compositionCredit', field: 'personId', target: 'person' },
	{ table: 'recordingReview', field: 'compositionId', target: 'composition' },
	{ table: 'recording', field: 'compositionId', target: 'composition' },
	{ table: 'track', field: 'releaseId', target: 'release' },
	{ table: 'track', field: 'recordingId', target: 'recording' },
	{ table: 'event', field: 'projectId', target: 'project' },
	{ table: 'event', field: 'venueId', target: 'venue' },
	{ table: 'eventPerformance', field: 'eventId', target: 'event' },
	{ table: 'eventPerformance', field: 'compositionId', target: 'composition' },
	{ table: 'contribution', field: 'personId', target: 'person' },
	{ table: 'contribution', field: 'roleId', target: 'role' },
	{ table: 'contribution', field: 'instrumentId', target: 'instrument', optional: true },
	{ table: 'contribution', field: 'recordingId', target: 'recording', optional: true },
	{ table: 'contribution', field: 'releaseId', target: 'release', optional: true },
	{ table: 'contribution', field: 'eventId', target: 'event', optional: true },
	{ table: 'publicationIssue', field: 'publicationId', target: 'publication' },
	{ table: 'article', field: 'publicationIssueId', target: 'publicationIssue', optional: true },
	{ table: 'articleMentionWork', field: 'articleId', target: 'article' },
	{ table: 'articleMentionWork', field: 'workId', target: 'work' },
	{ table: 'articleMentionEvent', field: 'articleId', target: 'article' },
	{ table: 'articleMentionEvent', field: 'eventId', target: 'event' },
	{ table: 'articleMentionPerson', field: 'articleId', target: 'article' },
	{ table: 'articleMentionPerson', field: 'personId', target: 'person' },
];

const cloneRows = (rows: SiteDatabaseRows): SiteDatabaseRows => {
	const result = {} as SiteDatabaseRows;
	for (const tableName of SITE_TABLE_NAMES) {
		result[tableName] = (rows[tableName] ?? []).map((row) => stableValue({ ...row }) as SiteRow).sort((left, right) => rowIdentifier(left).localeCompare(rowIdentifier(right)));
	}
	return result;
};

export const emptySiteDatabaseRows = (): SiteDatabaseRows => {
	const rows = {} as SiteDatabaseRows;
	for (const tableName of SITE_TABLE_NAMES) rows[tableName] = [];
	return rows;
};

export const createMemorySiteDataSource = (rows: SiteDatabaseRows): SiteDataSource => ({
	readRows: async () => cloneRows(rows),
});

export const createSiteSnapshot = (rows: SiteDatabaseRows, options: { snapshotGeneratedAt: string; siteMeta?: SiteMeta }): SiteSnapshot => {
	const { snapshotGeneratedAt, siteMeta = DEFAULT_SITE_META } = options;
	const tables = withStableKeys(cloneRows(rows));
	const diagnostics = collectDiagnostics(tables);
	const indexes = buildIndexes(tables);
	const counts = Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, tables[tableName].length])) as Record<SiteTableName, number>;
	const unsignedSnapshot = {
		...siteMeta,
		schemaVersion: 1 as const,
		snapshotGeneratedAt,
		tables,
		indexes,
		manifest: {
			schemaVersion: 1 as const,
			snapshotGeneratedAt,
			contentHash: '',
			counts,
			errors: diagnostics.errors,
			warnings: diagnostics.warnings,
		},
	};
	const contentHash = createHash('sha256').update(stableStringify(unsignedSnapshot)).digest('hex');
	return {
		...unsignedSnapshot,
		manifest: { ...unsignedSnapshot.manifest, contentHash },
	};
};

export const assertSiteSnapshotExportable = (snapshot: SiteSnapshot): void => {
	if (snapshot.manifest.errors.length > 0) throw new SiteExportError(snapshot.manifest.errors);
};

export const stableStringify = (value: unknown): string => JSON.stringify(stableValue(value));

export const writeSiteSnapshotAtomically = async (snapshot: SiteSnapshot, outputPath: string = defaultOutputPath): Promise<void> => {
	assertSiteSnapshotExportable(snapshot);
	const parent = dirname(outputPath);
	await mkdir(parent, { recursive: true });
	const temporaryDirectory = await mkdtemp(join(parent, '.site-export-'));
	const temporaryPath = join(temporaryDirectory, basename(outputPath));
	try {
		await writeFile(temporaryPath, `${stableStringify(snapshot)}\n`, 'utf8');
		await rename(temporaryPath, outputPath);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
};

export type ExportSiteDataOptions = {
	fixturePath?: string;
	outputPath?: string;
	dataSource?: SiteDataSource;
	snapshotGeneratedAt?: string;
	siteMeta?: SiteMeta;
};

export const exportSiteData = async ({
	fixturePath = defaultFixturePath,
	outputPath = defaultOutputPath,
	dataSource,
	snapshotGeneratedAt,
	siteMeta,
}: ExportSiteDataOptions = {}): Promise<SiteSnapshot> => {
	const fixtureMeta = JSON.parse(await readFile(fixturePath, 'utf8')) as Partial<SiteMeta>;
	const meta: SiteMeta = siteMeta ?? {
		title: fixtureMeta.title ?? DEFAULT_SITE_META.title,
		description: fixtureMeta.description ?? DEFAULT_SITE_META.description,
		featuredProject: fixtureMeta.featuredProject ?? DEFAULT_SITE_META.featuredProject,
	};
	if (!snapshotGeneratedAt) throw new Error('snapshotGeneratedAt must be explicit (--snapshot-generated-at or SNAPSHOT_GENERATED_AT)');
	const source = dataSource ?? createMemorySiteDataSource(emptySiteDatabaseRows());
	const snapshot = createSiteSnapshot(await source.readRows(), { snapshotGeneratedAt, siteMeta: meta });
	await writeSiteSnapshotAtomically(snapshot, outputPath);
	return snapshot;
};

export const createPostgresSiteDataSource = (pool: Pool): SiteDataSource => {
	const db = drizzle(pool);
	return {
		readRows: async () => {
			const [
				project,
				person,
				membership,
				role,
				instrument,
				membershipRole,
				work,
				workProject,
				distributor,
				release,
				label,
				labelRelation,
				composition,
				compositionCredit,
				recordingReview,
				recording,
				track,
				venue,
				event,
				eventPerformance,
				contribution,
				publication,
				publicationIssue,
				article,
				articleMentionWork,
				articleMentionEvent,
				articleMentionPerson,
			] = await Promise.all([
				db.select().from(schema.project),
				db.select().from(schema.person),
				db.select().from(schema.membership),
				db.select().from(schema.role),
				db.select().from(schema.instrument),
				db.select().from(schema.membershipRole),
				db.select().from(schema.work),
				db.select().from(schema.workProject),
				db.select().from(schema.distributor),
				db.select().from(schema.release),
				db.select().from(schema.label),
				db.select().from(schema.labelRelation),
				db.select().from(schema.composition),
				db.select().from(schema.compositionCredit),
				db.select().from(schema.recordingReview),
				db.select().from(schema.recording),
				db.select().from(schema.track),
				db.select().from(schema.venue),
				db.select().from(schema.event),
				db.select().from(schema.eventPerformance),
				db.select().from(schema.contribution),
				db.select().from(schema.publication),
				db.select().from(schema.publicationIssue),
				db.select().from(schema.article),
				db.select().from(schema.articleMentionWork),
				db.select().from(schema.articleMentionEvent),
				db.select().from(schema.articleMentionPerson),
			]);
			return {
				project,
				person,
				membership,
				role,
				instrument,
				membershipRole,
				work,
				workProject,
				distributor,
				release,
				label,
				labelRelation,
				composition,
				compositionCredit,
				recordingReview,
				recording,
				track,
				venue,
				event,
				eventPerformance,
				contribution,
				publication,
				publicationIssue,
				article,
				articleMentionWork,
				articleMentionEvent,
				articleMentionPerson,
			} as unknown as SiteDatabaseRows;
		},
	};
};

type ParsedArgs = {
	fixture: boolean;
	snapshotGeneratedAt: string;
	outputPath: string;
};

export const parseArgs = (argv: readonly string[], environment: Record<string, string | undefined> = Bun.env): ParsedArgs => {
	let fixture = false;
	let outputPath = defaultOutputPath;
	let snapshotGeneratedAt = environment.SNAPSHOT_GENERATED_AT ?? '';
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--fixture') {
			fixture = true;
			continue;
		}
		if (arg === '--snapshot-generated-at' && argv[index + 1]) {
			snapshotGeneratedAt = argv[++index]!;
			continue;
		}
		if (arg === '--output' && argv[index + 1]) {
			outputPath = argv[++index]!;
			continue;
		}
		throw new Error(`Unknown or incomplete argument: ${arg}`);
	}
	if (!snapshotGeneratedAt) throw new Error('snapshotGeneratedAt must be explicit (--snapshot-generated-at or SNAPSHOT_GENERATED_AT)');
	return { fixture, snapshotGeneratedAt, outputPath };
};

function withStableKeys(rows: SiteDatabaseRows): SiteDatabaseRows {
	rows.release = assignStableKeys(rows.release, 'editionKey', (row) => [row.format, row.releaseDate, row.catalogNumber].filter(isPresent).join('-') || 'edition');
	rows.publication = assignStableKeys(rows.publication, 'libraryKey', (row) => stringValue(row.name) || 'publication');
	const publicationKeys = new Map(rows.publication.map((row) => [stringValue(row.id), stringValue(row.libraryKey)]));
	rows.publicationIssue = assignStableKeys(
		rows.publicationIssue,
		'libraryKey',
		(row) => [publicationKeys.get(stringValue(row.publicationId)), row.issueNumber, row.volume, row.publishedDate].filter(isPresent).join('-') || 'issue',
	);
	const issueKeys = new Map(rows.publicationIssue.map((row) => [stringValue(row.id), stringValue(row.libraryKey)]));
	rows.article = assignStableKeys(
		rows.article,
		'libraryKey',
		(row) => [issueKeys.get(stringValue(row.publicationIssueId)), row.title].filter(isPresent).join('-') || `article-${normalizeKey(stringValue(row.title))}`,
	);
	return rows;
}

function assignStableKeys(rows: readonly SiteRow[], field: string, baseKey: (row: SiteRow) => string): SiteRow[] {
	const grouped = new Map<string, SiteRow[]>();
	for (const row of rows) {
		const base = normalizeKey(baseKey(row));
		const group = grouped.get(base) ?? [];
		group.push(row);
		grouped.set(base, group);
	}
	const result: SiteRow[] = [];
	for (const [base, group] of grouped) {
		group.sort((left, right) => rowIdentifier(left).localeCompare(rowIdentifier(right)));
		group.forEach((row, index) => result.push({ ...row, [field]: index === 0 ? base : `${base}-${index + 1}` }));
	}
	return result.sort((left, right) => rowIdentifier(left).localeCompare(rowIdentifier(right)));
}

function collectDiagnostics(tables: SiteDatabaseRows): { errors: SiteDiagnostic[]; warnings: SiteDiagnostic[] } {
	const errors: SiteDiagnostic[] = [];
	const warnings: SiteDiagnostic[] = [];
	const ids = new Map<SiteTableName, Set<string>>();
	for (const tableName of SITE_TABLE_NAMES) ids.set(tableName, new Set(tables[tableName].map(rowIdentifier)));

	for (const reference of FOREIGN_KEYS) {
		for (const row of tables[reference.table]) {
			const value = row[reference.field];
			if ((value === null || value === undefined || value === '') && reference.optional) continue;
			if (typeof value !== 'string' || !ids.get(reference.target)!.has(value)) {
				errors.push({
					code: 'REFERENCE_MISSING',
					table: reference.table,
					field: reference.field,
					id: rowIdentifier(row),
					message: `${reference.table}.${reference.field} points to a missing ${reference.target}`,
				});
			}
		}
	}

	for (const tableName of SITE_TABLE_NAMES) {
		for (const row of tables[tableName]) {
			for (const field of DATE_FIELDS[tableName] ?? []) {
				const value = row[field];
				if (value === null || value === undefined || value === '') continue;
				if (typeof value !== 'string' || !isValidDate(value)) {
					errors.push({ code: 'DATE_INVALID', table: tableName, field, id: rowIdentifier(row), message: `${tableName}.${field} is not a valid calendar date` });
				}
			}
			for (const field of TIMESTAMP_FIELDS[tableName] ?? []) {
				const value = row[field];
				if (value !== null && value !== undefined && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) {
					errors.push({ code: 'TIMESTAMP_INVALID', table: tableName, field, id: rowIdentifier(row), message: `${tableName}.${field} is not a valid timestamp` });
				}
			}
		}
	}

	for (const row of tables.release) {
		const precision = row.releaseDatePrecision;
		if (precision !== null && precision !== undefined && precision !== '' && row.releaseDate === null) {
			errors.push({ code: 'DATE_PRECISION_CONFLICT', table: 'release', field: 'releaseDatePrecision', id: rowIdentifier(row), message: 'releaseDatePrecision cannot be set when releaseDate is NULL' });
		}
		const hasArtwork = [row.artworkUrl, row.artworkWidth, row.artworkHeight].some(isPresent);
		const completeArtwork = [row.artworkUrl, row.artworkWidth, row.artworkHeight].every(isPresent);
		if (
			hasArtwork !== completeArtwork ||
			(completeArtwork && (!Number.isInteger(row.artworkWidth) || !Number.isInteger(row.artworkHeight) || Number(row.artworkWidth) <= 0 || Number(row.artworkHeight) <= 0))
		) {
			errors.push({ code: 'ARTWORK_METADATA_INCONSISTENT', table: 'release', id: rowIdentifier(row), message: 'artworkUrl, artworkWidth, artworkHeight must be all NULL or a valid complete tuple' });
		}
	}

	for (const row of tables.contribution) {
		const targetCount = ['recordingId', 'releaseId', 'eventId'].filter((field) => isPresent(row[field])).length;
		if (targetCount !== 1) errors.push({ code: 'CONTRIBUTION_TARGET_INVALID', table: 'contribution', id: rowIdentifier(row), message: 'contribution must reference exactly one target' });
	}

	const publicProjectIds = new Set(tables.project.filter((row) => row.scope !== 'external').map(rowIdentifier));
	const slugTargets: Array<{ table: SiteTableName; rows: readonly SiteRow[] }> = [
		{ table: 'project', rows: tables.project.filter((row) => publicProjectIds.has(rowIdentifier(row))) },
		{ table: 'person', rows: tables.person },
		{ table: 'composition', rows: tables.composition },
		{ table: 'work', rows: tables.work.filter((row) => publicProjectIds.has(stringValue(row.projectId))) },
		{ table: 'venue', rows: tables.venue },
		{ table: 'event', rows: tables.event.filter((row) => publicProjectIds.has(stringValue(row.projectId))) },
	];
	for (const target of slugTargets) {
		for (const row of target.rows) {
			const slug = row.slug;
			if (typeof slug !== 'string' || !slug) {
				errors.push({ code: 'PUBLIC_SLUG_MISSING', table: target.table, field: 'slug', id: rowIdentifier(row), message: `${target.table} has no published slug` });
			} else if (!SLUG_PATTERN.test(slug)) {
				errors.push({ code: 'SLUG_INVALID', table: target.table, field: 'slug', id: rowIdentifier(row), message: `${target.table}.slug is not URL-safe` });
			}
		}
	}

	const optionalFields: Array<{ table: SiteTableName; field: string }> = [
		{ table: 'project', field: 'description' },
		{ table: 'person', field: 'description' },
		{ table: 'work', field: 'description' },
		{ table: 'venue', field: 'description' },
		{ table: 'publication', field: 'description' },
		{ table: 'article', field: 'summary' },
		{ table: 'article', field: 'content' },
		{ table: 'article', field: 'url' },
	];
	for (const { table, field } of optionalFields) {
		for (const row of tables[table]) {
			if (row[field] === null || row[field] === undefined || row[field] === '')
				warnings.push({ code: 'OPTIONAL_FIELD_MISSING', table, field, id: rowIdentifier(row), message: `${table}.${field} is absent and will be omitted by the UI` });
		}
	}

	return { errors, warnings };
}

function buildIndexes(tables: SiteDatabaseRows): SiteSnapshot['indexes'] {
	const publicProjectIds = new Set(tables.project.filter((row) => row.scope !== 'external').map(rowIdentifier));
	const dig: SiteDigEntry[] = [];
	const addDig = (type: SiteDigEntry['type'], row: SiteRow, summary: unknown): void => {
		if (typeof row.slug === 'string' && row.slug && typeof summary === 'string' && summary) dig.push({ type, slug: row.slug, summary });
	};
	for (const row of tables.project) if (publicProjectIds.has(rowIdentifier(row))) addDig('project', row, row.name);
	for (const row of tables.person) addDig('person', row, row.name);
	for (const row of tables.composition) addDig('composition', row, row.title);
	for (const row of tables.work) if (publicProjectIds.has(stringValue(row.projectId))) addDig('work', row, row.title);
	for (const row of tables.venue) addDig('venue', row, row.name);
	for (const row of tables.event) if (publicProjectIds.has(stringValue(row.projectId))) addDig('event', row, row.eventName ?? row.eventDate);
	dig.sort((left, right) => `${left.type}:${left.slug}`.localeCompare(`${right.type}:${right.slug}`));

	const workById = new Map(tables.work.map((row) => [rowIdentifier(row), row]));
	const monthDay: Record<string, SiteMonthDayEntry[]> = {};
	const addMonthDay = (date: unknown, entry: SiteMonthDayEntry): void => {
		if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return;
		const key = date.slice(5);
		(monthDay[key] ??= []).push(entry);
	};
	for (const row of tables.event) {
		if (!publicProjectIds.has(stringValue(row.projectId)) || typeof row.slug !== 'string') continue;
		addMonthDay(row.eventDate, { type: 'event', date: stringValue(row.eventDate), label: stringValue(row.eventName) || stringValue(row.eventDate), href: `/lives/${row.slug}`, slug: row.slug });
	}
	for (const row of tables.release) {
		const work = workById.get(stringValue(row.workId));
		if (!work || !publicProjectIds.has(stringValue(work.projectId)) || typeof work.slug !== 'string' || typeof row.editionKey !== 'string') continue;
		addMonthDay(row.releaseDate, {
			type: 'release',
			date: stringValue(row.releaseDate),
			label: stringValue(work.title),
			href: `/discography/${work.slug}#edition-${row.editionKey}`,
			editionKey: row.editionKey,
		});
	}
	for (const entries of Object.values(monthDay)) entries.sort((left, right) => `${left.date}:${left.type}:${left.href}`.localeCompare(`${right.date}:${right.type}:${right.href}`));
	return { dig, monthDay };
}

function normalizeKey(value: string): string {
	const normalized = value
		.normalize('NFKC')
		.trim()
		.toLocaleLowerCase('en-US')
		.replace(/\s+/gu, '-')
		.replace(/[^\p{Letter}\p{Number}-]+/gu, '')
		.replace(/-+/gu, '-')
		.replace(/^-|-$/gu, '');
	return normalized || 'item';
}

function stableValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stableValue);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, nested]) => [key, stableValue(nested)]),
		);
	}
	return value;
}

function rowIdentifier(row: SiteRow): string {
	return stringValue(row.id) || stringValue(row.compositionId) || stringValue(row.articleId) || '';
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function isPresent(value: unknown): boolean {
	return value !== null && value !== undefined && value !== '';
}

function isValidDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
	const date = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

async function main(): Promise<void> {
	const { fixture, snapshotGeneratedAt, outputPath } = parseArgs(Bun.argv.slice(2));
	if (fixture) {
		await exportSiteData({ outputPath, snapshotGeneratedAt });
		return;
	}

	const pool = new Pool({ connectionString: Bun.env.DATABASE_URL ?? 'postgres://monden:monden@localhost:5432/monden' });
	try {
		await exportSiteData({ outputPath, snapshotGeneratedAt, dataSource: createPostgresSiteDataSource(pool) });
	} finally {
		await pool.end();
	}
}

if (import.meta.main) await main();
