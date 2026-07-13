import { describe, expect, test } from 'bun:test';
import { buildArtworkDisplay, buildEntityHref, formatDateText, normalizeAdjacentLinks, type AdjacentLink } from './site-foundation';

describe('PST-008 shared site foundation', () => {
	test('確定slugからだけ公開routeを作り、欠落・不正値ではhrefを返さない', () => {
		expect(buildEntityHref('project', 'burger-nuds')).toBe('/projects/burger-nuds');
		expect(buildEntityHref('person', 'masahi-kadota')).toBe('/people/masahi-kadota');
		expect(buildEntityHref('composition', 'analyze')).toBe('/songs/analyze');
		expect(buildEntityHref('work', 'first-album')).toBe('/discography/first-album');
		expect(buildEntityHref('venue', 'shinjuku-loft')).toBe('/venues/shinjuku-loft');
		expect(buildEntityHref('event', '2020-01-01-shinjuku-loft')).toBe('/lives/2020-01-01-shinjuku-loft');
		expect(buildEntityHref('project', null)).toBeUndefined();
		expect(buildEntityHref('project', 'project uuid')).toBeUndefined();
	});

	test('日付文字列をUTC/local Dateへ変換せず、精度に応じて表示する', () => {
		expect(formatDateText('1999-03-10', 'year')).toBe('1999年');
		expect(formatDateText('1999-03-10', 'month')).toBe('1999年3月');
		expect(formatDateText('1999-03-10', 'day')).toBe('1999年3月10日');
		expect(formatDateText('1999-03-10', null)).toBe('1999年3月10日');
		expect(formatDateText('2026-12-31', 'day')).toBe('2026年12月31日');
		expect(formatDateText('2020-02-30', 'day')).toBeUndefined();
		expect(formatDateText(null, 'day')).toBeUndefined();
	});

	test('許可originの画像だけをCloudflare Images変換し、サイズを保持する', () => {
		const image = buildArtworkDisplay(
			{ url: 'https://cdn.example.test/artwork.jpg?version=1', width: 600, height: 400 },
			{ allowedOrigins: ['https://cdn.example.test'], transformOrigin: 'https://archive.example.test', width: 300 },
		);
		expect(image).toEqual({
			kind: 'image',
			src: 'https://archive.example.test/cdn-cgi/image/width=300/https%3A%2F%2Fcdn.example.test%2Fartwork.jpg%3Fversion%3D1',
			width: 600,
			height: 400,
		});

		expect(buildArtworkDisplay({ url: 'http://private.example.test/a.jpg', width: 100, height: 100 }, { allowedOrigins: ['https://private.example.test'], width: 100 })).toEqual({ kind: 'fallback' });
		expect(buildArtworkDisplay({ url: null, width: null, height: null }, { allowedOrigins: [] })).toEqual({ kind: 'fallback' });
	});

	test('隣接リンクは有効なhrefだけを重複なく残す', () => {
		const links: AdjacentLink[] = [
			{ label: '作品', href: '/discography/work' },
			{ label: '作品重複', href: '/discography/work' },
			{ label: '未確定', href: undefined },
			{ label: 'ライブ', href: '/lives/live' },
		];
		expect(normalizeAdjacentLinks(links)).toEqual([
			{ label: '作品', href: '/discography/work' },
			{ label: 'ライブ', href: '/lives/live' },
		]);
	});
});
