import { buildEntityHref } from './site-foundation';

export type SongDiscoverySource = {
	eventPerformance: readonly Record<string, unknown>[];
	event: readonly Record<string, unknown>[];
	track: readonly Record<string, unknown>[];
	recording: readonly Record<string, unknown>[];
	release: readonly Record<string, unknown>[];
	work: readonly Record<string, unknown>[];
};

export type SongJourneyItem = { date: string; label: string; href?: string; editionKey?: string };
export type SongPerformanceHistory = {
	firstDate?: string;
	lastDate?: string;
	count: number;
	encoreRate?: number;
	years: { year: string; count: number }[];
	revivals: { date: string; gapFrom: string; gapYears: number; eventHref?: string }[];
};

const text = (row: Record<string, unknown> | undefined, key: string): string => (typeof row?.[key] === 'string' ? row[key] : '');
const dateOf = (row: Record<string, unknown> | undefined): string => text(row, 'eventDate') || text(row, 'releaseDate');
const editionKey = (release: Record<string, unknown>): string | undefined => text(release, 'editionKey') || undefined;

export const buildSongJourney = (compositionId: string, source: SongDiscoverySource): SongJourneyItem[] => {
	const recordings = new Set(source.recording.filter((row) => text(row, 'compositionId') === compositionId).map((row) => text(row, 'id')));
	const releases = new Map(source.release.map((row) => [text(row, 'id'), row]));
	const works = new Map(source.work.map((row) => [text(row, 'id'), row]));
	return source.track
		.filter((track) => recordings.has(text(track, 'recordingId')))
		.map((track) => {
			const release = releases.get(text(track, 'releaseId'));
			const work = release ? works.get(text(release, 'workId')) : undefined;
			const href = buildEntityHref('work', text(work, 'slug'));
			const key = editionKey(release ?? {});
			return { date: text(release, 'releaseDate'), label: text(work, 'title') || '作品未登録', href: href && key ? `${href}#edition-${key}` : href, editionKey: key };
		})
		.filter((item) => item.date)
		.sort((left, right) => left.date.localeCompare(right.date) || left.label.localeCompare(right.label, 'ja'));
};

export const buildSongPerformanceHistory = (compositionId: string, source: SongDiscoverySource): SongPerformanceHistory => {
	const events = new Map(source.event.map((row) => [text(row, 'id'), row]));
	const performances = source.eventPerformance
		.filter((row) => text(row, 'compositionId') === compositionId)
		.map((row) => ({ date: dateOf(events.get(text(row, 'eventId'))), encore: row.encore === true, eventHref: buildEntityHref('event', text(events.get(text(row, 'eventId')), 'slug')) }))
		.filter((item) => item.date)
		.sort((left, right) => left.date.localeCompare(right.date));
	const years = new Map<string, number>();
	for (const performance of performances) years.set(performance.date.slice(0, 4), (years.get(performance.date.slice(0, 4)) ?? 0) + 1);
	const revivals: SongPerformanceHistory['revivals'] = [];
	for (let index = 1; index < performances.length; index += 1) {
		const previous = performances[index - 1];
		const current = performances[index];
		if (previous.date === current.date) continue;
		if (current.date >= addCalendarYears(previous.date, 3))
			revivals.push({ date: current.date, gapFrom: previous.date, gapYears: Math.max(1, Number(current.date.slice(0, 4)) - Number(previous.date.slice(0, 4))), eventHref: current.eventHref });
	}
	const encoreCount = performances.filter((performance) => performance.encore).length;
	return {
		firstDate: performances[0]?.date,
		lastDate: performances.at(-1)?.date,
		count: performances.length,
		encoreRate: performances.length > 0 ? encoreCount / performances.length : undefined,
		years: [...years.entries()].map(([year, count]) => ({ year, count })).sort((left, right) => left.year.localeCompare(right.year)),
		revivals,
	};
};

function addCalendarYears(value: string, years: number): string {
	const [year, month, day] = value.split('-').map(Number);
	if (!year || !month || !day) return value;
	const date = new Date(Date.UTC(year + years, month - 1, day));
	return date.toISOString().slice(0, 10);
}
