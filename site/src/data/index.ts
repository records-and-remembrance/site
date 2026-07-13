import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fixtureData from './site.json';
import type { SiteDatabaseRows, SiteSnapshot as ExportSiteSnapshot, SiteTableName } from '../../export/export';

export type SiteSnapshot = ExportSiteSnapshot;

const TABLE_NAMES: readonly SiteTableName[] = [
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
];

const generatedPathCandidates = (): string[] =>
	[process.env.SITE_DATA_PATH, join(process.cwd(), 'site/src/data/site.generated.json'), join(process.cwd(), 'src/data/site.generated.json')].filter((path): path is string => Boolean(path));

const isSiteSnapshot = (value: unknown): value is SiteSnapshot => {
	if (typeof value !== 'object' || value === null) return false;
	const snapshot = value as Record<string, unknown>;
	if (typeof snapshot.description !== 'string' || typeof snapshot.featuredProject !== 'string' || typeof snapshot.title !== 'string') return false;
	if (snapshot.schemaVersion === undefined) return true;
	if (
		snapshot.schemaVersion !== 1 ||
		typeof snapshot.snapshotGeneratedAt !== 'string' ||
		typeof snapshot.tables !== 'object' ||
		snapshot.tables === null ||
		typeof snapshot.indexes !== 'object' ||
		snapshot.indexes === null ||
		typeof snapshot.manifest !== 'object' ||
		snapshot.manifest === null
	)
		return false;
	return TABLE_NAMES.every((tableName) => Array.isArray((snapshot.tables as Record<string, unknown>)[tableName]));
};

const emptyTables = (): SiteDatabaseRows => {
	const tables = {} as SiteDatabaseRows;
	for (const tableName of TABLE_NAMES) tables[tableName] = [];
	return tables;
};

const fixtureSnapshot = (): SiteSnapshot => {
	const meta = fixtureData as { title: string; description: string; featuredProject: string };
	return {
		...meta,
		schemaVersion: 1,
		snapshotGeneratedAt: '',
		tables: emptyTables(),
		indexes: { dig: [], monthDay: {} },
		manifest: {
			schemaVersion: 1,
			snapshotGeneratedAt: '',
			contentHash: '',
			counts: Object.fromEntries(TABLE_NAMES.map((tableName) => [tableName, 0])) as Record<SiteTableName, number>,
			errors: [],
			warnings: [],
		},
	};
};

const loadGeneratedData = (): SiteSnapshot | undefined => {
	for (const generatedPath of generatedPathCandidates()) {
		if (!existsSync(generatedPath)) continue;
		const parsed: unknown = JSON.parse(readFileSync(generatedPath, 'utf8'));
		if (!isSiteSnapshot(parsed) || parsed.schemaVersion !== 1) throw new Error(`Invalid site snapshot: ${generatedPath}`);
		return parsed;
	}
	return undefined;
};

export const siteData: SiteSnapshot = loadGeneratedData() ?? fixtureSnapshot();

export const siteTableRows = <TableName extends SiteTableName>(tableName: TableName): SiteDatabaseRows[TableName] => siteData.tables[tableName];
