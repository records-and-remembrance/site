import { describe, expect, test } from 'bun:test';
import { buildSlugCandidateArtifact, parseArgs, renderSlugCandidateArtifact, slugify, type SlugSnapshot } from './generate_slug_candidates';

describe('slugify', () => {
	test.each([
		['ANALYZE', 'analyze'],
		['Good Dog Happy Men', 'good-dog-happy-men'],
		['Poet-type.M', 'poet-type-m'],
		['黄金の鐘', 'ougon-no-kane'],
		['新宿MARZ', 'shinjuku-marz'],
		['がっこう', 'gakkou'],
		['きゃりー', 'kyarii'],
	])('%sを決定的な候補へ変換する', (displayName, expected) => {
		expect(slugify(displayName)).toBe(expected);
	});

	test('記号だけの表示名は空候補として扱う', () => {
		expect(slugify('！？・')).toBeNull();
	});

	test('変換不能な漢字を推測で捨てず、注入した読みで変換できる', () => {
		const resolveJapaneseReading = (value: string): string | null => (value === '未知漢字' ? 'みち かんじ' : null);

		expect(slugify('未知漢字', { resolveJapaneseReading })).toBe('michi-kanji');
		expect(slugify('未知漢字')).toBeNull();
	});
});

describe('buildSlugCandidateArtifact', () => {
	test('5種類の公開対象を含むartifactを作り、衝突を-2で解決する', () => {
		const snapshot: SlugSnapshot = {
			sourceSnapshot: 'db-snapshot.json',
			project: [
				{ id: 'project-2', displayName: 'ANALYZE', slug: null },
				{ id: 'project-1', displayName: 'ANALYZE', slug: null },
			],
			person: [{ id: 'person-1', displayName: '門田匡陽', slug: 'approved-kadota' }],
			composition: [{ id: 'composition-1', displayName: '黄金の鐘', slug: null }],
			work: [{ id: 'work-1', displayName: 'Most beautiful in the world', slug: null }],
			venue: [{ id: 'venue-1', displayName: '新宿LOFT', slug: null }],
		};

		const artifact = buildSlugCandidateArtifact(snapshot);
		const projectCandidates = artifact.records.filter((record) => record.entityType === 'project');

		expect(artifact.schemaVersion).toBe(1);
		expect(artifact.sourceSnapshot).toBe('db-snapshot.json');
		expect(artifact.records).toHaveLength(6);
		expect(projectCandidates.map((record) => record.candidateSlug)).toEqual(['analyze', 'analyze-2']);
		expect(projectCandidates.every((record) => record.collision?.detected)).toBe(true);
		expect(projectCandidates[0]?.collision?.conflictingEntityIds).toEqual(['project-1', 'project-2']);
		expect(artifact.summary).toEqual({
			total: 6,
			proposed: 3,
			preserved: 1,
			needsReview: 2,
			collisions: 2,
			unresolved: 0,
		});
	});

	test('既存slugを変更せず、空候補と変換不能値をレビュー対象として残す', () => {
		const snapshot: SlugSnapshot = {
			project: [
				{ id: 'existing', displayName: '表示名変更後', slug: 'published-name' },
				{ id: 'empty', displayName: '!!!', slug: null },
				{ id: 'unresolved', displayName: '未登録漢字', slug: null },
			],
			person: [],
			composition: [],
			work: [],
			venue: [],
		};
		const before = structuredClone(snapshot);

		const artifact = buildSlugCandidateArtifact(snapshot);
		const existing = artifact.records.find((record) => record.id === 'existing');
		const empty = artifact.records.find((record) => record.id === 'empty');
		const unresolved = artifact.records.find((record) => record.id === 'unresolved');

		expect(snapshot).toEqual(before);
		expect(existing).toMatchObject({
			existingSlug: 'published-name',
			candidateSlug: 'published-name',
			status: 'preserved',
		});
		expect(empty).toMatchObject({ candidateSlug: null, status: 'needs_review' });
		expect(empty?.diagnostics.map((diagnostic) => diagnostic.code)).toContain('empty-candidate');
		expect(unresolved).toMatchObject({ candidateSlug: null, status: 'needs_review' });
		expect(unresolved?.diagnostics.map((diagnostic) => diagnostic.code)).toContain('untransliterated-characters');
		expect(artifact.summary.unresolved).toBe(2);
	});

	test('同じスナップショットを入力順を変えても同じartifactを生成する', () => {
		const snapshot: SlugSnapshot = {
			sourceSnapshot: 'same.json',
			project: [
				{ id: '2', displayName: '黄金の鐘', slug: null },
				{ id: '1', displayName: '黄金の鐘', slug: null },
			],
			person: [],
			composition: [],
			work: [],
			venue: [],
		};
		const reversed = { ...snapshot, project: [...snapshot.project].reverse() };

		expect(buildSlugCandidateArtifact(reversed)).toEqual(buildSlugCandidateArtifact(snapshot));
	});

	test('artifactをレビュー用JSONとして改行付きでシリアライズする', () => {
		const artifact = buildSlugCandidateArtifact({
			project: [{ id: 'project-1', displayName: 'ANALYZE', slug: null }],
			person: [],
			composition: [],
			work: [],
			venue: [],
		});

		const rendered = renderSlugCandidateArtifact(artifact);
		expect(rendered.endsWith('\n')).toBe(true);
		expect(JSON.parse(rendered)).toEqual(artifact);
	});
});

test('CLI引数は入力と出力を関数の値として受け取る', () => {
	expect(parseArgs(['--input', 'snapshot.json', '--output', 'candidates.json'])).toEqual({
		input: 'snapshot.json',
		output: 'candidates.json',
	});
});
