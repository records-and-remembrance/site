import { expect, test } from 'bun:test';

test('provides an accessible selection-based recording organizer', async () => {
	const source = await Bun.file(new URL('./RecordingOrganizerScreen.tsx', import.meta.url)).text();

	expect(source).toContain('Table');
	expect(source).toContain('selectionMode="multiple"');
	expect(source).toContain('選択をこの録音に統合');
	expect(source).toContain('選択を別録音に分割');
	expect(source).toContain('整理済みにする');
	expect(source).toContain('次の未整理');
	expect(source).toContain('aria-live="polite"');
});
