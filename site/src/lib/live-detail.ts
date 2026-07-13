import { buildEntityHref } from './site-foundation';

export type LiveDetailSource = {
	event: readonly Record<string, unknown>[];
	eventPerformance: readonly Record<string, unknown>[];
	composition: readonly Record<string, unknown>[];
	project: readonly Record<string, unknown>[];
	venue: readonly Record<string, unknown>[];
	person: readonly Record<string, unknown>[];
	contribution: readonly Record<string, unknown>[];
};

export type LivePerformance = { orderIndex: number; encore: boolean; title: string; href: string | undefined; variationNote?: string };
export type LiveParticipant = { name: string; href: string | undefined; role?: string };
export type LiveAdjacentEvent = { label: string; date: string; href: string | undefined };
export type LiveDetail = {
	event: { id: string; name: string; date: string; datePrecision: string | null; slug: string | null; type: string; startTime?: string; ticketPrice?: number };
	project: { name: string; slug: string | null; href: string | undefined };
	venue: { name: string; slug: string | null; href: string | undefined };
	performances: LivePerformance[];
	participants: LiveParticipant[];
	previous?: LiveAdjacentEvent;
	next?: LiveAdjacentEvent;
};

const text = (row: Record<string, unknown> | undefined, key: string): string => (typeof row?.[key] === 'string' ? row[key] : '');
const nullable = (value: string): string | null => value || null;
const numberValue = (row: Record<string, unknown> | undefined, key: string): number | undefined => (typeof row?.[key] === 'number' && Number.isFinite(row[key]) ? row[key] : undefined);

export const buildLiveDetail = (source: LiveDetailSource, slug: string | undefined): LiveDetail | undefined => {
	const event = source.event.find((row) => text(row, 'slug') === slug);
	if (!event) return undefined;
	const eventId = text(event, 'id');
	const project = source.project.find((row) => text(row, 'id') === text(event, 'projectId'));
	const venue = source.venue.find((row) => text(row, 'id') === text(event, 'venueId'));
	if (!eventId || !project || !venue) return undefined;
	const compositions = new Map(source.composition.map((row) => [text(row, 'id'), row]));
	const performances = source.eventPerformance
		.filter((row) => text(row, 'eventId') === eventId)
		.map((row, index) => {
			const composition = compositions.get(text(row, 'compositionId'));
			const orderIndex = typeof row.orderIndex === 'number' ? row.orderIndex : index + 1;
			return {
				orderIndex,
				encore: row.encore === true,
				title: text(row, 'variationNote') || text(composition, 'title') || '曲名未登録',
				href: buildEntityHref('composition', text(composition, 'slug')),
				variationNote: text(row, 'variationNote') || undefined,
			};
		})
		.sort((left, right) => left.orderIndex - right.orderIndex || left.title.localeCompare(right.title, 'ja'));
	const people = new Map(source.person.map((row) => [text(row, 'id'), row]));
	const participants = source.contribution
		.filter((row) => text(row, 'eventId') === eventId)
		.map((row) => {
			const person = people.get(text(row, 'personId'));
			return { name: text(person, 'name') || '人物未登録', href: buildEntityHref('person', text(person, 'slug')), role: text(row, 'role') || text(row, 'note') || undefined };
		})
		.sort((left, right) => left.name.localeCompare(right.name, 'ja'));
	const sameProject = source.event
		.filter((candidate) => text(candidate, 'projectId') === text(event, 'projectId') && text(candidate, 'eventDate'))
		.sort(
			(left, right) => text(left, 'eventDate').localeCompare(text(right, 'eventDate')) || text(left, 'slug').localeCompare(text(right, 'slug')) || text(left, 'id').localeCompare(text(right, 'id')),
		);
	const position = sameProject.findIndex((candidate) => text(candidate, 'id') === eventId);
	const adjacent = (candidate: Record<string, unknown> | undefined): LiveAdjacentEvent | undefined => {
		if (!candidate) return undefined;
		const date = text(candidate, 'eventDate');
		return { label: text(candidate, 'eventName') || '名称未登録', date, href: buildEntityHref('event', text(candidate, 'slug')) };
	};
	return {
		event: {
			id: eventId,
			name: text(event, 'eventName') || '名称未登録',
			date: text(event, 'eventDate'),
			datePrecision: nullable(text(event, 'eventDatePrecision')),
			slug: nullable(text(event, 'slug')),
			type: text(event, 'type') || 'live',
			startTime: text(event, 'startTime') || undefined,
			ticketPrice: numberValue(event, 'ticketPrice'),
		},
		project: { name: text(project, 'name') || 'プロジェクト未登録', slug: nullable(text(project, 'slug')), href: buildEntityHref('project', text(project, 'slug')) },
		venue: { name: text(venue, 'name') || '会場未登録', slug: nullable(text(venue, 'slug')), href: buildEntityHref('venue', text(venue, 'slug')) },
		performances,
		participants,
		previous: adjacent(position > 0 ? sameProject[position - 1] : undefined),
		next: adjacent(position >= 0 ? sameProject[position + 1] : undefined),
	};
};
