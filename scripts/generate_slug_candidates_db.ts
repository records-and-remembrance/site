import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';
import { buildSlugCandidateArtifact, renderSlugCandidateArtifact, SLUG_ENTITY_TYPES, type SlugEntityType, type SlugSnapshot, type SlugSourceRow } from './generate_slug_candidates';

type QueryResult = { rows: Array<Record<string, unknown>> };
export type Query = (text: string, values?: unknown[]) => Promise<QueryResult>;
export type SlugSourceReader = (entityType: SlugEntityType) => Promise<SlugSourceRow[]>;

const ROOT = resolve(import.meta.dir, '..');
const DEFAULT_OUTPUT = resolve(ROOT, 'drafts/slugs/slug-candidates.json');

const ENTITY_SOURCES: Record<SlugEntityType, { table: string; displayColumn: string }> = {
	project: { table: 'project', displayColumn: 'name' },
	person: { table: 'person', displayColumn: 'name' },
	composition: { table: 'composition', displayColumn: 'title' },
	work: { table: 'work', displayColumn: 'title' },
	venue: { table: 'venue', displayColumn: 'name' },
};

function normalizeRow(row: Record<string, unknown>): SlugSourceRow {
	return {
		id: String(row.id ?? ''),
		displayName: typeof row.displayName === 'string' ? row.displayName : '',
		slug: typeof row.slug === 'string' ? row.slug : null,
	};
}

export function createDatabaseSlugSource(query: Query): SlugSourceReader {
	return async (entityType) => {
		const { table, displayColumn } = ENTITY_SOURCES[entityType];
		const result = await query(`SELECT id::text AS id, "${displayColumn}" AS "displayName", slug FROM "${table}" ORDER BY id`, []);
		return result.rows.map(normalizeRow);
	};
}

export async function buildSlugSourceSnapshot(source: SlugSourceReader, sourceSnapshot: string): Promise<SlugSnapshot> {
	if (!sourceSnapshot.trim()) throw new Error('sourceSnapshot is required');

	const entries = await Promise.all(SLUG_ENTITY_TYPES.map(async (entityType) => [entityType, await source(entityType)] as const));
	return {
		sourceSnapshot,
		...Object.fromEntries(entries),
	} as SlugSnapshot;
}

type ParsedArgs = {
	output: string;
	sourceSnapshot: string;
};

export function parseArgs(argv: readonly string[]): ParsedArgs {
	let output = DEFAULT_OUTPUT;
	let sourceSnapshot: string | undefined;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--output' && argv[index + 1]) {
			output = argv[++index]!;
			continue;
		}
		if (arg === '--source-snapshot' && argv[index + 1]) {
			sourceSnapshot = argv[++index]!;
			continue;
		}
		throw new Error(`Unknown or incomplete argument: ${arg}`);
	}

	if (!sourceSnapshot?.trim()) throw new Error('--source-snapshot is required');
	return { output, sourceSnapshot };
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	const pool = new Pool({ connectionString: Bun.env.DATABASE_URL ?? 'postgres://monden:monden@localhost:5432/monden' });

	try {
		const source = createDatabaseSlugSource(async (text, values) => {
			const result = await pool.query(text, values);
			return { rows: result.rows as Array<Record<string, unknown>> };
		});
		const snapshot = await buildSlugSourceSnapshot(source, args.sourceSnapshot);
		const artifact = buildSlugCandidateArtifact(snapshot);
		await mkdir(dirname(args.output), { recursive: true });
		await writeFile(args.output, renderSlugCandidateArtifact(artifact), 'utf8');

		console.log(`Wrote ${args.output}`);
		console.log(`Slug candidates: ${artifact.summary.total}`);
		console.log(`Needs review: ${artifact.summary.needsReview}`);
		console.log(`Collisions: ${artifact.summary.collisions}`);
	} finally {
		await pool.end();
	}
}

if (import.meta.main) await main();
