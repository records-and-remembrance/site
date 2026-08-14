import { describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSiteSnapshot, emptySiteDatabaseRows, type SiteDatabaseRows } from '../../export/export';

const root = fileURLToPath(new URL('../../../', import.meta.url));

const fixtureRows = (): SiteDatabaseRows => {
	const rows = emptySiteDatabaseRows();
	rows.project = [
		{
			id: 'project-1',
			name: 'BURGER NUDS',
			type: 'band',
			description: 'プロジェクトの説明',
			startDate: '1999-01-01',
			endDate: null,
			slug: 'burger-nuds',
			scope: 'monden',
		},
		{
			id: 'project-2',
			name: '公開名義未確定',
			type: 'solo',
			description: null,
			startDate: null,
			endDate: null,
			slug: null,
			scope: 'monden',
		},
		{
			id: 'project-external',
			name: '外部プロジェクト',
			type: 'band',
			description: null,
			startDate: '2000-01-01',
			endDate: null,
			slug: 'external-project',
			scope: 'external',
		},
	];
	rows.person = [
		{ id: 'person-1', name: '門田匡陽', description: null, slug: 'masahi-kadota' },
		{ id: 'person-2', name: 'サポートメンバー', description: null, slug: 'support-member' },
		{ id: 'person-3', name: 'slug未確定メンバー', description: null, slug: null },
	];
	rows.membership = [
		{
			id: 'membership-1',
			personId: 'person-1',
			projectId: 'project-1',
			fromDate: '1999-01-01',
			toDate: null,
			fromDatePrecision: 'day',
			toDatePrecision: null,
			support: false,
			note: null,
		},
		{
			id: 'membership-2',
			personId: 'person-2',
			projectId: 'project-1',
			fromDate: '2002-05-01',
			toDate: '2004-06-30',
			fromDatePrecision: 'month',
			toDatePrecision: 'day',
			support: true,
			note: null,
		},
		{
			id: 'membership-3',
			personId: 'person-3',
			projectId: 'project-1',
			fromDate: '2005-01-01',
			toDate: null,
			fromDatePrecision: 'day',
			toDatePrecision: null,
			support: false,
			note: null,
		},
	];
	rows.role = [{ id: 'role-1', name: 'ボーカル', category: 'performer', description: null }];
	rows.instrument = [{ id: 'instrument-1', name: 'ギター', description: null }];
	rows.membershipRole = [
		{ id: 'membership-role-1', membershipId: 'membership-1', roleId: 'role-1', instrumentId: 'instrument-1' },
		{ id: 'membership-role-2', membershipId: 'membership-2', roleId: 'role-1', instrumentId: null },
	];
	rows.work = [
		{
			id: 'work-1',
			projectId: 'project-1',
			title: 'First Work',
			description: null,
			createdDate: null,
			releasedDate: '2001-02-03',
			type: 'original',
			slug: 'first-work',
		},
		{
			id: 'work-2',
			projectId: 'project-1',
			title: 'Participant Work',
			description: null,
			createdDate: null,
			releasedDate: null,
			type: 'original',
			slug: 'participant-work',
		},
	];
	rows.workProject = [
		{ id: 'work-project-1', workId: 'work-1', projectId: 'project-1', relationType: 'primary' },
		{ id: 'work-project-2', workId: 'work-2', projectId: 'project-1', relationType: 'participant' },
	];
	rows.venue = [
		{ id: 'venue-1', name: '新宿LOFT', description: null, slug: 'shinjuku-loft' },
		{ id: 'venue-2', name: '吉祥寺WARP', description: null, slug: 'kichijoji-warp' },
	];
	rows.event = [
		{ id: 'event-1', projectId: 'project-1', venueId: 'venue-1', eventDate: '2020-01-01', eventDatePrecision: 'day', title: '年始ライブ', slug: '2020-01-01-shinjuku-loft' },
		{ id: 'event-2', projectId: 'project-1', venueId: 'venue-1', eventDate: '2020-05-01', eventDatePrecision: 'day', title: '春ライブ', slug: '2020-05-01-shinjuku-loft' },
		{ id: 'event-3', projectId: 'project-1', venueId: 'venue-2', eventDate: '2021-07-01', eventDatePrecision: 'day', title: '夏ライブ', slug: '2021-07-01-kichijoji-warp' },
		{ id: 'event-external', projectId: 'project-external', venueId: 'venue-1', eventDate: '2020-06-01', eventDatePrecision: 'day', title: '外部ライブ', slug: '2020-06-01-shinjuku-loft' },
	];
	rows.composition = [
		{ id: 'composition-1', title: 'ANALYZE', description: null, slug: 'analyze' },
		{ id: 'composition-2', title: 'OTHER SONG', description: null, slug: 'other-song' },
	];
	rows.eventPerformance = [
		{ id: 'performance-1', eventId: 'event-1', compositionId: 'composition-1', orderIndex: 1 },
		{ id: 'performance-2', eventId: 'event-2', compositionId: 'composition-1', orderIndex: 1 },
		{ id: 'performance-3', eventId: 'event-3', compositionId: 'composition-2', orderIndex: 1 },
	];
	return rows;
};

const buildWithRows = async (rows: SiteDatabaseRows) => {
	const workspace = await mkdtemp(join(tmpdir(), 'monden-pst009-'));
	const siteRoot = join(workspace, 'site');
	await cp(join(root, 'site'), siteRoot, { recursive: true });
	await rm(join(siteRoot, 'node_modules'), { recursive: true, force: true });
	await symlink(join(root, 'node_modules'), join(siteRoot, 'node_modules'), 'dir');
	await symlink(join(root, 'app'), join(workspace, 'app'), 'dir');
	for (const entry of await readdir(join(siteRoot, 'src/pages'), { withFileTypes: true })) {
		if (!['index.astro', 'projects.astro', 'projects'].includes(entry.name)) await rm(join(siteRoot, 'src/pages', entry.name), { recursive: true, force: true });
	}
	const snapshot = createSiteSnapshot(rows, { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });
	await writeFile(join(siteRoot, 'src/data/site.generated.json'), JSON.stringify(snapshot), 'utf8');
	if (rows.project.length > 0) {
		const writtenSnapshot = JSON.parse(await readFile(join(siteRoot, 'src/data/site.generated.json'), 'utf8')) as { tables: { project: unknown[] } };
		if (writtenSnapshot.tables.project.length !== rows.project.length) throw new Error('PST-009 fixture snapshot was not written');
	}
	const dataIndexPath = join(siteRoot, 'src/data/index.ts');
	const dataIndex = await readFile(dataIndexPath, 'utf8');
	const injectedDataIndex = dataIndex.replace(
		/const loadGeneratedData = \(\): SiteSnapshot \| undefined => \{[\s\S]*?\n\};/u,
		`const loadGeneratedData = (): SiteSnapshot | undefined => (${JSON.stringify(snapshot)}) as SiteSnapshot;`,
	);
	if (injectedDataIndex === dataIndex) throw new Error('PST-009 fixture data loader was not found');
	await writeFile(dataIndexPath, injectedDataIndex, 'utf8');

	const process = Bun.spawn(['bun', 'x', 'astro', 'build', '--root', '.'], {
		cwd: siteRoot,
		stderr: 'pipe',
		stdout: 'pipe',
	});
	const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
	if (exitCode !== 0) throw new Error(`${stdout}\n${stderr}`);

	return {
		read: (relativePath: string) => readFile(join(siteRoot, 'dist', relativePath), 'utf8'),
		cleanup: () => rm(workspace, { recursive: true, force: true }),
	};
};

describe('PST-009 project pages', () => {
	test('mondenの一覧だけを表示し、確定slugだけ詳細へリンクする', async () => {
		const built = await buildWithRows(fixtureRows());
		try {
			const html = await built.read('projects/index.html');
			expect(html).toContain('BURGER NUDS');
			expect(html).toContain('href="/projects/burger-nuds"');
			expect(html).toContain('公開名義未確定');
			// slugはURLで表現される。カード本文にslugや内部的な未確定状態を出さない。
			expect(html).not.toContain('公開URL未確定');
			expect(html).not.toContain('/burger-nuds<');
			expect(html).not.toContain('href="/projects/"');
			expect(html).not.toContain('外部プロジェクト');
		} finally {
			await built.cleanup();
		}
	});

	test('詳細でmembership・support・作品・ライブ集計・関連リンクを描画する', async () => {
		const built = await buildWithRows(fixtureRows());
		try {
			const html = await built.read('projects/burger-nuds/index.html');
			expect(html).toContain('プロジェクトの説明');
			expect(html).toContain('門田匡陽');
			expect(html).toContain('href="/people/masahi-kadota"');
			expect(html).toContain('project-membership__bar--support');
			expect(html).toContain('役割未登録');
			expect(html).toContain('First Work');
			expect(html).toContain('主名義');
			expect(html).toContain('Participant Work');
			expect(html).toContain('参加');
			expect(html).toContain('2020年');
			expect(html).toContain('新宿LOFT');
			expect(html).toContain('href="/lives/2020-01-01-shinjuku-loft"');
			expect(html).toContain('ANALYZE');
			expect(html).toContain('href="/songs/analyze"');
			expect(html).toContain('href="/discography/first-work"');
		} finally {
			await built.cleanup();
		}
	});

	test('関連データが空でも空状態を表示して静的buildできる', async () => {
		const built = await buildWithRows(emptySiteDatabaseRows());
		try {
			const html = await built.read('projects/index.html');
			expect(html).toContain('プロジェクトはありません');
		} finally {
			await built.cleanup();
		}
	});
});
