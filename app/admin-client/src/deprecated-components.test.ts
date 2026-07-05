import { expect, test } from 'bun:test';

test('does not use deprecated React Aria checkbox components', async () => {
	const source = await Bun.file(new URL('./EditorDialog.tsx', import.meta.url)).text();

	expect(source).not.toMatch(/\bCheckbox\b/);
	expect(source).toContain('CheckboxField');
	expect(source).toContain('CheckboxButton');
});

test('does not use deprecated Select and ComboBox selection props', async () => {
	const source = await Bun.file(new URL('./EditorDialog.tsx', import.meta.url)).text();

	expect(source).not.toContain('selectedKey=');
	expect(source).not.toContain('onSelectionChange=');
});

test('does not use the deprecated React Aria Radio component', async () => {
	const source = await Bun.file(new URL('./MagazineReviewScreen.tsx', import.meta.url)).text();

	expect(source).not.toMatch(/\bRadio\b/);
	expect(source).toContain('RadioField');
	expect(source).toContain('RadioButton');
});
