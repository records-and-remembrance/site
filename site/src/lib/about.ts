import type { SiteSnapshot } from '../data';

export type PublicCount = { key: string; label: string; value: number; href: string };

const COUNT_DEFINITIONS = [
	['person', '人物', '/people'],
	['project', 'プロジェクト', '/projects'],
	['work', '作品', '/discography'],
	['composition', '楽曲', '/songs'],
	['event', 'ライブ', '/lives'],
	['venue', '会場', '/venues'],
	['article', '記事', '/library'],
] as const;

export const buildPublicCounts = (snapshot: Pick<SiteSnapshot, 'manifest' | 'snapshotGeneratedAt'>): PublicCount[] =>
	COUNT_DEFINITIONS.map(([key, label, href]) => ({ key, label, href, value: snapshot.manifest.counts[key] ?? 0 }));

export const snapshotLabel = (snapshotGeneratedAt: string): string | undefined => {
	if (!snapshotGeneratedAt) return undefined;
	return `データスナップショット: ${snapshotGeneratedAt}`;
};
