import type { SiteDigEntry, SiteSnapshot } from '../../export/export';
import { buildEntityHref } from './site-foundation';

export type DigCard = { type: 'composition' | 'event' | 'venue'; label: string; summary: string; href: string };
export type DigCandidates = { composition: DigCard[]; event: DigCard[]; venue: DigCard[] };

const buildCard = (entry: SiteDigEntry, snapshot: SiteSnapshot): DigCard | undefined => {
	if (entry.type !== 'composition' && entry.type !== 'event' && entry.type !== 'venue') return undefined;
	if (entry.type === 'event') {
		const event = snapshot.tables.event.find((row) => row.slug === entry.slug);
		const date = typeof event?.eventDate === 'string' ? event.eventDate : '';
		const today = snapshot.snapshotGeneratedAt.slice(0, 10);
		if (today && date && date >= today) return undefined;
	}
	const href = buildEntityHref(entry.type, entry.slug);
	return href ? { type: entry.type, label: entry.slug, summary: entry.summary, href } : undefined;
};

export const buildDigCandidates = (snapshot: SiteSnapshot): DigCandidates => {
	const candidates: DigCandidates = { composition: [], event: [], venue: [] };
	for (const entry of snapshot.indexes.dig) {
		const card = buildCard(entry, snapshot);
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
