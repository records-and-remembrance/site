import { describe, expect, test } from 'bun:test';
import { buildPublicCounts, snapshotLabel } from './about';

describe('PST-027 About', () => {
	test('manifestの公開件数を0件も省略せず一覧化する', () => {
		const counts = buildPublicCounts({
			snapshotGeneratedAt: '2030-01-02T03:04:05.000Z',
			manifest: { counts: { person: 2, project: 0, work: 3, composition: 0, event: 4, venue: 1, article: 0 } } as never,
		});
		expect(counts).toEqual([
			{ key: 'person', label: '人物', href: '/people', value: 2 },
			{ key: 'project', label: 'プロジェクト', href: '/projects', value: 0 },
			{ key: 'work', label: '作品', href: '/discography', value: 3 },
			{ key: 'composition', label: '楽曲', href: '/songs', value: 0 },
			{ key: 'event', label: 'ライブ', href: '/lives', value: 4 },
			{ key: 'venue', label: '会場', href: '/venues', value: 1 },
			{ key: 'article', label: '記事', href: '/library', value: 0 },
		]);
	});

	test('更新時点を現在時刻ではなくsnapshot値から表示する', () => {
		expect(snapshotLabel('2030-01-02T03:04:05.000Z')).toBe('データスナップショット: 2030-01-02T03:04:05.000Z');
		expect(snapshotLabel('')).toBeUndefined();
	});
});
