import { describe, expect, test } from 'bun:test';
import { buildReleaseCommands, readReleaseEnvironment, runRelease } from './site_release';

describe('PST-029 site release pipeline', () => {
	test('snapshotと公開URLを必須にし、exportからsmoke checkまで順序を固定する', () => {
		expect(readReleaseEnvironment({ SITE_SNAPSHOT_GENERATED_AT: '2026-07-14T00:00:00.000Z', SITE_PUBLIC_URL: 'https://example.com/preview///' })).toEqual({
			snapshotGeneratedAt: '2026-07-14T00:00:00.000Z',
			publicUrl: 'https://example.com/preview',
		});
		expect(() => readReleaseEnvironment({ SITE_PUBLIC_URL: 'https://example.com' })).toThrow('SITE_SNAPSHOT_GENERATED_AT is required');
		expect(() => readReleaseEnvironment({ SITE_SNAPSHOT_GENERATED_AT: '2026-07-14T00:00:00.000Z' })).toThrow('SITE_PUBLIC_URL is required');

		expect(buildReleaseCommands({ snapshotGeneratedAt: '2026-07-14T00:00:00.000Z', publicUrl: 'https://example.com/preview' })).toEqual([
			{ command: 'bun', args: ['site/export/export.ts', '--snapshot-generated-at', '2026-07-14T00:00:00.000Z'] },
			{ command: 'bun', args: ['run', 'site:build'] },
			{ command: 'bun', args: ['run', 'site:search:index'] },
			{ command: 'bun', args: ['scripts/site_check.ts'] },
			{ command: 'bun', args: ['run', 'site:deploy'] },
			{ command: 'bun', args: ['scripts/site_smoke_check.ts'], env: { SITE_PUBLIC_URL: 'https://example.com/preview' } },
		]);
	});

	test('1つでも失敗したら後続処理を実行しない', () => {
		const calls: string[] = [];
		const result = runRelease(
			[
				{ command: 'first', args: [] },
				{ command: 'second', args: [] },
			],
			(command, args) => {
				calls.push(command);
				return command === 'first' ? 0 : 1;
			},
		);

		expect(result).toEqual({ failed: { command: 'second', args: [], status: 1 }, completed: 1 });
		expect(calls).toEqual(['first', 'second']);
	});
});
