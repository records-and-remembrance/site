import { expect, test } from 'bun:test';

test('provides an accessible sequential slug review workspace', async () => {
	const source = await Bun.file(new URL('./SlugReviewScreen.tsx', import.meta.url)).text();
	const styles = await Bun.file(new URL('../../styles.css', import.meta.url)).text();

	expect(source).toContain('role="list"');
	expect(source).toContain('次の未確認');
	expect(source).toContain('確定するslug');
	expect(source).toContain('対象外として保存');
	expect(source).toContain('artifact出力');
	expect(source).toContain('aria-live="polite"');
	expect(source).toContain('SearchField');
	expect(source).toContain('候補の根拠');
	expect(styles).toContain('.slug-list-item[data-focus-visible]');
	expect(styles).toContain('.slug-decision-field[data-focus-within]');
});
