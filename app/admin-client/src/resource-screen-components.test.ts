import { expect, test } from 'bun:test';

test('keeps ResourceScreen focused on screen-level orchestration', async () => {
	const source = await Bun.file(new URL('./ResourceScreen.tsx', import.meta.url)).text();

	expect(source).toContain('./components/ResourceTable');
	expect(source).toContain('./components/ResourceDetailPanel');
	expect(source).not.toContain('function DetailPanel');
	expect(source).not.toContain('function RelationSection');
});
