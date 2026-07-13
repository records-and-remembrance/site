import { describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSiteSnapshot, emptySiteDatabaseRows, type SiteDatabaseRows } from '../../export/export';
import { buildDiscographyDetail, type DiscographyDetailSource } from './discography-detail';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

const source: DiscographyDetailSource = {
	work: [
		{
			id: 'work-1',
			projectId: 'project-1',
			title: 'First Work',
			description: '作品の説明',
			releasedDate: '2020-01-01',
			type: 'original',
			slug: 'first-work',
		},
		{
			id: 'work-empty',
			projectId: 'project-1',
			title: 'Empty Work',
			description: null,
			releasedDate: null,
			type: 'compilation',
			slug: 'empty-work',
		},
	],
	project: [{ id: 'project-1', name: 'Project One', slug: 'project-one' }],
	workProject: [{ id: 'work-project-1', workId: 'work-1', projectId: 'project-1', relationType: 'primary' }],
	release: [
		{
			id: 'release-reissue',
			workId: 'work-1',
			format: '配信',
			catalogNumber: null,
			releaseDate: '2022-02-02',
			releaseDatePrecision: 'month',
			editionType: 'reissue',
			reissueOfReleaseId: 'release-original',
			editionKey: 'digital-2022-02-02',
			artworkUrl: null,
			artworkWidth: null,
			artworkHeight: null,
			distributorId: 'distributor-1',
		},
		{
			id: 'release-original',
			workId: 'work-1',
			format: 'CD',
			catalogNumber: 'CAT-001',
			releaseDate: '2020-01-01',
			releaseDatePrecision: 'day',
			editionType: 'original',
			reissueOfReleaseId: null,
			editionKey: 'cd-2020-01-01-cat-001',
			artworkUrl: 'https://cdn.example.test/first.jpg',
			artworkWidth: 600,
			artworkHeight: 600,
			distributorId: null,
		},
	],
	distributor: [{ id: 'distributor-1', name: 'Digital Distributor' }],
	label: [{ id: 'label-1', name: 'Example Label' }],
	labelRelation: [{ id: 'label-relation-1', releaseId: 'release-original', labelId: 'label-1' }],
	track: [
		{ id: 'track-reissue-2', releaseId: 'release-reissue', recordingId: 'recording-2', trackNumber: 2 },
		{ id: 'track-original-1', releaseId: 'release-original', recordingId: 'recording-1', trackNumber: 1 },
		{ id: 'track-reissue-1', releaseId: 'release-reissue', recordingId: 'recording-1', trackNumber: 1 },
	],
	recording: [
		{ id: 'recording-2', compositionId: 'composition-2', versionName: 'Acoustic version', type: 'studio' },
		{ id: 'recording-1', compositionId: 'composition-1', versionName: 'Album version', type: 'studio' },
	],
	composition: [
		{ id: 'composition-1', title: 'Song One', slug: 'song-one' },
		{ id: 'composition-2', title: 'Song Two', slug: null },
	],
	person: [{ id: 'person-1', name: 'Participant One', slug: 'participant-one' }],
	role: [{ id: 'role-1', name: 'guitar', category: 'performer' }],
	instrument: [{ id: 'instrument-1', name: 'Electric Guitar' }],
	contribution: [{ id: 'contribution-1', releaseId: 'release-original', personId: 'person-1', roleId: 'role-1', instrumentId: 'instrument-1' }],
};

describe('PST-012 discography detail', () => {
	test('初版と再発を版セクションに集約し、曲・参加者・メタデータ・双方向リンクを組み立てる', () => {
		const detail = buildDiscographyDetail(source, 'first-work');
		expect(detail).not.toBeNull();
		if (!detail) return;

		expect(detail.work).toMatchObject({
			title: 'First Work',
			description: '作品の説明',
			type: 'original',
			releasedDate: '2020-01-01',
			project: { name: 'Project One', href: '/projects/project-one' },
		});
		expect(detail.representativeRelease.id).toBe('release-original');
		expect(detail.representativeRelease.tracks).toEqual([
			expect.objectContaining({
				trackNumber: 1,
				composition: { title: 'Song One', href: '/songs/song-one' },
				recording: { versionName: 'Album version', type: 'studio' },
			}),
		]);
		expect(detail.representativeRelease.artwork).toEqual({ url: 'https://cdn.example.test/first.jpg', width: 600, height: 600 });
		expect(detail.representativeRelease.labels).toEqual([{ name: 'Example Label' }]);
		expect(detail.representativeRelease.contributions).toEqual([
			{
				person: { name: 'Participant One', href: '/people/participant-one' },
				role: 'guitar',
				instrument: 'Electric Guitar',
			},
		]);

		const [original, reissue] = detail.releases;
		expect(original).toMatchObject({ editionKey: 'cd-2020-01-01-cat-001', anchor: 'edition-cd-2020-01-01-cat-001' });
		expect(reissue).toMatchObject({
			editionKey: 'digital-2022-02-02',
			anchor: 'edition-digital-2022-02-02',
			releaseDate: '2022-02-02',
			releaseDatePrecision: 'month',
			distributor: { name: 'Digital Distributor' },
			labels: [],
			reissueOf: { label: '初版', href: '#edition-cd-2020-01-01-cat-001' },
		});
		expect(original.reissues).toEqual([{ label: '再発', href: '#edition-digital-2022-02-02' }]);
		expect(reissue.trackDiffs).toEqual([expect.objectContaining({ kind: 'added', trackNumber: 2, title: 'Song Two', href: undefined })]);
		expect(detail.relatedLinks).toEqual([{ label: 'Project One', href: '/projects/project-one' }]);
	});

	test('DB返却順に依存せずedition anchorを安定させ、track 0件は専用の空状態を返す', () => {
		const shuffled: DiscographyDetailSource = {
			...source,
			release: [...source.release].reverse(),
			track: [],
		};
		const detail = buildDiscographyDetail(shuffled, 'empty-work');
		expect(detail).not.toBeNull();
		if (!detail) return;
		expect(detail.representativeRelease.tracks).toEqual([]);
		expect(detail.representativeRelease.hasTracks).toBe(false);
		expect(detail.releases).toEqual([]);
	});

	test('slugがない作品は詳細ページ候補にもリンクにもならない', () => {
		const noSlug: DiscographyDetailSource = { ...source, work: [{ ...source.work[0], slug: null }] };
		expect(buildDiscographyDetail(noSlug, 'first-work')).toBeNull();
	});

	test('静的buildで作品URL・edition anchor・関連リンク・空状態を描画する', async () => {
		const workspace = await mkdtemp(join(tmpdir(), 'monden-pst012-'));
		const siteRoot = join(workspace, 'site');
		await cp(join(repositoryRoot, 'site'), siteRoot, { recursive: true });
		await rm(join(siteRoot, 'node_modules'), { recursive: true, force: true });
		await symlink(join(repositoryRoot, 'node_modules'), join(siteRoot, 'node_modules'), 'dir');
		await symlink(join(repositoryRoot, 'app'), join(workspace, 'app'), 'dir');
		for (const entry of await readdir(join(siteRoot, 'src/pages'), { withFileTypes: true })) {
			if (!['index.astro', 'discography.astro', 'discography'].includes(entry.name)) await rm(join(siteRoot, 'src/pages', entry.name), { recursive: true, force: true });
		}

		const rows = emptySiteDatabaseRows();
		for (const tableName of Object.keys(source) as Array<keyof DiscographyDetailSource>) rows[tableName] = [...source[tableName]];
		const snapshot = createSiteSnapshot(rows as SiteDatabaseRows, { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });
		await writeFile(join(siteRoot, 'src/data/site.generated.json'), JSON.stringify(snapshot), 'utf8');

		try {
			const process = Bun.spawn(['bun', 'x', 'astro', 'build', '--root', '.'], { cwd: siteRoot, stderr: 'pipe', stdout: 'pipe' });
			const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
			if (exitCode !== 0) throw new Error(`${stdout}\n${stderr}`);

			const detailHtml = await readFile(join(siteRoot, 'dist/discography/first-work/index.html'), 'utf8');
			expect(detailHtml).toContain('id="edition-cd-2020-01-01-cat-001"');
			expect(detailHtml).toContain('href="#edition-cd-2020-01-01-cat-001"');
			expect(detailHtml).toContain('href="/songs/song-one"');
			expect(detailHtml).toContain('Participant One');
			expect(detailHtml).toContain('Example Label');
			expect(detailHtml).toContain('Digital Distributor');
			expect(detailHtml).toContain('600 × 600px');
			expect(detailHtml).toContain('初版との差分');

			const emptyHtml = await readFile(join(siteRoot, 'dist/discography/empty-work/index.html'), 'utf8');
			expect(emptyHtml).toContain('収録曲情報未登録');
			expect(emptyHtml).toContain('版情報はまだありません');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});
});
