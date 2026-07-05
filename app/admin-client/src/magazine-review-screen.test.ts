import { expect, test } from 'bun:test';

test('provides an accessible magazine review workspace', async () => {
	const source = await Bun.file(new URL('./MagazineReviewScreen.tsx', import.meta.url)).text();
	const styles = await Bun.file(new URL('./styles.css', import.meta.url)).text();

	expect(source).toContain('role="list"');
	expect(source).toContain('onPress={() => selectRecordKey(record.sourceKey)}');
	expect(source).toContain('SearchField');
	expect(source).toContain('RadioGroup');
	expect(source.match(/className="decision-radio-button"/g)).toHaveLength(3);
	expect(styles).toContain('.decision-radio-button[data-selected]');
	expect(styles).toContain('.decision-radio-button[data-focus-visible]');
	expect(source).toContain('未確認');
	expect(source).toContain('承認');
	expect(source).toContain('要修正');
	expect(source).toContain('対象外');
	expect(source).toContain('原文');
	expect(source).toContain('抽出候補');
	expect(source).toContain('次の未確認');
	expect(source).toContain('aria-live="polite"');
});
