import type { SiteDigEntry, SiteRow, SiteSnapshot } from '../../export/export';
import { buildEntityHref, formatDateText } from './site-foundation';

export type DigCard = { type: 'composition' | 'event' | 'venue'; label: string; summary: string; href: string };
export type DigCandidates = { composition: DigCard[]; event: DigCard[]; venue: DigCard[] };

type DigCounts = {
	performancesByComposition: Map<string, number>;
	performancesByEvent: Map<string, number>;
	eventsByVenue: Map<string, number>;
	idBySlug: Map<string, string>;
	eventDateBySlug: Map<string, string>;
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const countBy = (rows: readonly SiteRow[], key: string): Map<string, number> => {
	const counts = new Map<string, number>();
	for (const row of rows) {
		const id = text(row[key]);
		if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return counts;
};

const buildCounts = (snapshot: SiteSnapshot): DigCounts => {
	const idBySlug = new Map<string, string>();
	const eventDateBySlug = new Map<string, string>();
	for (const rows of [snapshot.tables.composition, snapshot.tables.venue, snapshot.tables.event]) {
		for (const row of rows) {
			const slug = text(row.slug);
			if (slug) idBySlug.set(slug, text(row.id));
		}
	}
	for (const row of snapshot.tables.event) {
		const slug = text(row.slug);
		if (slug) eventDateBySlug.set(slug, text(row.eventDate));
	}
	return {
		performancesByComposition: countBy(snapshot.tables.eventPerformance, 'compositionId'),
		performancesByEvent: countBy(snapshot.tables.eventPerformance, 'eventId'),
		eventsByVenue: countBy(snapshot.tables.event, 'venueId'),
		idBySlug,
		eventDateBySlug,
	};
};

/** カードの一言。設計書 §4.1 の「ある日のセットリスト」「ある曲の旅」「ある会場の歴史」に対応する。 */
const summaryOf = (entry: SiteDigEntry, counts: DigCounts): string => {
	const id = counts.idBySlug.get(entry.slug) ?? '';
	if (entry.type === 'composition') {
		const performances = counts.performancesByComposition.get(id) ?? 0;
		return performances > 0 ? `ライブ演奏 ${performances}回` : 'ライブ演奏の記録なし';
	}
	if (entry.type === 'event') {
		const date = formatDateText(counts.eventDateBySlug.get(entry.slug), 'day') ?? '';
		const songs = counts.performancesByEvent.get(id) ?? 0;
		return [date, songs > 0 ? `${songs}曲` : undefined].filter(Boolean).join(' · ');
	}
	const events = counts.eventsByVenue.get(id) ?? 0;
	return events > 0 ? `公演記録 ${events}件` : '記録上の公演なし';
};

const buildCard = (entry: SiteDigEntry, snapshot: SiteSnapshot, counts: DigCounts): DigCard | undefined => {
	if (entry.type !== 'composition' && entry.type !== 'event' && entry.type !== 'venue') return undefined;
	if (entry.type === 'event') {
		const date = counts.eventDateBySlug.get(entry.slug) ?? '';
		const today = snapshot.snapshotGeneratedAt.slice(0, 10);
		if (today && date && date >= today) return undefined;
	}
	const href = buildEntityHref(entry.type, entry.slug);
	// ラベルは閲覧者に見える名前にする。slugはhrefが表現するもので、本文へ出さない。
	return href ? { type: entry.type, label: entry.summary, summary: summaryOf(entry, counts), href } : undefined;
};

export const buildDigCandidates = (snapshot: SiteSnapshot): DigCandidates => {
	const counts = buildCounts(snapshot);
	const candidates: DigCandidates = { composition: [], event: [], venue: [] };
	for (const entry of snapshot.indexes.dig) {
		const card = buildCard(entry, snapshot, counts);
		if (card) candidates[card.type].push(card);
	}
	for (const type of Object.keys(candidates) as (keyof DigCandidates)[]) candidates[type].sort((left, right) => `${left.label}:${left.href}`.localeCompare(`${right.label}:${right.href}`, 'ja'));
	return candidates;
};

export const pickDigCards = (candidates: DigCandidates, random: () => number = Math.random): DigCard[] =>
	(['composition', 'event', 'venue'] as const).flatMap((type) => {
		const list = candidates[type];
		if (list.length === 0) return [];
		return [list[Math.min(list.length - 1, Math.max(0, Math.floor(random() * list.length)))]];
	});
