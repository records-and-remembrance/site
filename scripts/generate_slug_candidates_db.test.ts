import { describe, expect, test } from 'bun:test';
import { SLUG_ENTITY_TYPES } from './generate_slug_candidates';
import { buildSlugSourceSnapshot, createDatabaseSlugSource, parseArgs } from './generate_slug_candidates_db';

describe('PST-002 DB slug candidate source', () => {
	test('5種の公開対象を安定したsnapshotへ取り出し、sourceSnapshotを保持する', async () => {
		const calls: string[] = [];
		const source = createDatabaseSlugSource(async (sql) => {
			calls.push(sql);
			const table = sql.match(/FROM "([^"]+)"/u)?.[1];
			return {
				rows: table === 'project' ? [{ id: 'project-1', displayName: 'BURGER NUDS', slug: null }] : [{ id: `${table}-1`, displayName: table ?? '', slug: null }],
			};
		});

		const snapshot = await buildSlugSourceSnapshot(source, 'db-2026-07-14T00:00:00Z');

		expect(snapshot).toEqual({
			sourceSnapshot: 'db-2026-07-14T00:00:00Z',
			project: [{ id: 'project-1', displayName: 'BURGER NUDS', slug: null }],
			person: [{ id: 'person-1', displayName: 'person', slug: null }],
			composition: [{ id: 'composition-1', displayName: 'composition', slug: null }],
			work: [{ id: 'work-1', displayName: 'work', slug: null }],
			venue: [{ id: 'venue-1', displayName: 'venue', slug: null }],
		});
		expect(calls).toHaveLength(SLUG_ENTITY_TYPES.length);
	});

	test('sourceSnapshotが空なら再現性のないartifactを作らない', async () => {
		await expect(buildSlugSourceSnapshot(async () => [], '  ')).rejects.toThrow('sourceSnapshot is required');
	});

	test('DBのNULL表示名は空文字に正規化し、slugの既存値は保持する', async () => {
		const source = createDatabaseSlugSource(async () => ({ rows: [{ id: 'work-1', displayName: null, slug: 'existing-work' }] }));
		const snapshot = await buildSlugSourceSnapshot(source, 'db-snapshot');

		expect(snapshot.work).toEqual([{ id: 'work-1', displayName: '', slug: 'existing-work' }]);
	});

	test('CLIはsourceSnapshotを必須とし、出力先を指定できる', () => {
		expect(parseArgs(['--source-snapshot', 'db-snapshot', '--output', '/tmp/candidates.json'])).toEqual({
			output: '/tmp/candidates.json',
			sourceSnapshot: 'db-snapshot',
		});
		expect(() => parseArgs([])).toThrow('--source-snapshot is required');
	});
});
