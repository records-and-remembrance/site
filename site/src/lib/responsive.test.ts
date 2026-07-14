import { describe, expect, test } from 'bun:test';

const globalCss = await Bun.file(`${import.meta.dir}/../styles/global.css`).text();
const tokensCss = await Bun.file(`${import.meta.dir}/../styles/tokens.css`).text();
const artworkSource = await Bun.file(`${import.meta.dir}/../components/Artwork.astro`).text();
const networkSource = await Bun.file(`${import.meta.dir}/../pages/network.astro`).text();

describe('PST-028 responsive, accessibility, and performance contracts', () => {
	test('320pxから1024px以上までのレイアウト境界を明示し、本文の横溢れを抑える', () => {
		expect(globalCss).toContain('min-width: 320px');
		expect(globalCss).toContain('@media (max-width: 639px)');
		expect(globalCss).toContain('@media (min-width: 640px) and (max-width: 1023px)');
		expect(globalCss).toContain('@media (min-width: 1024px)');
		expect(globalCss).toMatch(/\.site-main\s*\{[\s\S]*?min-width:\s*0;/u);
		expect(globalCss).toMatch(/\.site-main\s*\{[\s\S]*?overflow-x:\s*clip;/u);
	});

	test('640px未満ではnetworkのグラフを隠し、キーボードでも使える静的一覧を1列で表示する', () => {
		expect(globalCss).toMatch(/@media \(max-width: 639px\)[\s\S]*?\.network-graph\s*\{[\s\S]*?display:\s*none;/u);
		expect(globalCss).toMatch(/@media \(max-width: 639px\)[\s\S]*?\.network-list\s*\{[\s\S]*?grid-template-columns:\s*1fr;/u);
		expect(globalCss).toMatch(/\.network-list\s+button[\s\S]*?min-block-size:\s*var\(--touch-target\);/u);
		expect(networkSource).toContain('<ul class="network-list">');
		expect(networkSource).toContain('<EntityLink type="person"');
	});

	test('reduced-motion時はスクロール、遷移、アニメーションを停止する', () => {
		expect(tokensCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/u);
		expect(globalCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration:\s*0\.01ms\s*!important;/u);
		expect(globalCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?scroll-behavior:\s*auto\s*!important;/u);
		expect(globalCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration:\s*0\.01ms\s*!important;/u);
	});

	test('focus表示、44px操作領域、タップ遅延対策、数値の桁揃えを共通化する', () => {
		expect(globalCss).toMatch(/:focus-visible\s*\{[\s\S]*?outline:\s*3px solid var\(--focus-ring\);/u);
		expect(globalCss).toContain('.skip-link:focus-visible');
		expect(globalCss).toMatch(/button,\s*a\s*\{[\s\S]*?min-block-size:\s*var\(--touch-target\);/u);
		expect(globalCss).toMatch(/:where\(button, a, input, select, textarea, summary\)\s*\{[\s\S]*?touch-action:\s*manipulation;/u);
		expect(globalCss).toContain('font-variant-numeric: tabular-nums');
		expect(globalCss).not.toContain('outline: none');
	});

	test('ArtworkはCLSを抑える寸法と画面外読み込み方針をHTML契約として持つ', () => {
		expect(artworkSource).toMatch(/<img[\s\S]*?width=\{display\.width\}[\s\S]*?height=\{display\.height\}/u);
		expect(artworkSource).toMatch(/<img[\s\S]*?loading=\{loading\}/u);
		expect(artworkSource).toMatch(/<img[\s\S]*?decoding="async"/u);
		expect(artworkSource).toContain("loading?: 'lazy' | 'eager'");
	});
});
