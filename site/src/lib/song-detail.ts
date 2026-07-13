import { buildEntityHref, type SiteEntityType } from './site-foundation';
import type { SiteRow } from '../../export/export';

export type SongDetailSource = {
	composition: readonly SiteRow[];
	compositionCredit: readonly SiteRow[];
	person: readonly SiteRow[];
	recording: readonly SiteRow[];
	track: readonly SiteRow[];
	release: readonly SiteRow[];
	work: readonly SiteRow[];
	project: readonly SiteRow[];
	eventPerformance: readonly SiteRow[];
	event: readonly SiteRow[];
	venue: readonly SiteRow[];
};

export type SongEntityLink = {
	name: string;
	href?: string;
	slug?: string | null;
};

export type SongCredit = SongEntityLink & {
	creditType: 'composer' | 'lyricist';
	orderIndex: number;
};

export type SongPlacement = {
	id: string;
	trackNumber: number;
	format: string | null;
	releaseDate: string | null;
	editionKey: string | null;
	work: SongEntityLink;
	href?: string;
};

export type SongRecording = {
	id: string;
	type: string | null;
	versionName: string | null;
	versionDescription: string | null;
	firstReleaseDate: string | null;
	firstReleaseYear: string | null;
	releaseYear: string | null;
	placements: SongPlacement[];
};

export type SongPerformance = {
	id: string;
	eventDate: string | null;
	orderIndex: number;
	encore: boolean;
	variationNote: string | null;
	notes: string | null;
	event: SongEntityLink;
	project: SongEntityLink;
	venue: SongEntityLink;
};

export type SongDetail = {
	composition: {
		id: string;
		title: string;
		slug: string;
		description: string | null;
	};
	credits: {
		composer: SongCredit[];
		lyricist: SongCredit[];
	};
	recordings: SongRecording[];
	performances: SongPerformance[];
	liveOnly: boolean;
};

export const buildSongDetail = (source: SongDetailSource, slug: string | undefined): SongDetail | null => {
	const composition = source.composition.find((row) => stringValue(row.slug) === slug && Boolean(buildEntityHref('composition', slug)));
	if (!composition) return null;

	const compositionId = stringValue(composition.id);
	const people = indexById(source.person);
	const credits = buildCredits(source.compositionCredit, compositionId, people);
	const releases = indexById(source.release);
	const works = indexById(source.work);
	const recordings = source.recording
		.filter((row) => stringValue(row.compositionId) === compositionId)
		.map((row) => buildRecording(row, source.track, releases, works))
		.sort(compareRecordings);
	const performances = source.eventPerformance
		.filter((row) => stringValue(row.compositionId) === compositionId)
		.map((row) => buildPerformance(row, source.event, source.project, source.venue))
		.sort(comparePerformances);

	return {
		composition: {
			id: compositionId,
			title: stringValue(composition.title) || '無題',
			slug: stringValue(composition.slug),
			description: nullableString(composition.description),
		},
		credits,
		recordings,
		performances,
		liveOnly: recordings.length === 0 && performances.length > 0,
	};
};

function buildCredits(rows: readonly SiteRow[], compositionId: string, people: Map<string, SiteRow>): SongDetail['credits'] {
	const credits = rows
		.filter((row) => stringValue(row.compositionId) === compositionId)
		.filter((row): row is SiteRow & { creditType: 'composer' | 'lyricist' } => row.creditType === 'composer' || row.creditType === 'lyricist')
		.map((row) => {
			const person = people.get(stringValue(row.personId));
			return {
				creditType: row.creditType,
				orderIndex: numberValue(row.orderIndex),
				name: stringValue(person?.name) || '人物未登録',
				slug: nullableString(person?.slug),
				href: person ? buildEntityHref('person', stringValue(person.slug)) : undefined,
			};
		})
		.sort(compareCredits);

	return {
		composer: credits.filter((credit) => credit.creditType === 'composer'),
		lyricist: credits.filter((credit) => credit.creditType === 'lyricist'),
	};
}

function buildRecording(row: SiteRow, tracks: readonly SiteRow[], releases: Map<string, SiteRow>, works: Map<string, SiteRow>): SongRecording {
	const recordingId = stringValue(row.id);
	const placements = tracks
		.filter((track) => stringValue(track.recordingId) === recordingId)
		.map((track) => buildPlacement(track, releases, works))
		.sort(comparePlacements);
	const releaseDates = placements
		.map((placement) => placement.releaseDate)
		.filter((date): date is string => Boolean(date))
		.sort();
	const firstReleaseDate = releaseDates[0] ?? null;
	const firstReleaseYear = firstReleaseDate?.match(/^\d{4}/u)?.[0] ?? null;

	return {
		id: recordingId,
		type: nullableString(row.type),
		versionName: nullableString(row.versionName),
		versionDescription: nullableString(row.versionDescription),
		firstReleaseDate,
		firstReleaseYear,
		releaseYear: firstReleaseYear,
		placements,
	};
}

function buildPlacement(track: SiteRow, releases: Map<string, SiteRow>, works: Map<string, SiteRow>): SongPlacement {
	const release = releases.get(stringValue(track.releaseId));
	const work = release ? works.get(stringValue(release.workId)) : undefined;
	const workSlug = nullableString(work?.slug);
	const editionKey = release ? editionKeyOf(release) : null;
	const workHref = buildEntityHref('work', workSlug);

	return {
		id: stringValue(track.id),
		trackNumber: numberValue(track.trackNumber),
		format: nullableString(release?.format),
		releaseDate: nullableString(release?.releaseDate),
		editionKey,
		work: work ? entityLink('work', work, stringValue(work.title) || '作品未登録') : { name: '作品未登録' },
		href: workHref && editionKey ? `${workHref}#edition-${editionKey}` : workHref,
	};
}

function buildPerformance(row: SiteRow, events: readonly SiteRow[], projects: readonly SiteRow[], venues: readonly SiteRow[]): SongPerformance {
	const event = events.find((candidate) => stringValue(candidate.id) === stringValue(row.eventId));
	const project = projects.find((candidate) => stringValue(candidate.id) === stringValue(event?.projectId));
	const venue = venues.find((candidate) => stringValue(candidate.id) === stringValue(event?.venueId));

	return {
		id: stringValue(row.id),
		eventDate: nullableString(event?.eventDate),
		orderIndex: numberValue(row.orderIndex),
		encore: row.encore === true,
		variationNote: nullableString(row.variationNote),
		notes: nullableString(row.notes),
		event: event ? entityLink('event', event, stringValue(event.eventName) || '名称未登録') : { name: '公演未登録' },
		project: project ? entityLink('project', project, stringValue(project.name) || '名称未登録') : { name: '名義未登録' },
		venue: venue ? entityLink('venue', venue, stringValue(venue.name) || '名称未登録') : { name: '会場未登録' },
	};
}

function entityLink(entityType: SiteEntityType, row: SiteRow, fallbackName: string): SongEntityLink {
	return {
		name: fallbackName,
		slug: nullableString(row.slug),
		href: buildEntityHref(entityType, stringValue(row.slug)),
	};
}

function editionKeyOf(release: SiteRow): string | null {
	const existing = nullableString(release.editionKey);
	if (existing) return existing;
	const fallback = [release.format, release.releaseDate, release.catalogNumber].filter(isPresent).join('-');
	return fallback ? normalizeKey(fallback) : null;
}

function compareCredits(left: SongCredit, right: SongCredit): number {
	return left.creditType.localeCompare(right.creditType) || left.orderIndex - right.orderIndex || left.name.localeCompare(right.name, 'ja') || (left.slug ?? '').localeCompare(right.slug ?? '');
}

function comparePlacements(left: SongPlacement, right: SongPlacement): number {
	return (left.releaseDate ?? '9999-99-99').localeCompare(right.releaseDate ?? '9999-99-99') || left.trackNumber - right.trackNumber || left.id.localeCompare(right.id);
}

function compareRecordings(left: SongRecording, right: SongRecording): number {
	return (left.firstReleaseDate ?? '9999-99-99').localeCompare(right.firstReleaseDate ?? '9999-99-99') || left.id.localeCompare(right.id);
}

function comparePerformances(left: SongPerformance, right: SongPerformance): number {
	return (left.eventDate ?? '9999-99-99').localeCompare(right.eventDate ?? '9999-99-99') || left.orderIndex - right.orderIndex || left.id.localeCompare(right.id);
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

function numberValue(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isPresent(value: unknown): boolean {
	return value !== null && value !== undefined && value !== '';
}
