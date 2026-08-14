import { buildEntityHref } from './site-foundation';
import { projectColorToken } from './home';

export type TimelineSource = {
	project: readonly Record<string, unknown>[];
	release: readonly Record<string, unknown>[];
	work: readonly Record<string, unknown>[];
	event: readonly Record<string, unknown>[];
	membership: readonly Record<string, unknown>[];
	person: readonly Record<string, unknown>[];
};

export type TimelineEntry = {
	id: string;
	kind: 'release' | 'event' | 'membership' | 'project';
	date: string;
	year: string;
	month: string;
	label: string;
	detail?: string;
	href?: string;
	projectSlug?: string;
	projectColor: string;
	aggregated: boolean;
	filterValues: { project: readonly string[]; kind: readonly string[] };
};

/** 種別のサイト表記（設計書 §3.1）。DBのテーブル名を画面へ出さない。 */
export const TIMELINE_KIND_LABELS: Record<TimelineEntry['kind'], string> = { event: 'ライブ', membership: '在籍', project: 'プロジェクト', release: '発売' };

/** 集約行のフィルタ値。まとめた個別エントリのいずれかに一致すれば、その行を残す。 */
export const mergeFilterValues = (entries: readonly TimelineEntry[]): TimelineEntry['filterValues'] => ({
	project: [...new Set(entries.flatMap((entry) => entry.filterValues.project))].sort(),
	kind: [...new Set(entries.flatMap((entry) => entry.filterValues.kind))].sort(),
});

const text = (row: Record<string, unknown> | undefined, key: string): string => (typeof row?.[key] === 'string' ? row[key] : '');
const dateOf = (row: Record<string, unknown>, ...keys: string[]): string => keys.map((key) => text(row, key)).find((value) => /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u.test(value)) ?? '';
const yearOf = (date: string): string => date.slice(0, 4);
const monthOf = (date: string): string => (date.length >= 7 ? date.slice(0, 7) : `${date.slice(0, 4)}-01`);

export const buildTimeline = (source: TimelineSource): TimelineEntry[] => {
	const projects = new Map(source.project.map((row) => [text(row, 'id'), row]));
	const people = new Map(source.person.map((row) => [text(row, 'id'), row]));
	const works = new Map(source.work.map((row) => [text(row, 'id'), row]));
	const entries: TimelineEntry[] = [];
	const add = (entry: Omit<TimelineEntry, 'year' | 'month' | 'filterValues'>) => {
		if (!entry.date) return;
		entries.push({
			...entry,
			year: yearOf(entry.date),
			month: monthOf(entry.date),
			projectColor: projectColorToken(entry.projectSlug),
			filterValues: { project: entry.projectSlug ? [entry.projectSlug] : [], kind: [entry.kind] },
		});
	};
	for (const release of source.release) {
		const date = dateOf(release, 'releaseDate');
		const work = works.get(text(release, 'workId'));
		const project = projects.get(text(work, 'projectId'));
		add({
			id: `release:${text(release, 'id')}`,
			kind: 'release',
			date,
			label: text(work, 'title') || '作品未登録',
			detail: text(release, 'format') || undefined,
			href: buildEntityHref('work', text(work, 'slug')),
			projectSlug: text(project, 'slug') || undefined,
			aggregated: false,
		});
	}
	for (const event of source.event) {
		const date = dateOf(event, 'eventDate');
		const project = projects.get(text(event, 'projectId'));
		add({
			id: `event:${text(event, 'id')}`,
			kind: 'event',
			date,
			label: text(event, 'eventName') || 'ライブ',
			detail: text(project, 'name') || undefined,
			href: buildEntityHref('event', text(event, 'slug')),
			projectSlug: text(project, 'slug') || undefined,
			aggregated: yearOf(date) === '2006' || yearOf(date) === '2007',
		});
	}
	for (const membership of source.membership) {
		const project = projects.get(text(membership, 'projectId'));
		const person = people.get(text(membership, 'personId'));
		const fromDate = dateOf(membership, 'fromDate');
		add({
			id: `membership:${text(membership, 'id')}:from`,
			kind: 'membership',
			date: fromDate,
			label: text(person, 'name') || '人物未登録',
			detail: `${text(project, 'name') || 'プロジェクト未登録'} 在籍開始`,
			href: buildEntityHref('person', text(person, 'slug')),
			projectSlug: text(project, 'slug') || undefined,
			aggregated: false,
		});
		const toDate = dateOf(membership, 'toDate');
		add({
			id: `membership:${text(membership, 'id')}:to`,
			kind: 'membership',
			date: toDate,
			label: text(person, 'name') || '人物未登録',
			detail: `${text(project, 'name') || 'プロジェクト未登録'} 在籍終了`,
			href: buildEntityHref('person', text(person, 'slug')),
			projectSlug: text(project, 'slug') || undefined,
			aggregated: false,
		});
	}
	for (const project of source.project.filter((row) => text(row, 'scope') !== 'external')) {
		const slug = text(project, 'slug') || undefined;
		add({
			id: `project:${text(project, 'id')}:start`,
			kind: 'project',
			date: dateOf(project, 'startDate'),
			label: text(project, 'name') || 'プロジェクト未登録',
			detail: '活動開始',
			href: buildEntityHref('project', slug),
			projectSlug: slug,
			aggregated: false,
		});
		add({
			id: `project:${text(project, 'id')}:end`,
			kind: 'project',
			date: dateOf(project, 'endDate'),
			label: text(project, 'name') || 'プロジェクト未登録',
			detail: '活動終了',
			href: buildEntityHref('project', slug),
			projectSlug: slug,
			aggregated: false,
		});
	}
	return entries.sort((left, right) => left.date.localeCompare(right.date) || left.month.localeCompare(right.month) || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
};
