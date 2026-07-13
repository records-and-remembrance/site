import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fixtureData from './site.json';

export type SiteSnapshot = {
	description: string;
	featuredProject: string;
	title: string;
};

const generatedPath = fileURLToPath(new URL('./site.generated.json', import.meta.url));

const isSiteSnapshot = (value: unknown): value is SiteSnapshot => {
	if (typeof value !== 'object' || value === null) return false;

	const snapshot = value as Record<string, unknown>;
	return typeof snapshot.description === 'string' && typeof snapshot.featuredProject === 'string' && typeof snapshot.title === 'string';
};

const loadGeneratedData = (): SiteSnapshot | undefined => {
	if (!existsSync(generatedPath)) return undefined;

	const parsed: unknown = JSON.parse(readFileSync(generatedPath, 'utf8'));
	if (!isSiteSnapshot(parsed)) {
		throw new Error(`Invalid site snapshot: ${generatedPath}`);
	}

	return parsed;
};

export const siteData: SiteSnapshot = loadGeneratedData() ?? fixtureData;
