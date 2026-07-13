import { buildEntityHref, type SiteEntityType } from './site-foundation';
import type { SiteRow } from '../../export/export';

export type DiscographyCard = {
	id: string;
	title: string;
	slug: string | null;
	href: string | undefined;
	projectName: string | null;
	projectSlug: string | null;
	releaseDate: string | null;
	releaseDatePrecision: string | null;
	format: string | null;
	artworkUrl: string | null;
	artworkWidth: number | null;
	artworkHeight: number | null;
	filterValues: {
		project: readonly string[];
		format: readonly string[];
		decade: readonly string[];
		editionType: readonly string[];
	};
};

export const buildDiscographyCards = (works: readonly SiteRow[], releases: readonly SiteRow[], projects: readonly SiteRow[]): DiscographyCard[] => {
	const projectMeta = new Map(projects.map((project) => [stringValue(project.id), { name: stringValue(project.name) || null, slug: nullableString(project.slug) }]));
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
			const workReleases = [...(releasesByWork.get(identifier(work)) ?? [])].sort(compareRelease);
			const release = workReleases[0];
			const slug = nullableString(work.slug);
			const project = projectMeta.get(stringValue(work.projectId));
			const filterValues = {
				project: project?.slug ? [project.slug] : [],
				format: uniqueStrings(workReleases.map((item) => nullableString(item.format)).filter((value): value is string => value !== null)),
				decade: uniqueStrings(workReleases.map((item) => decadeOf(nullableString(item.releaseDate))).filter((value): value is string => value !== null)),
				editionType: uniqueStrings(workReleases.map((item) => nullableString(item.editionType)).filter((value): value is string => value !== null)),
			};
			return {
				id: identifier(work),
				title: stringValue(work.title) || '無題',
				slug,
				href: buildEntityHref('work' as SiteEntityType, slug),
				projectName: project?.name ?? null,
				projectSlug: project?.slug ?? null,
				releaseDate: nullableString(release?.releaseDate),
				releaseDatePrecision: nullableString(release?.releaseDatePrecision),
				format: nullableString(release?.format),
				artworkUrl: nullableString(release?.artworkUrl),
				artworkWidth: nullableInteger(release?.artworkWidth),
				artworkHeight: nullableInteger(release?.artworkHeight),
				filterValues,
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

function uniqueStrings(values: readonly string[]): string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function decadeOf(value: string | null): string | null {
	if (!value) return null;
	const year = Number(value.slice(0, 4));
	return Number.isInteger(year) && year >= 0 ? `${Math.floor(year / 10) * 10}s` : null;
}
