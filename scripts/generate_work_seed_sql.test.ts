import { describe, expect, test } from 'bun:test';
import { renderSql, type CompositionRef, type SourceArticle } from './generate_work_seed_sql';

const source: SourceArticle = {
	path: '/tmp/LOW NAME.md',
	name: 'LOW NAME.md',
	stem: 'LOW NAME',
	title: 'LOW NAME',
	date: '2005-06-01',
	tags: ['Release'],
	body: ['## 収録曲', '', '1. ミナソコ'].join('\n'),
};

const compositionLookup = new Map<string, CompositionRef | null>();

describe('work seed recording assignments', () => {
	test('creates the initial recording only when the track is new', () => {
		const sql = renderSql([source], compositionLookup);

		expect(sql).toContain('INSERT INTO recording');
		expect(sql).toContain('WHERE NOT EXISTS (');
		expect(sql).toContain('SELECT 1 FROM track WHERE id =');
	});

	test('does not overwrite a manually organized recording assignment', () => {
		const sql = renderSql([source], compositionLookup);
		const trackConflict = sql.match(/INSERT INTO track[\s\S]*?ON CONFLICT \(id\) DO UPDATE([\s\S]*?);/)?.[1];

		expect(trackConflict).toBeDefined();
		expect(trackConflict).not.toContain('recording_id');
		expect(trackConflict).toContain('track_number = EXCLUDED.track_number');
	});

	test('does not recreate a deleted initial recording for an existing track', () => {
		const sql = renderSql([source], compositionLookup);
		const recordingInsert = sql.match(/INSERT INTO recording[\s\S]*?ON CONFLICT \(id\) DO UPDATE[\s\S]*?;/)?.[0];

		expect(recordingInsert).toContain('WHERE NOT EXISTS');
		expect(recordingInsert).toContain('track');
	});
});
