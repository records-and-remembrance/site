import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { SITE_TABLE_NAMES, createSiteSnapshot, emptySiteDatabaseRows, type SiteDatabaseRows, type SiteRow } from '../../export/export';
import { buildSongDetail, type SongDetailSource } from './song-detail';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const sourceSiteDirectory = join(repositoryRoot, 'site');
const sourcePagesDirectory = join(sourceSiteDirectory, 'src/pages');

const createRows = (overrides: Partial<SiteDatabaseRows> = {}): SiteDatabaseRows => {
	const rows = Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, [] as SiteRow[]])) as SiteDatabaseRows;
	return { ...rows, ...overrides };
};

const rows = createRows({
	project: [{ id: 'project-alpha', name: 'Alpha', slug: 'alpha', scope: 'monden' }],
	person: [
		{ id: 'person-a', name: 'Person A', slug: 'person-a' },
		{ id: 'person-b', name: 'Person B', slug: 'person-b' },
		{ id: 'person-c', name: 'Person C', slug: 'person-c' },
	],
	composition: [
		{ id: 'composition-song', title: 'Fixture Song', description: '曲の説明', slug: 'fixture-song' },
		{ id: 'composition-live-only', title: 'Live Only Song', description: null, slug: 'live-only-song' },
		{ id: 'composition-empty', title: 'Empty Song', description: null, slug: 'empty-song' },
		{ id: 'composition-unplaced', title: 'Unplaced Recording Song', description: null, slug: 'unplaced-recording-song' },
	],
	compositionCredit: [
		{ id: 'credit-composer-b', compositionId: 'composition-song', personId: 'person-b', creditType: 'composer', orderIndex: 2 },
		{ id: 'credit-lyricist-c', compositionId: 'composition-song', personId: 'person-c', creditType: 'lyricist', orderIndex: 1 },
		{ id: 'credit-composer-a', compositionId: 'composition-song', personId: 'person-a', creditType: 'composer', orderIndex: 1 },
	],
	work: [{ id: 'work-alpha', projectId: 'project-alpha', title: 'Fixture Album', type: 'original', releasedDate: '2020-04-01', slug: 'fixture-album' }],
	release: [
		{
			id: 'release-new',
			workId: 'work-alpha',
			format: '配信',
			releaseDate: '2021-05-01',
			editionKey: 'digital-2021',
			editionType: 'reissue',
		},
		{
			id: 'release-first',
			workId: 'work-alpha',
			format: 'CD',
			releaseDate: '2020-04-01',
			editionKey: 'cd-2020',
			editionType: 'original',
		},
	],
	recording: [
		{
			id: 'recording-album',
			compositionId: 'composition-song',
			type: 'studio',
			versionName: 'Album version',
			versionDescription: 'アルバム用録音',
			recordingYear: 1999,
		},
		{ id: 'recording-unplaced', compositionId: 'composition-unplaced', type: 'demo', versionName: null, versionDescription: null, recordingYear: 1987 },
	],
	track: [
		{ id: 'track-new', releaseId: 'release-new', recordingId: 'recording-album', trackNumber: 1 },
		{ id: 'track-first', releaseId: 'release-first', recordingId: 'recording-album', trackNumber: 2 },
	],
	venue: [{ id: 'venue-club', name: 'Fixture Club', location: 'Tokyo', slug: 'fixture-club' }],
	event: [
		{
			id: 'event-song',
			projectId: 'project-alpha',
			venueId: 'venue-club',
			type: 'live',
			eventName: 'Fixture Live',
			eventDate: '2022-06-07',
			slug: '2022-06-07-fixture-club',
		},
		{
			id: 'event-live-only',
			projectId: 'project-alpha',
			venueId: 'venue-club',
			type: 'live',
			eventName: 'Live Only Live',
			eventDate: '2023-08-09',
			slug: '2023-08-09-fixture-club',
		},
	],
	eventPerformance: [
		{
			id: 'performance-song',
			eventId: 'event-song',
			compositionId: 'composition-song',
			orderIndex: 3,
			encore: true,
			variationNote: 'Acoustic arrangement',
		},
		{
			id: 'performance-live-only',
			eventId: 'event-live-only',
			compositionId: 'composition-live-only',
			orderIndex: 1,
			encore: false,
			variationNote: null,
		},
	],
});

const source: SongDetailSource = {
	composition: rows.composition,
	compositionCredit: rows.compositionCredit,
	person: rows.person,
	recording: rows.recording,
	track: rows.track,
	release: rows.release,
	work: rows.work,
	project: rows.project,
	eventPerformance: rows.eventPerformance,
	event: rows.event,
	venue: rows.venue,
};

const runStaticBuild = async (): Promise<string> => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'monden-pst014-'));
	const temporarySiteDirectory = join(temporaryRoot, 'site');
	try {
		await cp(sourceSiteDirectory, temporarySiteDirectory, {
			recursive: true,
			filter: (path) => {
				if (path.includes(`${join('site', 'dist')}`) || path.includes(`${join('site', '.astro')}`) || path.includes(`${join('site', 'node_modules')}`)) return false;
				if (path === sourcePagesDirectory) return true;
				if (path.startsWith(`${sourcePagesDirectory}/`)) {
					const relativePath = relative(sourcePagesDirectory, path);
					return relativePath === 'index.astro' || relativePath === 'songs.astro' || relativePath === 'songs' || relativePath.startsWith('songs/');
				}
				return true;
			},
		});
		await symlink(join(repositoryRoot, 'node_modules'), join(temporarySiteDirectory, 'node_modules'), 'junction');
		const snapshot = createSiteSnapshot(rows, { snapshotGeneratedAt: '2026-07-14T00:00:00.000Z' });
		await writeFile(join(temporarySiteDirectory, 'src/data/site.generated.json'), `${JSON.stringify(snapshot)}\n`, 'utf8');

		const processResult = Bun.spawn([process.execPath, join(repositoryRoot, 'node_modules/astro/bin/astro.mjs'), 'build'], {
			cwd: temporarySiteDirectory,
			stdout: 'pipe',
			stderr: 'pipe',
		});
		const [exitCode, stdout, stderr] = await Promise.all([processResult.exited, new Response(processResult.stdout).text(), new Response(processResult.stderr).text()]);
		expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
		return temporarySiteDirectory;
	} catch (error) {
		await rm(temporaryRoot, { recursive: true, force: true });
		throw error;
	}
};

describe('PST-014 song detail', () => {
	test('credits、録音の初出release年、版anchor、ライブ関連リンクを組み立てる', () => {
		const detail = buildSongDetail(source, 'fixture-song');
		expect(detail).not.toBeNull();
		if (!detail) return;

		expect(detail.credits.composer.map((credit) => credit.name)).toEqual(['Person A', 'Person B']);
		expect(detail.credits.lyricist.map((credit) => credit.name)).toEqual(['Person C']);
		expect(detail.recordings[0]).toMatchObject({
			type: 'studio',
			versionName: 'Album version',
			versionDescription: 'アルバム用録音',
			firstReleaseDate: '2020-04-01',
			firstReleaseYear: '2020',
		});
		expect(detail.recordings[0]?.placements.map((placement) => placement.href)).toEqual(['/discography/fixture-album#edition-cd-2020', '/discography/fixture-album#edition-digital-2021']);
		expect(detail.performances).toEqual([
			expect.objectContaining({
				event: expect.objectContaining({ name: 'Fixture Live', href: '/lives/2022-06-07-fixture-club' }),
				project: expect.objectContaining({ name: 'Alpha', href: '/projects/alpha' }),
				venue: expect.objectContaining({ name: 'Fixture Club', href: '/venues/fixture-club' }),
				variationNote: 'Acoustic arrangement',
				encore: true,
			}),
		]);
	});

	test('録音0件のlive-only曲と演奏も録音もない空曲を扱える', () => {
		const liveOnly = buildSongDetail(source, 'live-only-song');
		const empty = buildSongDetail(source, 'empty-song');
		const unplaced = buildSongDetail(source, 'unplaced-recording-song');
		expect(liveOnly).toMatchObject({ recordings: [], liveOnly: true });
		expect(liveOnly?.performances).toHaveLength(1);
		expect(empty).toMatchObject({ recordings: [], performances: [], liveOnly: false });
		expect(unplaced?.recordings[0]).toMatchObject({ type: 'demo', versionName: null, versionDescription: null, firstReleaseDate: null, firstReleaseYear: null, placements: [] });
	});

	test('slug未確定のcompositionは詳細を生成しない', () => {
		const noSlug: SongDetailSource = { ...source, composition: [{ ...rows.composition[0], slug: null }] };
		expect(buildSongDetail(noSlug, 'fixture-song')).toBeNull();
	});

	test('複数slugを静的生成し、通常曲・live-only曲・空曲の関連hrefと空状態を描画する', async () => {
		const siteDirectory = await runStaticBuild();
		try {
			const songHtml = await readFile(join(siteDirectory, 'dist/songs/fixture-song/index.html'), 'utf8');
			const liveOnlyHtml = await readFile(join(siteDirectory, 'dist/songs/live-only-song/index.html'), 'utf8');
			const emptyHtml = await readFile(join(siteDirectory, 'dist/songs/empty-song/index.html'), 'utf8');
			const unplacedHtml = await readFile(join(siteDirectory, 'dist/songs/unplaced-recording-song/index.html'), 'utf8');

			expect(songHtml).toContain('Person A');
			expect(songHtml.indexOf('Person A')).toBeLessThan(songHtml.indexOf('Person B'));
			expect(songHtml).toContain('2020年');
			expect(songHtml).toContain('アルバム用録音');
			expect(songHtml).toContain('href="/discography/fixture-album#edition-cd-2020-04-01"');
			expect(songHtml).toContain('href="/lives/2022-06-07-fixture-club"');
			expect(songHtml).toContain('href="/projects/alpha"');
			expect(songHtml).toContain('href="/venues/fixture-club"');
			expect(songHtml).toContain('Acoustic arrangement');

			expect(liveOnlyHtml).toContain('ライブ演奏のみ');
			expect(liveOnlyHtml).toContain('Live Only Live');
			expect(liveOnlyHtml).toContain('href="/lives/2023-08-09-fixture-club"');
			expect(emptyHtml).toContain('録音情報はありません');
			expect(emptyHtml).toContain('演奏記録はありません');
			expect(unplacedHtml).toContain('名称未登録');
			expect(unplacedHtml).toContain('収録版情報はありません');
			expect(unplacedHtml).not.toContain('1987年');
		} finally {
			await rm(siteDirectory, { recursive: true, force: true });
		}
	});
});
