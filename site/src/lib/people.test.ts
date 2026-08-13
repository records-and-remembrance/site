import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSiteSnapshot, emptySiteDatabaseRows, type SiteDatabaseRows } from '../../export/export';
import { buildPersonPageModel } from './people';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const generatedPath = join(root, 'site/src/data/site.generated.json');

const buildSiteWithRows = async (rows: SiteDatabaseRows): Promise<void> => {
	const hadGeneratedData = existsSync(generatedPath);
	const previousGeneratedData = hadGeneratedData ? await readFile(generatedPath) : undefined;
	const snapshot = createSiteSnapshot(rows, { snapshotGeneratedAt: '2026-07-13T00:00:00.000Z' });
	await writeFile(generatedPath, `${JSON.stringify(snapshot)}\n`, 'utf8');

	try {
		const process = Bun.spawn(['bun', 'run', 'site:build'], { cwd: root, stderr: 'pipe', stdout: 'pipe' });
		const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
		expect(exitCode, `${stdout}${stderr}`).toBe(0);
	} finally {
		if (previousGeneratedData) await writeFile(generatedPath, previousGeneratedData);
		else await rm(generatedPath, { force: true });
	}
};

const personRows = (): SiteDatabaseRows => {
	const rows = emptySiteDatabaseRows();
	rows.person = [
		{ id: 'person-daichi', name: '伊藤大地', description: '複数プロジェクトで活動する人物。', slug: 'daichi-ito', activeFrom: null, activeTo: null },
		{ id: 'person-co-performer', name: '共演者', description: null, slug: 'co-performer', activeFrom: null, activeTo: null },
		{ id: 'person-no-slug', name: 'slug未確定', description: null, slug: null, activeFrom: null, activeTo: null },
	];
	rows.project = [
		{ id: 'project-burger', name: 'BURGER NUDS', type: 'band', description: null, slug: 'burger-nuds', scope: 'monden' },
		{ id: 'project-second', name: 'SECOND PROJECT', type: 'band', description: null, slug: 'second-project', scope: 'monden' },
		{ id: 'project-external', name: '外部プロジェクト', type: 'band', description: null, slug: 'external-project', scope: 'external' },
	];
	rows.membership = [
		{
			id: 'membership-burger-daichi',
			personId: 'person-daichi',
			projectId: 'project-burger',
			fromDate: '2001-01-01',
			toDate: '2003-12-31',
			fromDatePrecision: 'day',
			toDatePrecision: 'day',
			support: false,
			note: null,
		},
		{
			id: 'membership-second-daichi',
			personId: 'person-daichi',
			projectId: 'project-second',
			fromDate: '2004-01-01',
			toDate: null,
			fromDatePrecision: 'day',
			toDatePrecision: null,
			support: true,
			note: null,
		},
		{
			id: 'membership-external-daichi',
			personId: 'person-daichi',
			projectId: 'project-external',
			fromDate: '1999-01-01',
			toDate: '2000-12-31',
			fromDatePrecision: 'day',
			toDatePrecision: 'day',
			support: false,
			note: null,
		},
		{
			id: 'membership-burger-co-performer',
			personId: 'person-co-performer',
			projectId: 'project-burger',
			fromDate: '2002-01-01',
			toDate: '2004-01-01',
			fromDatePrecision: 'day',
			toDatePrecision: 'day',
			support: false,
			note: null,
		},
	];
	rows.role = [{ id: 'role-performer', name: '演奏', category: 'performer', description: null }];
	rows.instrument = [{ id: 'instrument-guitar', name: 'ギター', description: null }];
	rows.membershipRole = [{ id: 'membership-role-1', membershipId: 'membership-burger-daichi', roleId: 'role-performer', instrumentId: 'instrument-guitar' }];
	rows.composition = [
		{ id: 'composition-a', title: '曲A', description: null, slug: 'song-a' },
		{ id: 'composition-b', title: '曲B', description: null, slug: 'song-b' },
	];
	rows.compositionCredit = [
		{ id: 'credit-composer', compositionId: 'composition-a', personId: 'person-daichi', creditType: 'composer', orderIndex: 1 },
		{ id: 'credit-lyricist', compositionId: 'composition-b', personId: 'person-daichi', creditType: 'lyricist', orderIndex: 1 },
	];
	rows.work = [{ id: 'work-a', projectId: 'project-burger', title: '作品A', description: null, createdDate: null, releasedDate: null, type: 'original', slug: 'work-a' }];
	rows.release = [
		{
			id: 'release-a',
			workId: 'work-a',
			format: 'CD',
			catalogNumber: null,
			releaseDate: '2005-04-01',
			releaseDatePrecision: 'day',
			recordedFrom: null,
			recordedTo: null,
			description: null,
			notes: null,
			distributorId: null,
			editionType: 'original',
		},
	];
	rows.venue = [{ id: 'venue-loft', name: '新宿LOFT', description: null, address: null, url: null, slug: 'shinjuku-loft' }];
	rows.event = [{ id: 'event-1', projectId: 'project-burger', venueId: 'venue-loft', eventDate: '2006-05-06', eventDatePrecision: 'day', eventName: '共演ライブ', slug: '2006-05-06-shinjuku-loft' }];
	rows.contribution = [
		{ id: 'contribution-release', personId: 'person-daichi', roleId: 'role-performer', instrumentId: 'instrument-guitar', recordingId: null, releaseId: 'release-a', eventId: null, notes: null },
		{ id: 'contribution-event-daichi', personId: 'person-daichi', roleId: 'role-performer', instrumentId: 'instrument-guitar', recordingId: null, releaseId: null, eventId: 'event-1', notes: null },
		{ id: 'contribution-event-co-performer', personId: 'person-co-performer', roleId: 'role-performer', instrumentId: null, recordingId: null, releaseId: null, eventId: 'event-1', notes: null },
	];
	return rows;
};

describe('PST-010 人物一覧・詳細', () => {
	test('関連データを人物詳細へ集約し、導出期間・根拠・リンクを静的buildする', async () => {
		const rows = personRows();
		const model = buildPersonPageModel({
			person: rows.person[0]!,
			people: rows.person,
			projects: rows.project,
			memberships: rows.membership,
			membershipRoles: rows.membershipRole,
			roles: rows.role,
			instruments: rows.instrument,
			compositions: rows.composition,
			compositionCredits: rows.compositionCredit,
			releases: rows.release,
			works: rows.work,
			recordings: rows.recording,
			events: rows.event,
			contributions: rows.contribution,
		});
		expect(model.activityPeriod).toMatchObject({ from: '2001-01-01', to: '2006-05-06', fromDerived: true, toDerived: true });
		expect(model.memberships.map((membership) => membership.projectHref)).toEqual(['/projects/burger-nuds', '/projects/second-project']);
		expect(model.credits.map((credit) => credit.href)).toEqual(['/songs/song-a', '/songs/song-b']);
		expect(model.roleSummary).toEqual([{ label: '演奏', count: 2 }]);

		const staticBuildRows = { ...rows, project: rows.project.map((project) => ({ ...project, slug: null })) };
		await buildSiteWithRows(staticBuildRows);

		const listHtml = await readFile(join(root, 'site/dist/people/index.html'), 'utf8');
		const detailHtml = await readFile(join(root, 'site/dist/people/daichi-ito/index.html'), 'utf8');

		expect(listHtml).toContain('伊藤大地');
		expect(listHtml).toContain('href="/people/daichi-ito"');
		expect(listHtml).toContain('slug未確定');
		expect(listHtml).not.toContain('/people/slug未確定');

		expect(detailHtml).toContain('複数プロジェクトで活動する人物。');
		expect(detailHtml).toContain('活動期間');
		expect(detailHtml).toContain('記録から導出');
		expect(detailHtml).toContain('BURGER NUDS');
		expect(detailHtml).toContain('SECOND PROJECT');
		expect(detailHtml).toContain('サポート');
		expect(detailHtml).not.toContain('外部プロジェクト');
		expect(detailHtml).toContain('作曲');
		expect(detailHtml).toContain('作詞');
		expect(detailHtml).toContain('href="/songs/song-a"');
		expect(detailHtml).toContain('リリース参加');
		expect(detailHtml).toContain('ライブ参加');
		expect(detailHtml).not.toContain('録音参加');
		expect(detailHtml).toContain('共演者');
		expect(detailHtml).toContain('在籍期間の重複');
		expect(detailHtml).toContain('イベント共起');
		expect(detailHtml).toContain('href="/lives/2006-05-06-shinjuku-loft"');
	});

	test('空データとslug欠落でも一覧を静的buildし、詳細routeを生成しない', async () => {
		const rows = emptySiteDatabaseRows();
		rows.person = [{ id: 'person-no-slug', name: 'slug未確定', description: null, slug: null, activeFrom: null, activeTo: null }];
		await buildSiteWithRows(rows);

		const listHtml = await readFile(join(root, 'site/dist/people/index.html'), 'utf8');
		expect(listHtml).toContain('slug未確定');
		expect(listHtml).not.toContain('/people/slug未確定');
		expect(existsSync(join(root, 'site/dist/people/slug未確定/index.html'))).toBe(false);

		await buildSiteWithRows(emptySiteDatabaseRows());
		const emptyHtml = await readFile(join(root, 'site/dist/people/index.html'), 'utf8');
		expect(emptyHtml).toContain('人物データはありません');
	});
});
