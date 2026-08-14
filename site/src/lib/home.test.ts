import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { SITE_TABLE_NAMES, type SiteDatabaseRows, type SiteSnapshot, type SiteTableName } from '../../export/export';
import { buildHomeModel } from './home';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const sourceSiteDirectory = join(repositoryRoot, 'site');
const sourcePagesDirectory = join(sourceSiteDirectory, 'src/pages');

const createRows = (overrides: Partial<SiteDatabaseRows> = {}): SiteDatabaseRows => {
	const rows = Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, []])) as SiteDatabaseRows;
	return { ...rows, ...overrides };
};

const createSnapshot = (rows: SiteDatabaseRows, options: { monthDay?: SiteSnapshot['indexes']['monthDay']; counts?: Partial<Record<SiteTableName, number>> } = {}): SiteSnapshot => ({
	title: '門田匡陽アーカイブ',
	description: 'ホームのfixture',
	featuredProject: 'BURGER NUDS',
	schemaVersion: 1,
	snapshotGeneratedAt: '2026-07-13T00:00:00.000Z',
	tables: rows,
	indexes: { dig: [], monthDay: options.monthDay ?? {} },
	manifest: {
		schemaVersion: 1,
		snapshotGeneratedAt: '2026-07-13T00:00:00.000Z',
		contentHash: 'pst-019-test',
		counts: Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, options.counts?.[tableName] ?? rows[tableName].length])) as Record<SiteTableName, number>,
		errors: [],
		warnings: [],
	},
});

const fixtureRows = (): SiteDatabaseRows =>
	createRows({
		project: [
			{ id: 'project-burger', name: 'BURGER NUDS', type: 'band', slug: 'burger-nuds', startDate: '1999-01-01', endDate: null, scope: 'monden' },
			{ id: 'project-unknown', name: '期間未登録名義', type: 'solo', slug: 'unknown-project', startDate: null, endDate: null, scope: 'monden' },
		],
		person: [{ id: 'person-1', name: '人物1', slug: 'person-1' }],
		work: [{ id: 'work-1', projectId: 'project-burger', title: '作品1', slug: 'work-1' }],
		event: [
			{ id: 'event-future', projectId: 'project-burger', venueId: 'venue-1', eventDate: '2026-12-24', eventDatePrecision: 'day', eventName: '未来のライブ', slug: '2026-12-24-venue-1' },
			{ id: 'event-past', projectId: 'project-burger', venueId: 'venue-1', eventDate: '2026-07-12', eventDatePrecision: 'day', eventName: '過去のライブ', slug: '2026-07-12-venue-1' },
		],
		venue: [{ id: 'venue-1', name: '会場1', slug: 'venue-1' }],
		article: [{ id: 'article-1', title: '記事1', slug: 'article-1' }],
	});

const fixtureSnapshot = (withTodayEntries = true): SiteSnapshot => {
	const rows = fixtureRows();
	return createSnapshot(rows, {
		counts: { composition: 0, work: 12, event: 2, person: 34, venue: 5, article: 0 },
		monthDay: withTodayEntries
			? {
					'07-13': [{ type: 'event', date: '2020-07-13', label: '今日の記録', href: '/lives/2020-07-13-venue-1', slug: '2020-07-13-venue-1' }],
				}
			: {},
	});
};

const runStaticBuild = async (snapshot: SiteSnapshot): Promise<string> => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'pst-019-'));
	const temporarySiteDirectory = join(temporaryRoot, 'site');
	try {
		await cp(sourceSiteDirectory, temporarySiteDirectory, {
			recursive: true,
			filter: (source) => {
				if (source.includes(`${join('site', 'dist')}`) || source.includes(`${join('site', '.astro')}`) || source.includes(`${join('site', 'node_modules')}`)) return false;
				if (source === sourcePagesDirectory) return true;
				return !source.startsWith(`${sourcePagesDirectory}/`) || source.endsWith('/index.astro');
			},
		});
		await symlink(join(repositoryRoot, 'node_modules'), join(temporarySiteDirectory, 'node_modules'), 'junction');
		await writeFile(join(temporarySiteDirectory, 'src/data/site.generated.json'), `${JSON.stringify(snapshot)}\n`, 'utf8');

		const processResult = Bun.spawn([process.execPath, join(repositoryRoot, 'node_modules/astro/bin/astro.mjs'), 'build'], {
			cwd: temporarySiteDirectory,
			stdout: 'pipe',
			stderr: 'pipe',
		});
		const [exitCode, stdout, stderr] = await Promise.all([processResult.exited, new Response(processResult.stdout).text(), new Response(processResult.stderr).text()]);
		expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
		return readFile(join(temporarySiteDirectory, 'dist/index.html'), 'utf8');
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
};

describe('PST-019 home', () => {
	test('fixtureからmanifest件数、期間、色、未来event、Digアンカー、今日の記録を集約する', () => {
		const model = buildHomeModel(fixtureSnapshot());

		expect(model.projects).toEqual([
			expect.objectContaining({
				name: 'BURGER NUDS',
				href: '/projects/burger-nuds',
				colorToken: 'var(--project-burger-nuds)',
				startYear: 1999,
				endYear: 2026,
			}),
			expect.objectContaining({
				name: '期間未登録名義',
				href: '/projects/unknown-project',
				periodLabel: '活動期間不明〜現在',
			}),
		]);
		expect(model.countTiles).toEqual([
			{ key: 'composition', label: '楽曲', count: 0, href: '/songs' },
			{ key: 'work', label: '作品', count: 12, href: '/discography' },
			{ key: 'event', label: 'ライブ', count: 2, href: '/lives' },
			{ key: 'person', label: '人物', count: 34, href: '/people' },
			{ key: 'venue', label: '会場', count: 5, href: '/venues' },
			{ key: 'article', label: '記事', count: 0, href: '/library' },
		]);
		expect(model.upcomingEvents).toEqual([expect.objectContaining({ label: '未来のライブ', href: '/lives/2026-12-24-venue-1' })]);
	});

	test('静的buildで0件タイルを表示し、確定リンク・色・予定・DigをHTMLへ出力する', async () => {
		const html = await runStaticBuild(fixtureSnapshot());

		expect(html).toContain('href="/projects/burger-nuds"');
		expect(html).toContain('data-project-color="var(--project-burger-nuds)"');
		expect(html).toContain('href="/discography"');
		expect(html).toContain('data-count-key="composition"');
		expect(html).toContain('data-count-key="composition" href="/songs"');
		expect(html).toContain('>0</strong>');
		expect(html).toContain('data-count-key="article"');
		expect(html).toContain('tabular-nums');
		expect(html).toContain('予定');
		expect(html).toContain('未来のライブ');
		expect(html).toContain('id="dig"');
		expect(html).toContain('Digは準備中');
		// 「この日なんの日」は閲覧日で決まるため、枠だけを閉じた状態で出しクライアントが開く。
		expect(html).toContain('id="today-in-history"');
		expect(html).toMatch(/id="today-in-history"[^>]*hidden/u);
		// Dig候補の一覧はHTMLへ埋め込まず、再抽選時に /dig.json から取る。
		expect(html).toContain('/dig.json');
		expect(html).not.toContain('"digCandidates"');
	});

	test('未来eventがなければ予定ブロックを出さずにbuildできる', async () => {
		const snapshot = fixtureSnapshot(false);
		snapshot.tables.event = [snapshot.tables.event[1]];
		const html = await runStaticBuild(snapshot);

		expect(html).not.toContain('class="home-upcoming"');
		expect(html).toContain('id="dig"');
	});
});
