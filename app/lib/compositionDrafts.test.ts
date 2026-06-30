import { describe, expect, test } from 'bun:test';
import { mergeSources } from './compositionDrafts';

describe('mergeSources', () => {
	test('preserves both inline and standalone YAML list item styles', () => {
		const existing = `  - type: live
    file: 'existing.md'
    raw_title: 'Existing song'`;
		const generated = `  -
    type: live
    file: "new.md"
    raw_title: "New song"`;

		const merged = mergeSources(existing, generated);

		expect(merged).toContain("file: 'existing.md'");
		expect(merged).toContain('file: "new.md"');
	});
});
