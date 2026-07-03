import { describe, expect, test } from 'bun:test';
import { mergeDraftSources, mergedTargetFile, parseArgs, parseListItems, resolveMergedTargetFile } from './generate_composition_drafts';

const existingDraft = `---
# generated_by: scripts/generate_composition_drafts.ts
canonical_title: 'City Pop'
status: reviewed
composition_id: '15c8355f-fecc-5942-9c5c-2fbb6e2e0d49'
group_key: 'city pop'
aliases:
  - 'City Pop'
sources:
  - type: live
    file: '2023-01-01-000000.md'
    raw_title: 'City Pop'
---

# City Pop

## Review Notes

- reviewed by human
`;

const generatedDraft = `---
# generated_by: scripts/generate_composition_drafts.ts
canonical_title: 'City Pop'
status: draft
composition_id: null
group_key: 'city pop'
aliases:
  - 'City Pop'
sources:
  -
    type: live
    file: "2023-01-01-000000.md"
    raw_title: "City Pop"
  -
    type: live
    file: '2024-03-08-000000.md'
    raw_title: 'City Pop'
---

# City Pop
`;

describe('mergeDraftSources', () => {
	test('preserves reviewed metadata and notes while adding generated sources once', () => {
		const merged = mergeDraftSources(existingDraft, generatedDraft);

		expect(merged).toContain('status: reviewed');
		expect(merged).toContain("composition_id: '15c8355f-fecc-5942-9c5c-2fbb6e2e0d49'");
		expect(merged).toContain('- reviewed by human');
		expect(merged.match(/file: ['"]2023-01-01-000000\.md['"]/g)).toHaveLength(1);
		expect(merged.match(/file: ['"]2024-03-08-000000\.md['"]/g)).toHaveLength(1);
	});
});

describe('mergedTargetFile', () => {
	test('returns the unescaped target filename from the latest merge note', () => {
		const markdown = `${existingDraft}
## Merge Notes

- 2026-06-14T11:59:32.988Z: merged into 過呼吸\\_(Only_you)-718a9aa3.md
`;

		expect(mergedTargetFile(markdown)).toBe('過呼吸_(Only_you)-718a9aa3.md');
	});

	test('returns null when the draft has not been merged', () => {
		expect(mergedTargetFile(existingDraft)).toBeNull();
	});
});

describe('resolveMergedTargetFile', () => {
	test('falls back to the stable hash when Markdown formatting changed the recorded filename', () => {
		const availableFiles = ['だが、ワインは_赫_(_あか_)_(Deep_Red_Wine)-765ff3ff.md'];

		expect(resolveMergedTargetFile('だが、ワインは*赫*(_あか_)_(Deep_Red_Wine)-765ff3ff.md', availableFiles)).toBe(availableFiles[0]!);
	});
});

describe('parseArgs', () => {
	test('accepts a file allowlist for incremental draft updates', () => {
		const args = parseArgs(['--files', '2023-12-25-000000.md', '2024-03-13-000000.md', '--merge-sources']);

		expect(args.files).toEqual(['2023-12-25-000000.md', '2024-03-13-000000.md']);
		expect(args.mergeSources).toBe(true);
	});
});

describe('parseListItems', () => {
	test('stops collecting song candidates at the article separator', () => {
		const section = ['1. SHINE A LIGHT', '1. 間違い探し', '', '<!--/-->', '* CD EXTRA', '   1. 陽だまりを越えて (Music Video)'].join('\n');

		expect(parseListItems(section)).toEqual([
			{ position: 1, rawTitle: 'SHINE A LIGHT' },
			{ position: 2, rawTitle: '間違い探し' },
		]);
	});
});
