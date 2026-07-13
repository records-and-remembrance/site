import { buildEntityHref, normalizeAdjacentLinks, type AdjacentLink, type DatePrecision } from './site-foundation';
import type { SiteDatabaseRows, SiteRow, SiteTableName } from '../../export/export';

export type ProjectTableName = 'project' | 'person' | 'membership' | 'role' | 'instrument' | 'membershipRole' | 'work' | 'workProject' | 'venue' | 'event' | 'eventPerformance' | 'composition';

export type ProjectRows = Pick<SiteDatabaseRows, ProjectTableName>;
export type SiteTableReader = <TableName extends SiteTableName>(tableName: TableName) => SiteDatabaseRows[TableName];

export type ProjectRecord = {
	id: string;
	name: string;
	type: string;
	description?: string;
	startDate?: string;
	endDate?: string;
	slug?: string;
	scope: string;
};

export type ProjectListItem = {
	project: ProjectRecord;
	href?: string;
	counts: {
		memberships: number;
		works: number;
		events: number;
	};
};

export type ProjectMembership = {
	person: {
		name: string;
		href?: string;
	};
	fromDate?: string;
	fromDatePrecision: DatePrecision;
	toDate?: string;
	toDatePrecision: DatePrecision;
	support: boolean;
	roles: string[];
};

export type ProjectWork = {
	title: string;
	releasedDate?: string;
	href?: string;
	relationType: 'primary' | 'participant';
};

export type ProjectEvent = {
	id: string;
	label: string;
	date?: string;
	datePrecision: DatePrecision;
	href?: string;
	venueId?: string;
	venueName: string;
	venueSlug?: string;
};

export type ProjectCount = {
	label: string;
	href?: string;
	count: number;
	slug?: string;
};

export type ProjectDetail = {
	project: ProjectRecord;
	memberships: ProjectMembership[];
	works: ProjectWork[];
	events: ProjectEvent[];
	yearlyLiveCounts: ProjectCount[];
	topVenues: ProjectCount[];
	topSongs: ProjectCount[];
	relatedLinks: AdjacentLink[];
};

const PROJECT_TABLES: readonly ProjectTableName[] = [
	'project',
	'person',
	'membership',
	'role',
	'instrument',
	'membershipRole',
	'work',
	'workProject',
	'venue',
	'event',
	'eventPerformance',
	'composition',
];

export const selectProjectRows = (readRows: SiteTableReader): ProjectRows => {
	const rows = {} as ProjectRows;
	for (const tableName of PROJECT_TABLES) rows[tableName] = readRows(tableName) as never;
	return rows;
};

const value = (row: SiteRow, key: string): unknown => row[key];

const text = (row: SiteRow, key: string): string | undefined => {
	const candidate = value(row, key);
	return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
};

const booleanValue = (row: SiteRow, key: string): boolean => value(row, key) === true;

const datePrecision = (row: SiteRow, key: string): DatePrecision => {
	const candidate = text(row, key);
	return candidate === 'year' || candidate === 'month' || candidate === 'day' || candidate === 'uncertain' ? candidate : null;
};

const compareText = (left: string | undefined, right: string | undefined): number => (left ?? '').localeCompare(right ?? '', 'ja');

const toProject = (row: SiteRow): ProjectRecord | undefined => {
	const id = text(row, 'id');
	const name = text(row, 'name');
	if (!id || !name) return undefined;
	return {
		id,
		name,
		type: text(row, 'type') ?? 'unknown',
		description: text(row, 'description'),
		startDate: text(row, 'startDate'),
		endDate: text(row, 'endDate'),
		slug: text(row, 'slug'),
		scope: text(row, 'scope') ?? 'monden',
	};
};

const projects = (rows: ProjectRows): ProjectRecord[] => rows.project.map(toProject).filter((project): project is ProjectRecord => project !== undefined);

const projectWorks = (rows: ProjectRows, project: ProjectRecord): ProjectWork[] => {
	const workRows = new Map(rows.work.map((row) => [text(row, 'id'), row]));
	const relationRows = rows.workProject.filter((row) => text(row, 'projectId') === project.id);
	const relationByWorkId = new Map<string, 'primary' | 'participant'>();
	for (const row of relationRows) {
		const workId = text(row, 'workId');
		if (!workId) continue;
		const relationType = text(row, 'relationType') === 'participant' ? 'participant' : 'primary';
		if (relationByWorkId.get(workId) !== 'primary') relationByWorkId.set(workId, relationType);
	}

	for (const row of rows.work) {
		const workId = text(row, 'id');
		if (workId && text(row, 'projectId') === project.id && !relationByWorkId.has(workId)) relationByWorkId.set(workId, 'primary');
	}

	return [...relationByWorkId.entries()]
		.map(([workId, relationType]) => {
			const row = workRows.get(workId);
			if (!row) return undefined;
			const title = text(row, 'title');
			if (!title) return undefined;
			return {
				title,
				releasedDate: text(row, 'releasedDate'),
				href: buildEntityHref('work', text(row, 'slug')),
				relationType,
			};
		})
		.filter((work): work is ProjectWork => work !== undefined)
		.sort((left, right) => compareText(left.releasedDate, right.releasedDate) || compareText(left.title, right.title));
};

const projectEvents = (rows: ProjectRows, project: ProjectRecord): ProjectEvent[] => {
	const venues = new Map(rows.venue.map((row) => [text(row, 'id'), row]));
	return rows.event
		.filter((row) => text(row, 'projectId') === project.id)
		.map((row) => {
			const id = text(row, 'id');
			const eventDate = text(row, 'eventDate');
			const venue = venues.get(text(row, 'venueId'));
			const venueName = text(venue ?? {}, 'name') ?? '会場未登録';
			const title = text(row, 'title');
			return {
				id: id ?? `${eventDate ?? 'unknown'}-${venueName}`,
				label: title ?? (eventDate ? `${eventDate}のライブ` : 'ライブ'),
				date: eventDate,
				datePrecision: datePrecision(row, 'eventDatePrecision'),
				href: buildEntityHref('event', text(row, 'slug')),
				venueId: text(row, 'venueId'),
				venueName,
				venueSlug: text(venue ?? {}, 'slug'),
			};
		})
		.sort((left, right) => compareText(left.date, right.date) || compareText(left.label, right.label));
};

const memberships = (rows: ProjectRows, project: ProjectRecord): ProjectMembership[] => {
	const people = new Map(rows.person.map((row) => [text(row, 'id'), row]));
	const roles = new Map(rows.role.map((row) => [text(row, 'id'), row]));
	const instruments = new Map(rows.instrument.map((row) => [text(row, 'id'), row]));

	return rows.membership
		.filter((row) => text(row, 'projectId') === project.id)
		.map((row) => {
			const person = people.get(text(row, 'personId'));
			const membershipId = text(row, 'id');
			const roleLabels = rows.membershipRole
				.filter((membershipRole) => text(membershipRole, 'membershipId') === membershipId)
				.map((membershipRole) => {
					const role = roles.get(text(membershipRole, 'roleId'));
					const instrument = instruments.get(text(membershipRole, 'instrumentId'));
					const roleName = text(role ?? {}, 'name');
					const instrumentName = text(instrument ?? {}, 'name');
					if (!roleName) return undefined;
					return instrumentName ? `${roleName} / ${instrumentName}` : roleName;
				})
				.filter((role): role is string => role !== undefined);
			return {
				person: {
					name: text(person ?? {}, 'name') ?? '人物未登録',
					href: buildEntityHref('person', text(person ?? {}, 'slug')),
				},
				fromDate: text(row, 'fromDate'),
				fromDatePrecision: datePrecision(row, 'fromDatePrecision'),
				toDate: text(row, 'toDate'),
				toDatePrecision: datePrecision(row, 'toDatePrecision'),
				support: booleanValue(row, 'support'),
				roles: roleLabels,
			};
		})
		.sort((left, right) => compareText(left.fromDate, right.fromDate) || compareText(left.person.name, right.person.name));
};

const sortCount = (left: ProjectCount, right: ProjectCount): number => right.count - left.count || compareText(left.label, right.label) || compareText(left.slug, right.slug);

const yearCounts = (events: ProjectEvent[]): ProjectCount[] => {
	const counts = new Map<string, number>();
	for (const event of events) {
		const year = event.date?.slice(0, 4);
		if (year && /^\d{4}$/u.test(year)) counts.set(year, (counts.get(year) ?? 0) + 1);
	}
	return [...counts.entries()].map(([year, count]) => ({ label: `${year}年`, count, slug: year })).sort((left, right) => Number(right.slug) - Number(left.slug));
};

const venueCounts = (events: ProjectEvent[]): ProjectCount[] => {
	const counts = new Map<string, ProjectCount>();
	for (const event of events) {
		const label = event.venueName;
		const slug = event.venueSlug;
		const venueId = event.venueId;
		const key = venueId ?? label;
		const current = counts.get(key);
		counts.set(key, { label, slug, href: buildEntityHref('venue', slug), count: (current?.count ?? 0) + 1 });
	}
	return [...counts.values()].sort(sortCount).slice(0, 5);
};

const songCounts = (rows: ProjectRows, events: ProjectEvent[]): ProjectCount[] => {
	const eventIds = new Set(events.map((event) => event.id));
	const compositions = new Map(rows.composition.map((row) => [text(row, 'id'), row]));
	const counts = new Map<string, ProjectCount>();
	for (const performance of rows.eventPerformance) {
		const eventId = text(performance, 'eventId');
		if (!eventIds.has(eventId)) continue;
		const compositionId = text(performance, 'compositionId');
		const composition = compositions.get(compositionId);
		const label = text(composition ?? {}, 'title');
		if (!compositionId || !label) continue;
		const slug = text(composition ?? {}, 'slug');
		const current = counts.get(compositionId);
		counts.set(compositionId, { label, slug, href: buildEntityHref('composition', slug), count: (current?.count ?? 0) + 1 });
	}
	return [...counts.values()].sort(sortCount).slice(0, 10);
};

export const buildProjectList = (rows: ProjectRows): ProjectListItem[] =>
	projects(rows)
		.filter((project) => project.scope === 'monden')
		.map((project) => {
			const projectMemberships = rows.membership.filter((row) => text(row, 'projectId') === project.id);
			const works = projectWorks(rows, project);
			const events = rows.event.filter((row) => text(row, 'projectId') === project.id);
			return {
				project,
				href: buildEntityHref('project', project.slug),
				counts: { memberships: projectMemberships.length, works: works.length, events: events.length },
			};
		})
		.sort((left, right) => compareText(left.project.name, right.project.name) || compareText(left.project.slug, right.project.slug));

export const buildProjectDetail = (rows: ProjectRows, slug: string): ProjectDetail | undefined => {
	const project = projects(rows).find((candidate) => candidate.scope === 'monden' && candidate.slug === slug);
	if (!project) return undefined;
	const projectMemberships = memberships(rows, project);
	const works = projectWorks(rows, project);
	const events = projectEvents(rows, project);
	const yearlyLiveCounts = yearCounts(events);
	const topVenues = venueCounts(events);
	const topSongs = songCounts(rows, events);
	const relatedLinks = normalizeAdjacentLinks([
		...projectMemberships.map((membership) => ({ label: `${membership.person.name}（人物）`, href: membership.person.href })),
		...works.map((work) => ({ label: `${work.title}（作品）`, href: work.href })),
		...events.map((event) => ({ label: `${event.label}（ライブ）`, href: event.href })),
		...topSongs.map((song) => ({ label: `${song.label}（楽曲）`, href: song.href })),
	]);
	return { project, memberships: projectMemberships, works, events, yearlyLiveCounts, topVenues, topSongs, relatedLinks };
};
