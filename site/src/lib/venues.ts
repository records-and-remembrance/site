import type { SiteDatabaseRows, SiteRow } from '../../export/export';
import { buildEntityHref, type DatePrecision } from './site-foundation';

export type VenueRows = Pick<SiteDatabaseRows, 'venue' | 'event' | 'eventPerformance' | 'project' | 'composition'>;

export type VenueRecord = {
	id: string;
	name: string;
	location?: string;
	description?: string;
	slug?: string;
};

export type VenueListItem = {
	venue: VenueRecord;
	href?: string;
	eventCount: number;
};

export type VenueEvent = {
	id: string;
	date?: string;
	datePrecision: DatePrecision;
	label: string;
	href?: string;
	projectId?: string;
	projectName: string;
	projectHref?: string;
};

export type VenueCount = {
	projectId: string;
	label: string;
	href?: string;
	count: number;
};

export type VenueSongCount = {
	compositionId: string;
	label: string;
	href?: string;
	count: number;
};

export type VenueDetail = {
	venue: VenueRecord;
	events: VenueEvent[];
	yearCounts: Array<{ year: string; count: number }>;
	projectCounts: VenueCount[];
	topSongs: VenueSongCount[];
};

const text = (row: SiteRow | undefined, key: string): string | undefined => {
	const value = row?.[key];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const datePrecision = (row: SiteRow, key: string): DatePrecision => {
	const value = text(row, key);
	return value === 'year' || value === 'month' || value === 'day' || value === 'uncertain' ? value : null;
};

const compareText = (left: string | undefined, right: string | undefined): number => (left ?? '').localeCompare(right ?? '', 'ja');

const toVenue = (row: SiteRow): VenueRecord | undefined => {
	const id = text(row, 'id');
	const name = text(row, 'name');
	if (!id || !name) return undefined;
	return {
		id,
		name,
		location: text(row, 'location'),
		description: text(row, 'description'),
		slug: text(row, 'slug'),
	};
};

const venueRecords = (rows: VenueRows): VenueRecord[] => rows.venue.map(toVenue).filter((venue): venue is VenueRecord => venue !== undefined);

const eventsForVenue = (rows: VenueRows, venue: VenueRecord): VenueEvent[] => {
	const projects = new Map(rows.project.map((row) => [text(row, 'id'), row]));
	return rows.event
		.filter((row) => text(row, 'venueId') === venue.id)
		.map((row) => {
			const project = projects.get(text(row, 'projectId'));
			return {
				id: text(row, 'id') ?? `${venue.id}:${text(row, 'eventDate') ?? 'unknown'}:${text(row, 'eventName') ?? 'unnamed'}`,
				date: text(row, 'eventDate'),
				datePrecision: datePrecision(row, 'eventDatePrecision'),
				label: text(row, 'eventName') ?? '名称未登録',
				href: buildEntityHref('event', text(row, 'slug')),
				projectId: text(row, 'projectId'),
				projectName: text(project, 'name') ?? 'プロジェクト未登録',
				projectHref: buildEntityHref('project', text(project, 'slug')),
			};
		})
		.sort(
			(left, right) =>
				compareText(right.date, left.date) ||
				compareText(left.projectName, right.projectName) ||
				compareText(left.label, right.label) ||
				compareText(left.href, right.href) ||
				compareText(left.id, right.id),
		);
};

const sortCounts = <T extends { label: string; href?: string; count: number; projectId?: string; compositionId?: string }>(left: T, right: T): number =>
	right.count - left.count || compareText(left.label, right.label) || compareText(left.href, right.href) || compareText(left.projectId ?? left.compositionId, right.projectId ?? right.compositionId);

const projectCounts = (events: readonly VenueEvent[]): VenueCount[] => {
	const counts = new Map<string, VenueCount>();
	for (const event of events) {
		const projectId = event.projectId ?? `missing:${event.projectName}`;
		const current = counts.get(projectId);
		counts.set(projectId, {
			projectId,
			label: event.projectName,
			href: event.projectHref,
			count: (current?.count ?? 0) + 1,
		});
	}
	return [...counts.values()].sort(sortCounts);
};

const yearCounts = (events: readonly VenueEvent[]): Array<{ year: string; count: number }> => {
	const counts = new Map<string, number>();
	for (const event of events) {
		const year = event.date?.slice(0, 4);
		if (year && /^\d{4}$/u.test(year)) counts.set(year, (counts.get(year) ?? 0) + 1);
	}
	return [...counts.entries()].map(([year, count]) => ({ year, count })).sort((left, right) => right.year.localeCompare(left.year));
};

const topSongs = (rows: VenueRows, events: readonly VenueEvent[]): VenueSongCount[] => {
	const eventIds = new Set(events.map((event) => event.id));
	const compositions = new Map(rows.composition.map((row) => [text(row, 'id'), row]));
	const counts = new Map<string, VenueSongCount>();
	for (const performance of rows.eventPerformance) {
		const eventId = text(performance, 'eventId');
		if (!eventId || !eventIds.has(eventId)) continue;
		const compositionId = text(performance, 'compositionId');
		const composition = compositions.get(compositionId);
		const label = text(composition, 'title');
		if (!compositionId || !label) continue;
		const current = counts.get(compositionId);
		counts.set(compositionId, {
			compositionId,
			label,
			href: buildEntityHref('composition', text(composition, 'slug')),
			count: (current?.count ?? 0) + 1,
		});
	}
	return [...counts.values()].sort(sortCounts).slice(0, 5);
};

export const buildVenueList = (rows: VenueRows): VenueListItem[] =>
	venueRecords(rows)
		.map((venue) => ({
			venue,
			href: buildEntityHref('venue', venue.slug),
			eventCount: rows.event.filter((event) => text(event, 'venueId') === venue.id).length,
		}))
		.sort(
			(left, right) =>
				compareText(left.venue.name, right.venue.name) ||
				compareText(left.venue.location, right.venue.location) ||
				compareText(left.venue.slug, right.venue.slug) ||
				compareText(left.venue.id, right.venue.id),
		);

export const buildVenueDetail = (rows: VenueRows, slug: string): VenueDetail | undefined => {
	const venue = venueRecords(rows).find((candidate) => candidate.slug === slug);
	if (!venue) return undefined;
	const events = eventsForVenue(rows, venue);
	return {
		venue,
		events,
		yearCounts: yearCounts(events),
		projectCounts: projectCounts(events),
		topSongs: topSongs(rows, events),
	};
};
