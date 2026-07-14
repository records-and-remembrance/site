import { describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptySiteDatabaseRows, SITE_TABLE_NAMES, type SiteDatabaseRows } from '../../export/export';

const repositoryRoot = join(import.meta.dir, '../../..');
type SnapshotRows = Partial<SiteDatabaseRows>;
let buildQueue = Promise.resolve();

const createSnapshot = (partialRows: SnapshotRows = {}) => {
	const tables = { ...emptySiteDatabaseRows(), ...partialRows };
	return {
		title: '門田匡陽アーカイブ',
		description: '楽曲一覧のテスト用スナップショット',
		featuredProject: 'BURGER NUDS',
		schemaVersion: 1 as const,
		snapshotGeneratedAt: '2026-07-13T00:00:00.000Z',
		tables,
		indexes: { dig: [], monthDay: {} },
		manifest: {
			schemaVersion: 1 as const,
			snapshotGeneratedAt: '2026-07-13T00:00:00.000Z',
			contentHash: 'test',
			counts: Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, tables[tableName].length])),
			errors: [],
			warnings: [],
		},
	};
};

const createBuildFixture = async (snapshot: ReturnType<typeof createSnapshot>): Promise<{ root: string; siteRoot: string }> => {
	const root = await mkdtemp(join(tmpdir(), 'monden-site-songs-'));
	const siteRoot = join(root, 'site');
	await cp(join(repositoryRoot, 'site'), siteRoot, { recursive: true });
	await rm(join(siteRoot, '.astro'), { force: true, recursive: true });
	await cp(join(repositoryRoot, 'app'), join(root, 'app'), { recursive: true });
	await symlink(join(repositoryRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
	for (const entry of await readdir(join(siteRoot, 'src/pages'), { withFileTypes: true })) {
		if (entry.name !== 'index.astro' && entry.name !== 'songs.astro') await rm(join(siteRoot, 'src/pages', entry.name), { force: true, recursive: true });
	}
	await writeFile(join(siteRoot, 'src/data/site.generated.json'), `${JSON.stringify(snapshot)}\n`, 'utf8');
	return { root, siteRoot };
};

const buildSongsPage = async (siteRoot: string): Promise<string> => {
	const previousBuild = buildQueue;
	let releaseBuild!: () => void;
	buildQueue = new Promise<void>((resolve) => {
		releaseBuild = resolve;
	});
	await previousBuild;
	try {
		const childProcess = Bun.spawn(['bun', 'x', 'astro', 'build', '--root', '.'], {
			cwd: siteRoot,
			env: { ...process.env, SITE_DATA_PATH: join(siteRoot, 'src/data/site.generated.json') },
			stderr: 'pipe',
			stdout: 'pipe',
		});
		const [exitCode, stdout, stderr] = await Promise.all([childProcess.exited, new Response(childProcess.stdout).text(), new Response(childProcess.stderr).text()]);
		if (exitCode !== 0) throw new Error(`Astro build failed:\n${stdout}\n${stderr}`);
		return await readFile(join(siteRoot, 'dist', 'songs', 'index.html'), 'utf8');
	} finally {
		releaseBuild();
	}
};

describe('PST-013 /songs', () => {
	test('集計・初期ソート・slug欠落・録音0件を静的HTMLに反映する', async () => {
		const rows = emptySiteDatabaseRows();
		rows.composition = [
			{ id: 'song-live-only', title: 'Live Only', slug: 'live-only' },
			{ id: 'song-frequently-played', title: 'Frequently Played', slug: 'frequently-played' },
			{ id: 'song-no-slug', title: 'No Slug', slug: null },
		];
		rows.person = [
			{ id: 'person-composer', name: 'Composer', slug: 'composer' },
			{ id: 'person-lyricist', name: 'Lyricist', slug: 'lyricist' },
		];
		rows.compositionCredit = [
			{ id: 'credit-composer', compositionId: 'song-frequently-played', personId: 'person-composer', creditType: 'composer', orderIndex: 1 },
			{ id: 'credit-lyricist', compositionId: 'song-frequently-played', personId: 'person-lyricist', creditType: 'lyricist', orderIndex: 1 },
		];
		rows.recording = [
			{ id: 'recording-one', compositionId: 'song-frequently-played' },
			{ id: 'recording-two', compositionId: 'song-frequently-played' },
		];
		rows.work = [
			{ id: 'work-first', title: 'First Work', slug: 'first-work' },
			{ id: 'work-second', title: 'Second Work', slug: 'second-work' },
		];
		rows.release = [
			{ id: 'release-first', workId: 'work-first', releaseDate: '2010-03-04' },
			{ id: 'release-second', workId: 'work-first', releaseDate: null },
			{ id: 'release-third', workId: 'work-second', releaseDate: '2012-05-06' },
		];
		rows.track = [
			{ id: 'track-first', releaseId: 'release-first', recordingId: 'recording-one' },
			{ id: 'track-second', releaseId: 'release-second', recordingId: 'recording-one' },
			{ id: 'track-third', releaseId: 'release-third', recordingId: 'recording-two' },
		];
		rows.eventPerformance = [
			{ id: 'performance-live-1', eventId: 'event-1', compositionId: 'song-frequently-played' },
			{ id: 'performance-live-2', eventId: 'event-2', compositionId: 'song-frequently-played' },
			{ id: 'performance-live-only', eventId: 'event-3', compositionId: 'song-live-only' },
		];

		const fixture = await createBuildFixture(createSnapshot(rows));
		try {
			const html = await buildSongsPage(fixture.siteRoot);

			expect(html).toContain('<h1 id="songs-title">楽曲</h1>');
			expect(html).toContain('演奏回数の多い順');
			expect(html).toContain('<a href="/songs/frequently-played">Frequently Played</a>');
			expect(html).toContain('<a href="/people/composer">Composer</a>');
			expect(html).toContain('<a href="/people/lyricist">Lyricist</a>');
			expect(html).toContain('<th scope="col">録音数</th>');
			expect(html).toContain('<th scope="col">収録作品数</th>');
			expect(html).toContain('<th scope="col">演奏回数</th>');
			expect(html.match(/<td>2<\/td>/g)?.length).toBeGreaterThanOrEqual(3);
			expect(html).toContain('2010年');
			expect(html).toContain('ライブ演奏のみ');
			expect(html).not.toContain('href="/songs/null"');
			expect(html.indexOf('Frequently Played')).toBeLessThan(html.indexOf('Live Only'));
			expect(html.indexOf('Live Only')).toBeLessThan(html.indexOf('No Slug'));
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	test('空データでも一覧ページを生成できる', async () => {
		const fixture = await createBuildFixture(createSnapshot());
		try {
			const html = await buildSongsPage(fixture.siteRoot);
			expect(html).toContain('楽曲の記録はありません');
			expect(html).not.toContain('<table');
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});
});
