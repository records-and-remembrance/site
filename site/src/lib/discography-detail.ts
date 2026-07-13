import { buildEntityHref, type AdjacentLink, type SiteEntityType } from './site-foundation';
import type { SiteRow } from '../../export/export';

export type DiscographyDetailSource = {
	work: readonly SiteRow[];
	project: readonly SiteRow[];
	workProject: readonly SiteRow[];
	release: readonly SiteRow[];
	distributor: readonly SiteRow[];
	label: readonly SiteRow[];
	labelRelation: readonly SiteRow[];
	track: readonly SiteRow[];
	recording: readonly SiteRow[];
	composition: readonly SiteRow[];
	person: readonly SiteRow[];
	role: readonly SiteRow[];
	instrument: readonly SiteRow[];
	contribution: readonly SiteRow[];
};

export type DiscographyEntityLink = {
	name: string;
	href?: string;
	slug?: string | null;
};

export type DiscographyTrack = {
	id: string;
	trackNumber: number;
	title: string;
	href?: string;
	composition: { title: string; href?: string };
	recording: { versionName: string | null; type: string | null };
};

export type DiscographyTrackDiff = {
	kind: 'added' | 'removed' | 'changed';
	trackNumber: number;
	title: string;
	href?: string;
	versionName: string | null;
	type: string | null;
};

export type DiscographyContribution = {
	person: DiscographyEntityLink;
	role: string;
	instrument: string | null;
};

export type DiscographyEditionLink = {
	label: string;
	href: string;
};

export type DiscographyEdition = {
	id: string;
	editionKey: string | null;
	anchor: string | null;
	format: string | null;
	catalogNumber: string | null;
	releaseDate: string | null;
	releaseDatePrecision: string | null;
	editionType: string | null;
	description: string | null;
	notes: string | null;
	artwork: { url: string | null; width: number | null; height: number | null };
	distributor: DiscographyEntityLink | null;
	labels: DiscographyEntityLink[];
	tracks: DiscographyTrack[];
	hasTracks: boolean;
	trackDiffs: DiscographyTrackDiff[];
	contributions: DiscographyContribution[];
	reissueOf: DiscographyEditionLink | null;
	reissues: DiscographyEditionLink[];
};

export type DiscographyDetail = {
	work: {
		id: string;
		title: string;
		slug: string;
		description: string | null;
		type: string | null;
		releasedDate: string | null;
		releasedDatePrecision: string | null;
		project: DiscographyEntityLink | null;
	};
	representativeRelease: DiscographyEdition;
	releases: DiscographyEdition[];
	relatedLinks: AdjacentLink[];
};

export const buildDiscographyDetail = (source: DiscographyDetailSource, slug: string | undefined): DiscographyDetail | null => {
	const workRow = source.work.find((row) => stringValue(row.slug) === slug && Boolean(buildEntityHref('work', slug)));
	if (!workRow) return null;

	const projects = indexById(source.project);
	const project = projects.get(stringValue(workRow.projectId));
	const workId = stringValue(workRow.id);
	const projectLink = project ? { ...entityLink('project', project), slug: nullableString(project.slug) } : null;
	const releases = prepareReleases(source.release.filter((row) => stringValue(row.workId) === workId));
	const recordings = indexById(source.recording);
	const compositions = indexById(source.composition);
	const distributors = indexById(source.distributor);
	const labels = indexById(source.label);
	const people = indexById(source.person);
	const roles = indexById(source.role);
	const instruments = indexById(source.instrument);
	const representativeRow = releases.find((release) => release.editionType === 'original') ?? releases[0];
	const representativeId = representativeRow?.id ?? null;

	const editions = releases.map((release) =>
		buildEdition({
			release,
			tracks: source.track.filter((track) => stringValue(track.releaseId) === release.id),
			recordings,
			compositions,
			distributors,
			labels,
			people,
			roles,
			instruments,
			labelRelations: source.labelRelation,
			contributions: source.contribution,
		}),
	);
	const editionsById = new Map(editions.map((edition) => [edition.id, edition]));
	for (const edition of editions) {
		const release = releases.find((row) => row.id === edition.id);
		const sourceEdition = release?.reissueOfReleaseId ? editionsById.get(stringValue(release.reissueOfReleaseId)) : undefined;
		if (sourceEdition?.anchor) {
			edition.reissueOf = { label: '初版', href: `#${sourceEdition.anchor}` };
			sourceEdition.reissues.push({ label: '再発', href: `#${edition.anchor}` });
		}
	}

	const representativeRelease = editions.find((edition) => edition.id === representativeId) ?? createEmptyEdition();
	const representativeTracks = representativeRelease.tracks;
	for (const edition of editions) {
		edition.trackDiffs = edition.id === representativeRelease.id ? [] : buildTrackDiffs(representativeTracks, edition.tracks);
	}

	return {
		work: {
			id: workId,
			title: stringValue(workRow.title) || '無題',
			slug: stringValue(workRow.slug),
			description: nullableString(workRow.description),
			type: nullableString(workRow.type),
			releasedDate: nullableString(workRow.releasedDate),
			releasedDatePrecision: nullableString(workRow.releasedDatePrecision),
			project: projectLink,
		},
		representativeRelease,
		releases: editions,
		relatedLinks: buildRelatedLinks(source.workProject, projects, workId, projectLink),
	};
};

type BuildEditionOptions = {
	release: PreparedRelease;
	tracks: readonly SiteRow[];
	recordings: Map<string, SiteRow>;
	compositions: Map<string, SiteRow>;
	distributors: Map<string, SiteRow>;
	labels: Map<string, SiteRow>;
	people: Map<string, SiteRow>;
	roles: Map<string, SiteRow>;
	instruments: Map<string, SiteRow>;
	labelRelations: readonly SiteRow[];
	contributions: readonly SiteRow[];
};

type PreparedRelease = SiteRow & { id: string; editionKey: string; editionType: string | null };

function buildEdition(options: BuildEditionOptions): DiscographyEdition {
	const { release, recordings, compositions, distributors, labels, people, roles, instruments } = options;
	const tracks = options.tracks.map((track) => buildTrack(track, recordings, compositions)).sort(compareTracks);
	const labelRows = options.labelRelations
		.filter((relation) => stringValue(relation.releaseId) === release.id)
		.map((relation) => labels.get(stringValue(relation.labelId)))
		.filter((label): label is SiteRow => Boolean(label))
		.sort((left, right) => stringValue(left.name).localeCompare(stringValue(right.name)));
	const distributor = distributors.get(stringValue(release.distributorId));

	return {
		id: release.id,
		editionKey: release.editionKey,
		anchor: `edition-${release.editionKey}`,
		format: nullableString(release.format),
		catalogNumber: nullableString(release.catalogNumber),
		releaseDate: nullableString(release.releaseDate),
		releaseDatePrecision: nullableString(release.releaseDatePrecision),
		editionType: nullableString(release.editionType),
		description: nullableString(release.description),
		notes: nullableString(release.notes),
		artwork: {
			url: nullableString(release.artworkUrl),
			width: nullableInteger(release.artworkWidth),
			height: nullableInteger(release.artworkHeight),
		},
		distributor: distributor ? { name: stringValue(distributor.name) || '名称未登録' } : null,
		labels: labelRows.map((label) => ({ name: stringValue(label.name) || '名称未登録' })),
		tracks,
		hasTracks: tracks.length > 0,
		trackDiffs: [],
		contributions: buildContributions(options.contributions, release.id, people, roles, instruments),
		reissueOf: null,
		reissues: [],
	};
}

function buildTrack(track: SiteRow, recordings: Map<string, SiteRow>, compositions: Map<string, SiteRow>): DiscographyTrack {
	const recording = recordings.get(stringValue(track.recordingId));
	const composition = recording ? compositions.get(stringValue(recording.compositionId)) : undefined;
	const title = stringValue(composition?.title) || '曲名未登録';
	const href = buildEntityHref('composition', stringValue(composition?.slug));
	return {
		id: stringValue(track.id),
		trackNumber: numberValue(track.trackNumber),
		title,
		href,
		composition: { title, href },
		recording: {
			versionName: nullableString(recording?.versionName),
			type: nullableString(recording?.type),
		},
	};
}

function buildContributions(rows: readonly SiteRow[], releaseId: string, people: Map<string, SiteRow>, roles: Map<string, SiteRow>, instruments: Map<string, SiteRow>): DiscographyContribution[] {
	return rows
		.filter((row) => stringValue(row.releaseId) === releaseId)
		.map((row) => {
			const person = people.get(stringValue(row.personId));
			const role = roles.get(stringValue(row.roleId));
			const instrument = instruments.get(stringValue(row.instrumentId));
			return {
				person: person ? entityLink('person', person) : { name: '人物未登録' },
				role: stringValue(role?.name) || '役割未登録',
				instrument: nullableString(instrument?.name),
			};
		})
		.sort((left, right) => `${left.role}:${left.person.name}`.localeCompare(`${right.role}:${right.person.name}`));
}

function buildTrackDiffs(base: readonly DiscographyTrack[], current: readonly DiscographyTrack[]): DiscographyTrackDiff[] {
	const baseByNumber = new Map(base.map((track) => [track.trackNumber, track]));
	const currentByNumber = new Map(current.map((track) => [track.trackNumber, track]));
	const numbers = [...new Set([...baseByNumber.keys(), ...currentByNumber.keys()])].sort((left, right) => left - right);
	const diffs: DiscographyTrackDiff[] = [];
	for (const trackNumber of numbers) {
		const baseTrack = baseByNumber.get(trackNumber);
		const currentTrack = currentByNumber.get(trackNumber);
		if (!baseTrack && currentTrack) {
			diffs.push(toTrackDiff('added', currentTrack));
			continue;
		}
		if (baseTrack && !currentTrack) {
			diffs.push(toTrackDiff('removed', baseTrack));
			continue;
		}
		if (
			baseTrack &&
			currentTrack &&
			`${baseTrack.title}:${baseTrack.recording.versionName ?? ''}:${baseTrack.recording.type ?? ''}` !==
				`${currentTrack.title}:${currentTrack.recording.versionName ?? ''}:${currentTrack.recording.type ?? ''}`
		) {
			diffs.push(toTrackDiff('changed', currentTrack));
		}
	}
	return diffs;
}

function toTrackDiff(kind: DiscographyTrackDiff['kind'], track: DiscographyTrack): DiscographyTrackDiff {
	return { kind, trackNumber: track.trackNumber, title: track.title, href: track.href, versionName: track.recording.versionName, type: track.recording.type };
}

function buildRelatedLinks(workProjects: readonly SiteRow[], projects: Map<string, SiteRow>, workId: string, fallback: DiscographyEntityLink | null): AdjacentLink[] {
	const seen = new Set<string>();
	const links: AdjacentLink[] = [];
	const relatedRows = workProjects
		.filter((row) => stringValue(row.workId) === workId)
		.sort((left, right) => `${stringValue(left.relationType)}:${stringValue(left.projectId)}`.localeCompare(`${stringValue(right.relationType)}:${stringValue(right.projectId)}`));
	for (const row of relatedRows) {
		const project = projects.get(stringValue(row.projectId));
		const link = project ? entityLink('project', project) : null;
		if (link?.href && !seen.has(link.href)) {
			seen.add(link.href);
			links.push({ label: link.name, href: link.href });
		}
	}
	if (fallback?.href && !seen.has(fallback.href)) links.push({ label: fallback.name, href: fallback.href });
	return links;
}

function prepareReleases(rows: readonly SiteRow[]): PreparedRelease[] {
	const sorted = [...rows].sort(compareReleases);
	const counts = new Map<string, number>();
	return sorted.map((row) => {
		const base = normalizeKey(stringValue(row.editionKey) || [row.format, row.releaseDate, row.catalogNumber].filter(isPresent).join('-') || 'edition');
		const occurrence = (counts.get(base) ?? 0) + 1;
		counts.set(base, occurrence);
		return { ...row, id: stringValue(row.id), editionKey: occurrence === 1 ? base : `${base}-${occurrence}`, editionType: nullableString(row.editionType) };
	});
}

function compareReleases(left: SiteRow, right: SiteRow): number {
	return `${nullableString(left.releaseDate) ?? '9999-99-99'}:${stringValue(left.id)}`.localeCompare(`${nullableString(right.releaseDate) ?? '9999-99-99'}:${stringValue(right.id)}`);
}

function compareTracks(left: DiscographyTrack, right: DiscographyTrack): number {
	return `${left.trackNumber}:${left.id}`.localeCompare(`${right.trackNumber}:${right.id}`, undefined, { numeric: true });
}

function createEmptyEdition(): DiscographyEdition {
	return {
		id: '',
		editionKey: null,
		anchor: null,
		format: null,
		catalogNumber: null,
		releaseDate: null,
		releaseDatePrecision: null,
		editionType: null,
		description: null,
		notes: null,
		artwork: { url: null, width: null, height: null },
		distributor: null,
		labels: [],
		tracks: [],
		hasTracks: false,
		trackDiffs: [],
		contributions: [],
		reissueOf: null,
		reissues: [],
	};
}

function entityLink(entityType: SiteEntityType, row: SiteRow): DiscographyEntityLink {
	const name = stringValue(row.name) || '名称未登録';
	return { name, href: buildEntityHref(entityType, stringValue(row.slug)) };
}

function indexById(rows: readonly SiteRow[]): Map<string, SiteRow> {
	return new Map(rows.map((row) => [stringValue(row.id), row]));
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
	return normalized || 'edition';
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

function numberValue(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isPresent(value: unknown): boolean {
	return value !== null && value !== undefined && value !== '';
}
