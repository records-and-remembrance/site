import { buildEntityHref, type SiteEntityType } from './site-foundation';
import type { SiteRow } from '../../export/export';

export type DiscographyCard = {
	id: string;
	title: string;
	slug: string | null;
	href: string | undefined;
	projectName: string | null;
	releaseDate: string | null;
	releaseDatePrecision: string | null;
	format: string | null;
	artworkUrl: string | null;
	artworkWidth: number | null;
	artworkHeight: number | null;
};

export const buildDiscographyCards = (works: readonly SiteRow[], releases: readonly SiteRow[], projects: readonly SiteRow[]): DiscographyCard[] => {
	const projectNames = new Map(projects.map((project) => [stringValue(project.id), stringValue(project.name) || null]));
	const releasesByWork = new Map<string, SiteRow[]>();
	for (const release of releases) {
		const workId = stringValue(release.workId);
		const group = releasesByWork.get(workId) ?? [];
		group.push(release);
		releasesByWork.set(workId, group);
	}

	return [...works]
		.sort((left, right) => identifier(left).localeCompare(identifier(right)))
		.map((work) => {
			const release = [...(releasesByWork.get(identifier(work)) ?? [])].sort(compareRelease)[0];
			const slug = nullableString(work.slug);
			return {
				id: identifier(work),
				title: stringValue(work.title) || '無題',
				slug,
				href: buildEntityHref('work' as SiteEntityType, slug),
				projectName: projectNames.get(stringValue(work.projectId)) ?? null,
				releaseDate: nullableString(release?.releaseDate),
				releaseDatePrecision: nullableString(release?.releaseDatePrecision),
				format: nullableString(release?.format),
				artworkUrl: nullableString(release?.artworkUrl),
				artworkWidth: nullableInteger(release?.artworkWidth),
				artworkHeight: nullableInteger(release?.artworkHeight),
			};
		});
};

function compareRelease(left: SiteRow, right: SiteRow): number {
	const leftDate = nullableString(left.releaseDate) ?? '9999-99-99';
	const rightDate = nullableString(right.releaseDate) ?? '9999-99-99';
	return `${leftDate}:${identifier(left)}`.localeCompare(`${rightDate}:${identifier(right)}`);
}

function identifier(row: SiteRow): string {
	return stringValue(row.id);
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

function nullableInteger(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
