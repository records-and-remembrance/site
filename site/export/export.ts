import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultFixturePath = fileURLToPath(new URL('../fixtures/site.json', import.meta.url));
const defaultOutputPath = fileURLToPath(new URL('../src/data/site.generated.json', import.meta.url));

export type ExportSiteDataOptions = {
	fixturePath?: string;
	outputPath?: string;
};

const isExportableSnapshot = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== 'object' || value === null) return false;

	const snapshot = value as Record<string, unknown>;
	return typeof snapshot.title === 'string' && typeof snapshot.description === 'string';
};

export const exportSiteData = async ({ fixturePath = defaultFixturePath, outputPath = defaultOutputPath }: ExportSiteDataOptions = {}): Promise<void> => {
	const source = JSON.parse(await readFile(fixturePath, 'utf8')) as unknown;
	if (!isExportableSnapshot(source)) {
		throw new Error(`Invalid site fixture: ${fixturePath}`);
	}

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
};

if (import.meta.main) {
	await exportSiteData();
}
