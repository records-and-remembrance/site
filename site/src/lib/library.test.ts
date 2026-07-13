import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { SITE_TABLE_NAMES, type SiteDatabaseRows, type SiteRow } from '../../export/export';
import { buildLibraryTree, libraryAnchor } from './library';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const sourceSiteDirectory = join(repositoryRoot, 'site');
const sourcePagesDirectory = join(sourceSiteDirectory, 'src/pages');

const createRows = (overrides: Partial<SiteDatabaseRows> = {}): SiteDatabaseRows => {
	const rows = Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, [] as SiteRow[]])) as SiteDatabaseRows;
	return { ...rows, ...overrides };
};

const createSnapshot = (rows: SiteDatabaseRows): Record<string, unknown> => ({
	title: '門田匡陽アーカイブ',
	description: '資料室テスト',
	featuredProject: 'Alpha',
	schemaVersion: 1,
	snapshotGeneratedAt: '2026-01-01T00:00:00.000Z',
	tables: rows,
	indexes: { dig: [], monthDay: {} },
	manifest: {
		schemaVersion: 1,
		snapshotGeneratedAt: '2026-01-01T00:00:00.000Z',
		contentHash: 'pst-025-test',
		counts: Object.fromEntries(SITE_TABLE_NAMES.map((tableName) => [tableName, rows[tableName].length])),
		errors: [],
		warnings: [],
	},
});

const runStaticBuild = async (rows: SiteDatabaseRows): Promise<string> => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'pst-025-'));
	const temporarySiteDirectory = join(temporaryRoot, 'site');
	try {
		await cp(sourceSiteDirectory, temporarySiteDirectory, {
			recursive: true,
			filter: (source) => {
				if (source.includes(`${join('site', 'dist')}`) || source.includes(`${join('site', '.astro')}`) || source.includes(`${join('site', 'node_modules')}`)) return false;
				if (source === sourcePagesDirectory) return true;
				if (source.startsWith(`${sourcePagesDirectory}/`)) return ['index.astro', 'library.astro'].includes(relative(sourcePagesDirectory, source));
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
		return readFile(join(temporarySiteDirectory, 'dist/library/index.html'), 'utf8');
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
};

const fixtureRows = createRows({
	publication: [{ id: 'publication-1', name: '音楽と人', type: '雑誌', publisher: null, description: null, libraryKey: '音楽と人' }],
	publicationIssue: [
		{
			id: 'issue-1',
			publicationId: 'publication-1',
			issueNumber: '3',
			volume: null,
			publishedDate: '2020-02-03',
			description: null,
			libraryKey: '音楽と人-3-2020-02-03',
		},
	],
	article: [
		{
			id: 'article-1',
			publicationIssueId: 'issue-1',
			title: 'ANALYZE',
			type: null,
			publishedDate: null,
			summary: null,
			content: null,
			url: null,
			libraryKey: '音楽と人-3-2020-02-03-analyze',
		},
		{
			id: 'article-2',
			publicationIssueId: 'issue-1',
			title: 'インタビュー',
			type: 'interview',
			publishedDate: '2020-02-03',
			summary: '要約',
			content: '本文',
			url: 'https://example.test/article',
			libraryKey: '音楽と人-3-2020-02-03-interview',
		},
	],
	articleMentionWork: [{ id: 'mention-1', articleId: 'article-1', workId: 'work-1', mentionType: 'reference', notes: null }],
});

describe('PST-025 library', () => {
	test('publication→issue→articleをlibraryKey順の階層として組み立て、UUIDを公開値に使わない', () => {
		const tree = buildLibraryTree(fixtureRows);

		expect(tree).toHaveLength(1);
		expect(tree[0]).toMatchObject({
			name: '音楽と人',
			anchor: 'publication-音楽と人',
			issues: [
				{
					issueNumber: '3',
					anchor: 'issue-音楽と人-3-2020-02-03',
				},
			],
		});
		expect(tree[0].issues[0]?.articles.map(({ title, anchor }) => ({ title, anchor }))).toEqual([
			{ title: 'ANALYZE', anchor: 'article-音楽と人-3-2020-02-03-analyze' },
			{ title: 'インタビュー', anchor: 'article-音楽と人-3-2020-02-03-interview' },
		]);
		expect(JSON.stringify(tree)).not.toContain('publication-1');
		expect(libraryAnchor('article', '音楽と人-3-2020-02-03-analyze')).toBe('article-音楽と人-3-2020-02-03-analyze');
		expect(libraryAnchor('article', null)).toBeUndefined();
	});

	test('NULL項目を省略し、記事タイトルをPagefind対象にし、mentionリンクを生成しない', async () => {
		const html = await runStaticBuild(fixtureRows);

		expect(html).toContain('音楽と人');
		expect(html).toContain('第3号');
		expect(html).toContain('ANALYZE');
		expect(html).toContain('インタビュー');
		expect(html).toContain('id="article-音楽と人-3-2020-02-03-analyze"');
		expect(html).toContain('data-pagefind-body');
		expect(html).toContain('data-pagefind-filter="type:article"');
		expect(html).toContain('href="#article-音楽と人-3-2020-02-03-analyze"');
		expect(html).toContain('https://example.test/article');
		expect(html).not.toContain('本文未登録');
		expect(html).not.toContain('発行日未登録');
		expect(html).not.toContain('href="/discography/');
		expect(html).not.toContain('href="/people/');
		expect(html).not.toContain('href="/lives/');
		expect(html).not.toContain('work-1');
	});

	test('publication・issue・articleが0件でも空状態を表示してbuildできる', async () => {
		const html = await runStaticBuild(createRows());

		expect(html).toContain('資料はありません');
		expect(html).not.toContain('publication-');
		expect(html).not.toContain('issue-');
		expect(html).not.toContain('article-');
	});
});
