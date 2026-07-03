import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMagazineTsv, type ClassificationSource, type MagazineReviewRecord, type ReviewStatus } from './lib/magazineTsv';

type ParsedArgs = {
	input: string;
	output: string;
};

export type MagazineReviewArtifact = {
	schemaVersion: 1;
	generatedBy: 'scripts/generate_magazine_review.ts';
	sourceFile: 'rawData/monden-magazine.tsv';
	summary: {
		sourceRows: number;
		articleCandidates: number;
		reviewStatuses: Record<ReviewStatus, number>;
		classificationSources: Record<ClassificationSource, number>;
		parserDiagnostics: string[];
	};
	records: MagazineReviewRecord[];
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_INPUT = join(ROOT, 'rawData', 'monden-magazine.tsv');
const DEFAULT_OUTPUT = join(ROOT, 'drafts', 'magazines', 'monden-magazine.json');

export function parseArgs(argv: string[]): ParsedArgs {
	let input = DEFAULT_INPUT;
	let output = DEFAULT_OUTPUT;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--input' && argv[index + 1]) {
			input = argv[++index]!;
			continue;
		}
		if (arg === '--output' && argv[index + 1]) {
			output = argv[++index]!;
			continue;
		}
		throw new Error(`Unknown or incomplete argument: ${arg}`);
	}

	return { input, output };
}

function countBy<T extends string>(values: T[], keys: T[]): Record<T, number> {
	return Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])) as Record<T, number>;
}

export function buildMagazineReviewArtifact(source: string): MagazineReviewArtifact {
	const parsed = parseMagazineTsv(source);
	return {
		schemaVersion: 1,
		generatedBy: 'scripts/generate_magazine_review.ts',
		sourceFile: 'rawData/monden-magazine.tsv',
		summary: {
			sourceRows: parsed.records.length,
			articleCandidates: parsed.records.reduce((total, record) => total + record.articles.length, 0),
			reviewStatuses: countBy(
				parsed.records.map((record) => record.reviewStatus),
				['confirmed', 'inferred', 'unresolved', 'not_published'],
			),
			classificationSources: countBy(
				parsed.records.map((record) => record.classificationSource),
				['explicit', 'inferred', 'unresolved'],
			),
			parserDiagnostics: parsed.diagnostics,
		},
		records: parsed.records,
	};
}

async function formatOutput(output: string): Promise<void> {
	const formatter = Bun.spawn(['bunx', 'oxfmt', '--write', output], {
		cwd: ROOT,
		stdout: 'ignore',
		stderr: 'inherit',
	});
	const exitCode = await formatter.exited;
	if (exitCode !== 0) throw new Error(`oxfmt failed with exit code ${exitCode}`);
}

async function main(): Promise<void> {
	const args = parseArgs(Bun.argv.slice(2));
	const input = resolve(args.input);
	const output = resolve(args.output);
	const source = await readFile(input, 'utf8');
	const artifact = buildMagazineReviewArtifact(source);

	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, `${JSON.stringify(artifact, null, '\t')}\n`, 'utf8');
	await formatOutput(output);

	console.log(`Wrote ${output}`);
	console.log(`Source rows: ${artifact.summary.sourceRows}`);
	console.log(`Article candidates: ${artifact.summary.articleCandidates}`);
	console.log(`Review statuses: ${JSON.stringify(artifact.summary.reviewStatuses)}`);
}

if (import.meta.main) {
	await main();
}
