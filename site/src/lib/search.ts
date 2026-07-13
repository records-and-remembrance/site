import type { SiteSnapshot } from '../data';
import { buildEntityHref } from './site-foundation';

export type SearchRecord = { id: string; title: string; kind: string; href: string; text: string };

const text = (row: Record<string, unknown> | undefined, key: string): string => (typeof row?.[key] === 'string' ? row[key] : '');

export const buildSearchRecords = (snapshot: SiteSnapshot): SearchRecord[] => {
	const records: SearchRecord[] = [];
	const add = (id: string, title: string, kind: string, href: string | undefined, extra = '') => {
		if (title && href) records.push({ id, title, kind, href, text: `${title} ${extra}`.trim() });
	};
	for (const row of snapshot.tables.project) add(`project:${text(row, 'id')}`, text(row, 'name'), 'プロジェクト', buildEntityHref('project', text(row, 'slug')), text(row, 'description'));
	for (const row of snapshot.tables.person) add(`person:${text(row, 'id')}`, text(row, 'name'), '人物', buildEntityHref('person', text(row, 'slug')), text(row, 'description'));
	for (const row of snapshot.tables.work) add(`work:${text(row, 'id')}`, text(row, 'title'), '作品', buildEntityHref('work', text(row, 'slug')), text(row, 'description'));
	for (const row of snapshot.tables.composition) add(`composition:${text(row, 'id')}`, text(row, 'title'), '楽曲', buildEntityHref('composition', text(row, 'slug')), text(row, 'description'));
	for (const row of snapshot.tables.event)
		add(`event:${text(row, 'id')}`, text(row, 'eventName') || text(row, 'eventDate'), 'ライブ', buildEntityHref('event', text(row, 'slug')), text(row, 'eventDate'));
	for (const row of snapshot.tables.venue) add(`venue:${text(row, 'id')}`, text(row, 'name'), '会場', buildEntityHref('venue', text(row, 'slug')), text(row, 'location'));
	for (const row of snapshot.tables.publication)
		add(`publication:${text(row, 'id')}`, text(row, 'name') || text(row, 'title'), '資料', `/library#publication-${text(row, 'libraryKey')}`, text(row, 'description'));
	for (const row of snapshot.tables.publicationIssue)
		add(`issue:${text(row, 'id')}`, text(row, 'title') || text(row, 'name'), '号', `/library#issue-${text(row, 'libraryKey')}`, text(row, 'publishedDate'));
	for (const row of snapshot.tables.article) add(`article:${text(row, 'id')}`, text(row, 'title'), '記事', `/library#article-${text(row, 'libraryKey')}`, text(row, 'content'));
	return records.sort((left, right) => left.title.localeCompare(right.title, 'ja') || left.id.localeCompare(right.id));
};

export const searchRecords = (records: readonly SearchRecord[], query: string): SearchRecord[] => {
	const normalized = query.trim().toLocaleLowerCase('ja-JP');
	if (!normalized) return [];
	return records.filter((record) => record.text.toLocaleLowerCase('ja-JP').includes(normalized));
};
