import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { SITE_TABLE_NAMES, createSiteSnapshot, type SiteDatabaseRows, type SiteRow } from '../../export/export';
import { buildVenueDetail, buildVenueList, type VenueRows } from './venues';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const sourceSiteDirectory = join(repositoryRoot, 'site');
const sourcePagesDirectory = join(sourceSiteDirectory, 'src/pages');

const createRows = (overrides: Partial<SiteDatabaseRows> = {}): SiteDatabaseRows => {
	const rows = Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, [] as SiteRow[]])) as SiteDatabaseRows;
	return { ...rows, ...overrides };
};

const rowsWithVenues = (): SiteDatabaseRows =>
	createRows({
		project: [
			{ id: 'project-alpha', name: 'Alpha', type: 'band', slug: 'alpha', scope: 'monden' },
			{ id: 'project-beta', name: 'Beta', type: 'band', slug: 'beta', scope: 'monden' },
		],
		venue: [
			{ id: 'venue-loft', name: 'LOFT', location: '新宿', slug: 'shinjuku-loft', description: '地下の会場' },
			{ id: 'venue-loft-elsewhere', name: 'LOFT', location: '大阪', slug: null, description: null },
			{ id: 'venue-empty', name: '空会場', location: null, slug: 'empty-venue', description: null },
		],
		event: [
			{ id: 'event-2025-beta', projectId: 'project-beta', venueId: 'venue-loft', type: 'live', eventName: 'Beta公演', eventDate: '2025-05-04', slug: '2025-05-04-shinjuku-loft' },
			{ id: 'event-2024-alpha', projectId: 'project-alpha', venueId: 'venue-loft', type: 'live', eventName: 'Alpha公演', eventDate: '2024-01-02', slug: '2024-01-02-shinjuku-loft' },
			{ id: 'event-2025-alpha', projectId: 'project-alpha', venueId: 'venue-loft', type: 'live', eventName: null, eventDate: '2025-05-04', slug: null },
		],
		eventPerformance: [
			{ id: 'performance-z', eventId: 'event-2025-beta', compositionId: 'composition-z', orderIndex: 1 },
			{ id: 'performance-a', eventId: 'event-2024-alpha', compositionId: 'composition-a', orderIndex: 1 },
			{ id: 'performance-b', eventId: 'event-2025-alpha', compositionId: 'composition-b', orderIndex: 1 },
			{ id: 'performance-a-2', eventId: 'event-2025-beta', compositionId: 'composition-a', orderIndex: 2 },
			{ id: 'performance-other-venue', eventId: 'event-other-venue', compositionId: 'composition-a', orderIndex: 1 },
		],
		composition: [
			{ id: 'composition-z', title: 'Zeta', slug: 'zeta' },
			{ id: 'composition-a', title: 'Alpha Song', slug: 'alpha-song' },
			{ id: 'composition-b', title: 'Beta Song', slug: null },
		],
	});

const buildWithRows = async (rows: SiteDatabaseRows): Promise<{ read: (path: string) => Promise<string>; cleanup: () => Promise<void> }> => {
	const workspace = await mkdtemp(join(tmpdir(), 'monden-pst017-'));
	const siteRoot = join(workspace, 'site');
	await cp(sourceSiteDirectory, siteRoot, {
		recursive: true,
		filter: (source) => {
			if (source.includes(`${join('site', 'dist')}`) || source.includes(`${join('site', '.astro')}`) || source.includes(`${join('site', 'node_modules')}`)) return false;
			if (source === sourcePagesDirectory) return true;
			if (source.startsWith(`${sourcePagesDirectory}/`)) {
				const relativePath = source.slice(`${sourcePagesDirectory}/`.length);
				return ['index.astro', 'venues.astro', 'venues', 'venues/[slug].astro'].includes(relativePath);
			}
			return true;
		},
	});
	await symlink(join(repositoryRoot, 'node_modules'), join(siteRoot, 'node_modules'), 'junction');
	const snapshot = createSiteSnapshot(rows, { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });
	await writeFile(join(siteRoot, 'src/data/site.generated.json'), `${JSON.stringify(snapshot)}\n`, 'utf8');

	const processResult = Bun.spawn([process.execPath, join(repositoryRoot, 'node_modules/astro/bin/astro.mjs'), 'build'], {
		cwd: siteRoot,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [exitCode, stdout, stderr] = await Promise.all([processResult.exited, new Response(processResult.stdout).text(), new Response(processResult.stderr).text()]);
	if (exitCode !== 0) throw new Error(`${stdout}\n${stderr}`);

	return {
		read: (path: string) => readFile(join(siteRoot, 'dist', path), 'utf8'),
		cleanup: () => rm(workspace, { recursive: true, force: true }),
	};
};

describe('PST-017 venue pages', () => {
	test('一覧は会場行を統合せず、event件数とslug確定時だけ詳細リンクを返す', () => {
		const rows = rowsWithVenues();
		const list = buildVenueList(rows as VenueRows);

		expect(list.map((item) => item.venue.name)).toEqual(['LOFT', 'LOFT', '空会場']);
		expect(list.find((item) => item.venue.id === 'venue-loft')?.eventCount).toBe(3);
		expect(list.find((item) => item.venue.id === 'venue-loft')?.href).toBe('/venues/shinjuku-loft');
		expect(list.find((item) => item.venue.id === 'venue-loft-elsewhere')?.href).toBeUndefined();
		expect(list.find((item) => item.venue.id === 'venue-loft-elsewhere')?.eventCount).toBe(0);
	});

	test('詳細は年別履歴・project内訳・venue内の演奏だけを決定的なTop 5に集計する', () => {
		const rows = rowsWithVenues();
		const detail = buildVenueDetail(rows as VenueRows, 'shinjuku-loft');

		expect(detail?.yearCounts).toEqual([
			{ year: '2025', count: 2 },
			{ year: '2024', count: 1 },
		]);
		expect(detail?.projectCounts).toEqual([
			{ projectId: 'project-alpha', label: 'Alpha', href: '/projects/alpha', count: 2 },
			{ projectId: 'project-beta', label: 'Beta', href: '/projects/beta', count: 1 },
		]);
		expect(detail?.topSongs).toEqual([
			{ compositionId: 'composition-a', label: 'Alpha Song', href: '/songs/alpha-song', count: 2 },
			{ compositionId: 'composition-b', label: 'Beta Song', href: undefined, count: 1 },
			{ compositionId: 'composition-z', label: 'Zeta', href: '/songs/zeta', count: 1 },
		]);
		const originalRows = rowsWithVenues();
		const reorderedRows = {
			...originalRows,
			eventPerformance: [...originalRows.eventPerformance].reverse(),
			composition: [...originalRows.composition].reverse(),
		};
		expect(buildVenueDetail(reorderedRows as VenueRows, 'shinjuku-loft')?.topSongs).toEqual(detail?.topSongs);
		expect(detail?.events.map((event) => event.href)).toEqual([undefined, '/lives/2025-05-04-shinjuku-loft', '/lives/2024-01-02-shinjuku-loft']);
	});

	test('一覧と詳細を静的buildし、リンク・slug欠落・空状態を表示する', async () => {
		const rows = rowsWithVenues();
		const built = await buildWithRows(rows);
		try {
			const index = await built.read('venues/index.html');
			const detail = await built.read('venues/shinjuku-loft/index.html');
			const empty = await built.read('venues/empty-venue/index.html');

			expect(index).toContain('新宿');
			expect(index).toContain('3件');
			expect(index).toContain('href="/venues/shinjuku-loft"');
			expect(index).toContain('LOFT');
			expect(index).not.toContain('href="/venues/"');
			expect(detail).toContain('2025年');
			expect(detail).toContain('Alpha');
			expect(detail).toContain('href="/projects/alpha"');
			expect(detail).toContain('Beta公演');
			expect(detail).toContain('href="/lives/2025-05-04-shinjuku-loft"');
			expect(detail).toContain('Alpha Song');
			expect(detail).toContain('href="/songs/alpha-song"');
			expect(detail).toContain('Beta Song');
			expect(detail).not.toContain('href="/songs/"');
			expect(empty).toContain('記録上の公演なし');
			expect(empty).toContain('0件');
		} finally {
			await built.cleanup();
		}
	});
});
