import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { SITE_TABLE_NAMES, type SiteDatabaseRows, type SiteRow } from '../../export/export';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const sourceSiteDirectory = join(repositoryRoot, 'site');
const sourcePagesDirectory = join(sourceSiteDirectory, 'src/pages');

const createRows = (overrides: Partial<SiteDatabaseRows> = {}): SiteDatabaseRows => {
	const rows = Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, [] as SiteRow[]])) as SiteDatabaseRows;
	return { ...rows, ...overrides };
};

const createSnapshot = (rows: SiteDatabaseRows): Record<string, unknown> => ({
	title: '門田匡陽アーカイブ',
	description: 'ライブ一覧テスト',
	featuredProject: 'Alpha',
	schemaVersion: 1,
	snapshotGeneratedAt: '2026-01-01T00:00:00.000Z',
	tables: rows,
	indexes: { dig: [], monthDay: {} },
	manifest: {
		schemaVersion: 1,
		snapshotGeneratedAt: '2026-01-01T00:00:00.000Z',
		contentHash: 'pst-015-test',
		counts: Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, rows[tableName].length])),
		errors: [],
		warnings: [],
	},
});

const runStaticBuild = async (rows: SiteDatabaseRows): Promise<string> => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'pst-015-'));
	const temporarySiteDirectory = join(temporaryRoot, 'site');
	try {
		await cp(sourceSiteDirectory, temporarySiteDirectory, {
			recursive: true,
			filter: (source) => {
				if (source.includes(`${join('site', 'dist')}`) || source.includes(`${join('site', '.astro')}`) || source.includes(`${join('site', 'node_modules')}`)) return false;
				if (source === sourcePagesDirectory) return true;
				if (source.startsWith(`${sourcePagesDirectory}/`)) return ['index.astro', 'lives.astro'].includes(relative(sourcePagesDirectory, source));
				return true;
			},
		});
		await symlink(join(repositoryRoot, 'node_modules'), join(temporarySiteDirectory, 'node_modules'), 'junction');
		await writeFile(join(temporarySiteDirectory, 'src/data/site.generated.json'), `${JSON.stringify(createSnapshot(rows))}\n`, 'utf8');

		const processResult = Bun.spawn([process.execPath, join(repositoryRoot, 'node_modules/astro/bin/astro.mjs'), 'build'], {
			cwd: temporarySiteDirectory,
			stdout: 'pipe',
			stderr: 'pipe',
		});
		const [exitCode, stdout, stderr] = await Promise.all([processResult.exited, new Response(processResult.stdout).text(), new Response(processResult.stderr).text()]);
		expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
		return readFile(join(temporarySiteDirectory, 'dist/lives/index.html'), 'utf8');
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
};

const rowsWithEvents = createRows({
	project: [
		{ id: 'project-alpha', name: 'Alpha', type: 'band', slug: 'alpha', scope: 'monden' },
		{ id: 'project-beta', name: 'Beta', type: 'band', slug: 'beta', scope: 'monden' },
	],
	venue: [
		{ id: 'venue-first', name: 'First Venue', location: null, slug: 'first-venue' },
		{ id: 'venue-second', name: 'Second Venue', location: null, slug: 'second-venue' },
	],
	event: [
		{
			id: 'event-past',
			projectId: 'project-alpha',
			venueId: 'venue-first',
			type: 'live',
			eventName: 'Past live',
			eventDate: '2024-01-02',
			slug: '2024-01-02-first-venue',
			startTime: null,
			ticketPrice: null,
		},
		{
			id: 'event-null-name',
			projectId: 'project-beta',
			venueId: 'venue-second',
			type: 'live',
			eventName: null,
			eventDate: '2025-05-04',
			slug: '2025-05-04-second-venue',
			startTime: null,
			ticketPrice: null,
		},
		{
			id: 'event-alpha-same-day',
			projectId: 'project-alpha',
			venueId: 'venue-first',
			type: 'live',
			eventName: 'Alpha same day',
			eventDate: '2025-05-04',
			slug: '2025-05-04-first-venue',
			startTime: null,
			ticketPrice: null,
		},
		{
			id: 'event-future',
			projectId: 'project-alpha',
			venueId: 'venue-first',
			type: 'live',
			eventName: 'Future live',
			eventDate: '2026-10-10',
			slug: '2026-10-10-first-venue',
			startTime: null,
			ticketPrice: null,
		},
	],
	eventPerformance: [
		{ id: 'performance-1', eventId: 'event-null-name', compositionId: 'composition-1', orderIndex: 1 },
		{ id: 'performance-2', eventId: 'event-alpha-same-day', compositionId: 'composition-1', orderIndex: 1 },
		{ id: 'performance-3', eventId: 'event-alpha-same-day', compositionId: 'composition-2', orderIndex: 2 },
	],
});

describe('PST-015 lives index', () => {
	test('年別件数、決定的な同日順、EntityLink、セットリスト数、予定表示を静的buildへ反映する', async () => {
		const html = await runStaticBuild(rowsWithEvents);

		expect(html).toContain('2026 (1)');
		expect(html).toContain('2025 (2)');
		expect(html).toContain('2024 (1)');
		expect(html).toContain('href="#year-2026"');
		expect(html).toContain('href="/lives/2026-10-10-first-venue"');
		expect(html).toContain('href="/projects/alpha"');
		expect(html).toContain('href="/projects/beta"');
		expect(html).toContain('href="/venues/first-venue"');
		expect(html).toContain('href="/venues/second-venue"');
		expect(html).toContain('予定');
		expect(html).toContain('名称未登録');
		expect(html).toContain('2曲');
		expect(html).toContain('1曲');
		expect(html).toContain('0曲');
		expect(html).toContain('セットリスト未登録');
		expect(html).not.toContain('開始時刻');
		expect(html).not.toContain('チケット料金');

		const alphaPosition = html.indexOf('Alpha same day');
		const betaPosition = html.indexOf('名称未登録');
		expect(alphaPosition).toBeGreaterThan(-1);
		expect(betaPosition).toBeGreaterThan(alphaPosition);
	});

	test('eventが空なら年セレクタを捏造せず空データ表示でbuildできる', async () => {
		const html = await runStaticBuild(createRows());

		expect(html).toContain('ライブの記録はありません');
		expect(html).not.toContain('年別に見る');
		expect(html).not.toContain('event-performance');
	});
});
