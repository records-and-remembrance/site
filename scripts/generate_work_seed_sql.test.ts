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

describe('multi-work release sources', () => {
	test('assigns each pair of tracks to The Night2 or The Lunch2 release', () => {
		const splitSource: SourceArticle = {
			path: '/tmp/2013-10-02-000000_1.md',
			name: '2013-10-02-000000_1.md',
			stem: '2013-10-02-000000_1',
			title: 'Poet-type.M - The Lunch2 / The Night2 (CD-R)',
			date: '2013-10-02',
			tags: ['Release', 'Poet-type.M', 'Self-Release', 'Demo'],
			body: ['## 収録曲', '', '### The Night2', '', '1. パキシル', '1. ワイン', '', '※DISKUNION 購入者特典', '', '### The Lunch2', '', '1. Blanket', '1. Grace', '', '※TOWER RECORDS 購入者特典'].join(
				'\n',
			),
		};

		const sql = renderSql([splitSource], compositionLookup);
		const trackValues = [...sql.matchAll(/INSERT INTO track[\s\S]*?VALUES \('([^']+)', '([^']+)', '[^']+', (\d+),/g)].map((match) => ({
			releaseId: match[2],
			trackNumber: Number(match[3]),
		}));

		expect(trackValues).toHaveLength(4);
		expect(trackValues.map(({ trackNumber }) => trackNumber)).toEqual([1, 2, 1, 2]);
		expect(new Set(trackValues.slice(0, 2).map(({ releaseId }) => releaseId)).size).toBe(1);
		expect(new Set(trackValues.slice(2).map(({ releaseId }) => releaseId)).size).toBe(1);
		expect(trackValues[0]!.releaseId).not.toBe(trackValues[2]!.releaseId);
	});
});
