import type { SiteMonthDayEntry, SiteRow, SiteSnapshot, SiteTableName } from '../../export/export';
import { buildEntityHref } from './site-foundation';
import { buildDigCandidates, pickDigCards, type DigCard, type DigCandidates } from './dig';

export type HomeProject = {
	id: string;
	name: string;
	type: string;
	startDate?: string;
	endDate?: string;
	startYear?: number;
	endYear: number;
	periodLabel: string;
	href?: string;
	colorToken: string;
};

export type HomeCountTile = {
	key: Extract<SiteTableName, 'composition' | 'work' | 'event' | 'person' | 'venue' | 'article'>;
	label: string;
	count: number;
	href: string;
};

export type HomeUpcomingEvent = {
	id: string;
	label: string;
	date: string;
	href?: string;
	projectName: string;
	projectHref?: string;
	venueName: string;
	venueHref?: string;
};

export type HomeModel = {
	career: { startYear: number; endYear: number };
	projects: HomeProject[];
	countTiles: HomeCountTile[];
	upcomingEvents: HomeUpcomingEvent[];
	todayEntries: SiteMonthDayEntry[];
	dig: DigCard[];
	digCandidates: DigCandidates;
};

const PROJECT_COLOR_TOKENS: Record<string, string> = {
	'sweet-girls': 'var(--project-sweet-girls)',
	'sanchester-united-fc': 'var(--project-sanchester)',
	'burger-nuds': 'var(--project-burger-nuds)',
	'good-dog-happy-men': 'var(--project-good-dog-happy-men)',
	'kadota-2010-12': 'var(--project-kadota-2010)',
	'poet-type-m': 'var(--project-poet-type-m)',
	'kadota-2020': 'var(--project-kadota-2020)',
};

const stringValue = (row: SiteRow | undefined, key: string): string => {
	const value = row?.[key];
	return typeof value === 'string' ? value : '';
};

const nullableString = (row: SiteRow | undefined, key: string): string | undefined => {
	const value = stringValue(row, key);
	return value || undefined;
};

const yearValue = (value: string | undefined): number | undefined => {
	const year = Number(value?.slice(0, 4));
	return Number.isInteger(year) && year >= 1 ? year : undefined;
};

const compareText = (left: string | undefined, right: string | undefined): number => (left ?? '').localeCompare(right ?? '', 'ja');

const projectColorToken = (slug: string | undefined): string => (slug ? (PROJECT_COLOR_TOKENS[slug] ?? 'var(--project-other)') : 'var(--project-other)');

const projectPeriodLabel = (startDate: string | undefined, endDate: string | undefined): string => `${yearValue(startDate) ?? '活動期間不明'}〜${yearValue(endDate) ?? '現在'}`;

const buildProjects = (rows: SiteRow[], currentYear: number): HomeProject[] =>
	rows
		.filter((row) => stringValue(row, 'scope') !== 'external')
		.map((row): HomeProject | undefined => {
			const id = stringValue(row, 'id');
			const name = stringValue(row, 'name');
			if (!id || !name) return undefined;
			const slug = nullableString(row, 'slug');
			const startDate = nullableString(row, 'startDate');
			const endDate = nullableString(row, 'endDate');
			return {
				id,
				name,
				type: stringValue(row, 'type') || 'unknown',
				startDate,
				endDate,
				startYear: yearValue(startDate),
				endYear: yearValue(endDate) ?? currentYear,
				periodLabel: projectPeriodLabel(startDate, endDate),
				href: buildEntityHref('project', slug),
				colorToken: projectColorToken(slug),
			};
		})
		.filter((project): project is HomeProject => project !== undefined)
		.sort((left, right) => (left.startYear ?? Number.MAX_SAFE_INTEGER) - (right.startYear ?? Number.MAX_SAFE_INTEGER) || compareText(left.name, right.name) || compareText(left.id, right.id));

const COUNT_TILES: ReadonlyArray<Pick<HomeCountTile, 'key' | 'label' | 'href'>> = [
	{ key: 'composition', label: '楽曲', href: '/songs' },
	{ key: 'work', label: '作品', href: '/discography' },
	{ key: 'event', label: 'ライブ', href: '/lives' },
	{ key: 'person', label: '人物', href: '/people' },
	{ key: 'venue', label: '会場', href: '/venues' },
	{ key: 'article', label: '記事', href: '/library' },
];

const buildCountTiles = (snapshot: SiteSnapshot): HomeCountTile[] =>
	COUNT_TILES.map((tile) => ({
		...tile,
		count: Number.isFinite(snapshot.manifest.counts[tile.key]) ? Math.max(0, snapshot.manifest.counts[tile.key]) : 0,
	}));

const buildUpcomingEvents = (rows: SiteDatabaseRowsForHome, today: string): HomeUpcomingEvent[] => {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(today)) return [];
	const projects = new Map(rows.project.map((row) => [stringValue(row, 'id'), row]));
	const venues = new Map(rows.venue.map((row) => [stringValue(row, 'id'), row]));
	const publicProjectIds = new Set(rows.project.filter((row) => stringValue(row, 'scope') !== 'external').map((row) => stringValue(row, 'id')));

	return rows.event
		.filter((row) => {
			const date = nullableString(row, 'eventDate');
			return Boolean(date && date >= today && publicProjectIds.has(stringValue(row, 'projectId')));
		})
		.map((row): HomeUpcomingEvent | undefined => {
			const id = stringValue(row, 'id');
			const date = nullableString(row, 'eventDate');
			if (!id || !date) return undefined;
			const project = projects.get(stringValue(row, 'projectId'));
			const venue = venues.get(stringValue(row, 'venueId'));
			return {
				id,
				label: stringValue(row, 'eventName') || '名称未登録',
				date,
				href: buildEntityHref('event', nullableString(row, 'slug')),
				projectName: stringValue(project, 'name') || 'プロジェクト未登録',
				projectHref: buildEntityHref('project', nullableString(project, 'slug')),
				venueName: stringValue(venue, 'name') || '会場未登録',
				venueHref: buildEntityHref('venue', nullableString(venue, 'slug')),
			};
		})
		.filter((event): event is HomeUpcomingEvent => event !== undefined)
		.sort((left, right) => compareText(left.date, right.date) || compareText(left.label, right.label) || compareText(left.id, right.id));
};

type SiteDatabaseRowsForHome = Pick<SiteSnapshot['tables'], 'project' | 'event' | 'venue'>;

const buildTodayEntries = (snapshot: SiteSnapshot, today: string): SiteMonthDayEntry[] => {
	const monthDay = today.slice(5);
	if (!/^\d{2}-\d{2}$/u.test(monthDay)) return [];
	return [...(snapshot.indexes.monthDay[monthDay] ?? [])].sort((left, right) => `${left.date}:${left.type}:${left.href}`.localeCompare(`${right.date}:${right.type}:${right.href}`));
};

export const buildHomeModel = (snapshot: SiteSnapshot, today = snapshot.snapshotGeneratedAt.slice(0, 10)): HomeModel => {
	const currentYear = yearValue(today) ?? new Date().getUTCFullYear();
	const projects = buildProjects(snapshot.tables.project, currentYear);
	const knownStartYears = projects.map((project) => project.startYear).filter((year): year is number => year !== undefined);
	const knownEndYears = projects.map((project) => project.endYear);
	return {
		career: {
			startYear: Math.min(...knownStartYears, currentYear),
			endYear: Math.max(...knownEndYears, currentYear),
		},
		projects,
		countTiles: buildCountTiles(snapshot),
		upcomingEvents: buildUpcomingEvents(snapshot.tables, today),
		todayEntries: buildTodayEntries(snapshot, today),
		digCandidates: buildDigCandidates(snapshot),
		dig: pickDigCards(buildDigCandidates(snapshot), () => 0),
	};
};
