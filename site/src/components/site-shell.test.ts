import { describe, expect, test } from 'bun:test';
import { isNavigationItemActive, nextTheme, normalizePath, PRIMARY_NAVIGATION, resolveStoredTheme, themeAttribute, type Theme } from './site-shell';

describe('PST-007 site shell contracts', () => {
	test('主要ナビゲーションは§3.2の一覧routeへ到達でき、Digは準備中アンカーを使う', () => {
		expect(PRIMARY_NAVIGATION.map((item) => item.href)).toEqual(['/timeline', '/projects', '/people', '/discography', '/songs', '/lives', '/venues', '/network', '/library', '/about', '/#dig']);
		expect(PRIMARY_NAVIGATION.at(-1)).toMatchObject({ label: 'Dig', pending: true });
		expect(PRIMARY_NAVIGATION.some((item) => item.href === '/dig')).toBe(false);
	});

	test('詳細routeでは対応する一覧ナビゲーションがactiveになるが、Digアンカーはactiveにならない', () => {
		expect(isNavigationItemActive('/projects', '/projects/burger-nuds')).toBe(true);
		expect(isNavigationItemActive('/projects', '/people/masahi-kadota')).toBe(false);
		expect(isNavigationItemActive('/timeline', '/timeline?year=2020')).toBe(true);
		expect(isNavigationItemActive('/#dig', '/')).toBe(false);
	});

	test('パスの末尾slash・query・hashを除去して判定できる', () => {
		expect(normalizePath('projects/')).toBe('/projects');
		expect(normalizePath('/projects/?year=2020#releases')).toBe('/projects');
		expect(normalizePath('')).toBe('/');
	});

	test('テーマの保存値が不正ならsystemへ戻し、systemはdata-themeを上書きしない', () => {
		const themes: Array<[string | null, Theme]> = [
			['light', 'light'],
			['dark', 'dark'],
			['system', 'system'],
			['sepia', 'system'],
			['', 'system'],
			[null, 'system'],
		];

		for (const [stored, expected] of themes) {
			expect(resolveStoredTheme(stored)).toBe(expected);
			expect(themeAttribute(expected)).toBe(expected === 'system' ? undefined : expected);
		}
	});

	test('テーマ切替はlightとdarkを交互に選び、systemからはlightへ復帰する', () => {
		expect(nextTheme('system')).toBe('light');
		expect(nextTheme('light')).toBe('dark');
		expect(nextTheme('dark')).toBe('light');
	});
});
