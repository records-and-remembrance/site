#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type BandReleaseSeed = {
	projectName: string;
	projectType: 'band' | 'solo';
	workTitle: string;
	workType: 'original' | 'compilation';
	releaseDate: string;
	format: string;
	catalogNumber: string | null;
	distributorName: string | null;
	description: string | null;
	notes: string | null;
	trackTitle?: string;
};

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_OUTPUT = join(ROOT, 'sql', 'band_release_seed.sql');

const SEEDS: BandReleaseSeed[] = [
	{
		projectName: 'BURGER NUDS',
		projectType: 'band',
		workTitle: 'D★SELDOM 其の6',
		workType: 'compilation',
		releaseDate: '2003-09-25',
		format: 'CD',
		catalogNumber: null,
		distributorName: '新星堂',
		description: null,
		notes: 'source_file=rawData/articles/band_burger.md',
	},
	{
		projectName: 'BURGER NUDS',
		projectType: 'band',
		workTitle: 'WORLD COMPILATION ALBUM "BIRTH vol.1"',
		workType: 'compilation',
		releaseDate: '2003-10-22',
		format: 'CD',
		catalogNumber: 'TBCD-1010',
		distributorName: 'tearbridge records',
		description: null,
		notes: 'source_file=rawData/articles/band_burger.md',
	},
	{
		projectName: 'Good Dog Happy Men',
		projectType: 'band',
		workTitle: 'Quip Sampler CD vol.23',
		workType: 'compilation',
		releaseDate: '2005-04-15',
		format: 'CD',
		catalogNumber: null,
		distributorName: 'Quip',
		description: null,
		notes: 'source_file=rawData/articles/band_GDHM.md',
	},
	{
		projectName: 'Good Dog Happy Men',
		projectType: 'band',
		workTitle: 'HI-STYLE VOL.10',
		workType: 'compilation',
		releaseDate: '2005-10-19',
		format: 'CD',
		catalogNumber: 'HIST-0014',
		distributorName: 'HIGHLINE DISC',
		description: null,
		notes: 'source_file=rawData/articles/band_GDHM.md',
	},
	{
		projectName: 'Good Dog Happy Men',
		projectType: 'band',
		workTitle: 'Quip Sampler CD vol.27',
		workType: 'compilation',
		releaseDate: '2006-04-21',
		format: 'CD',
		catalogNumber: null,
		distributorName: 'Quip',
		description: null,
		notes: 'source_file=rawData/articles/band_GDHM.md',
	},
	{
		projectName: 'Good Dog Happy Men',
		projectType: 'band',
		workTitle: 'JUNGLE★LIFE+ Vol.3',
		workType: 'compilation',
		releaseDate: '2008-09-03',
		format: 'Book+DVD',
		catalogNumber: 'YOUTH3003',
		distributorName: 'JUNGLE★LIFE+vanta',
		description: null,
		notes: 'source_file=rawData/articles/band_GDHM.md',
	},
	{
		projectName: '門田匡陽 (ソロ名義/2010)',
		projectType: 'solo',
		workTitle: 'POPTOP / UNDER FLOWER / ZENiTH COMPILATION Vol.1 "WHAT ABOUT US?"',
		workType: 'compilation',
		releaseDate: '2011-10-19',
		format: 'CD',
		catalogNumber: 'ZPOP-002',
		distributorName: 'POPTOP',
		description: null,
		notes: 'source_file=rawData/articles/band_solo.md',
	},
	{
		projectName: 'Poet-type.M',
		projectType: 'solo',
		workTitle: 'SD√SELDOM vol.3',
		workType: 'compilation',
		releaseDate: '2015-02-25',
		format: 'CD',
		catalogNumber: null,
		distributorName: '新星堂',
		description: null,
		notes: 'source_file=rawData/articles/band_PtM.md',
	},
	{
		projectName: 'Poet-type.M',
		projectType: 'solo',
		workTitle: '光の粒子 埃の中で (Departures)',
		workType: 'original',
		releaseDate: '2013-09-25',
		format: 'Digital',
		catalogNumber: null,
		distributorName: 'I WILL MUSIC',
		description: null,
		notes: 'source_file=rawData/articles/band_PtM.md',
		trackTitle: '光の粒子 埃の中で (Departures)',
	},
	{
		projectName: 'Poet-type.M',
		projectType: 'solo',
		workTitle: 'イプシロンは泣いてたよ (A Boy In The Avenge)',
		workType: 'original',
		releaseDate: '2018-03-23',
		format: 'Digital',
		catalogNumber: 'LZC-1339',
		distributorName: 'Lantis',
		description: null,
		notes: 'source_file=rawData/articles/band_PtM.md',
		trackTitle: 'イプシロンは泣いてたよ (A Boy In The Avenge)',
	},
	{
		projectName: 'Poet-type.M',
		projectType: 'solo',
		workTitle: '瓦礫のオルフェオ (Ombra mai fù)',
		workType: 'original',
		releaseDate: '2018-11-07',
		format: 'Digital',
		catalogNumber: null,
		distributorName: 'HIGHWAY STAR INC.',
		description: null,
		notes: 'source_file=rawData/articles/band_PtM.md',
		trackTitle: '瓦礫のオルフェオ (Ombra mai fù)',
	},
	{
		projectName: 'Poet-type.M',
		projectType: 'solo',
		workTitle: 'MoYuRu',
		workType: 'original',
		releaseDate: '2018-12-05',
		format: 'Digital',
		catalogNumber: null,
		distributorName: 'HIGHWAY STAR INC.',
		description: null,
		notes: 'source_file=rawData/articles/band_PtM.md',
		trackTitle: 'MoYuRu',
	},
	{
		projectName: 'Poet-type.M',
		projectType: 'solo',
		workTitle: '光の言語 (Absolute Blue)',
		workType: 'original',
		releaseDate: '2019-03-06',
		format: 'Digital',
		catalogNumber: null,
		distributorName: 'HIGHWAY STAR INC.',
		description: null,
		notes: 'source_file=rawData/articles/band_PtM.md',
		trackTitle: '光の言語 (Absolute Blue)',
	},
	{
		projectName: '門田匡陽 (ソロ名義/2020-)',
		projectType: 'solo',
		workTitle: 'Xtalline : 001',
		workType: 'compilation',
		releaseDate: '2023-07-21',
		format: 'Digital',
		catalogNumber: 'ENEI:0001',
		distributorName: 'Siren for Charlotte',
		description: null,
		notes: 'source_file=rawData/articles/band_solo2020.md',
	},
];

function stableUuid(namespace: string, value: string): string {
	const hash = createHash('sha1').update(`mondenDatabase/${namespace}/${value}`).digest('hex');
	const chars = hash.slice(0, 32).split('');
	chars[12] = '5';
	const variant = Number.parseInt(chars[16]!, 16);
	chars[16] = ((variant & 0x3) | 0x8).toString(16);
	return [chars.slice(0, 8).join(''), chars.slice(8, 12).join(''), chars.slice(12, 16).join(''), chars.slice(16, 20).join(''), chars.slice(20, 32).join('')].join('-');
}

function sqlText(value: string | null): string {
	if (value == null) return 'NULL';
	return `'${value.replaceAll("'", "''")}'`;
}

class SqlBuilder {
	readonly lines: string[] = [];

	line(value = ''): void {
		this.lines.push(value);
	}

	projectUpsert(params: { name: string; kind: 'band' | 'solo' }): string {
		const projectId = stableUuid('project', params.name);
		this.line('INSERT INTO project (id, name, type, description, start_date, end_date)');
		this.line(`VALUES (${sqlText(projectId)}, ${sqlText(params.name)}, ${sqlText(params.kind)}, NULL, NULL, NULL)`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET name = EXCLUDED.name,');
		this.line('    type = EXCLUDED.type;');
		this.line();
		return projectId;
	}

	workUpsert(params: { projectId: string; title: string; description: string | null; releasedDate: string | null; type: 'original' | 'compilation' }): string {
		const workId = stableUuid('work', `${params.projectId}:${params.title}`);
		this.line('INSERT INTO work (id, project_id, title, description, created_date, released_date, type)');
		this.line(`VALUES (${sqlText(workId)}, ${sqlText(params.projectId)}, ${sqlText(params.title)}, ${sqlText(params.description)}, NULL, ${sqlText(params.releasedDate)}, ${sqlText(params.type)})`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET project_id = EXCLUDED.project_id,');
		this.line('    title = EXCLUDED.title,');
		this.line('    description = COALESCE(work.description, EXCLUDED.description),');
		this.line('    released_date = COALESCE(work.released_date, EXCLUDED.released_date),');
		this.line('    type = EXCLUDED.type;');
		this.line();
		return workId;
	}

	workProjectUpsert(workId: string, projectId: string, relationType: 'primary' | 'participant'): void {
		const relationId = stableUuid('work_project', `${workId}:${projectId}`);
		this.line('INSERT INTO work_project (id, work_id, project_id, relation_type)');
		this.line(`VALUES (${sqlText(relationId)}, ${sqlText(workId)}, ${sqlText(projectId)}, ${sqlText(relationType)})`);
		this.line('ON CONFLICT (work_id, project_id) DO UPDATE SET relation_type = EXCLUDED.relation_type;');
		this.line();
	}

	distributorUpsert(name: string | null): string | null {
		if (!name) return null;
		const distributorId = stableUuid('distributor', name);
		this.line('INSERT INTO distributor (id, name, description)');
		this.line(`VALUES (${sqlText(distributorId)}, ${sqlText(name)}, NULL)`);
		this.line('ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;');
		this.line();
		return distributorId;
	}

	releaseUpsert(params: { workId: string; format: string; catalogNumber: string | null; releaseDate: string; description: string | null; notes: string | null; distributorId: string | null }): string {
		const releaseId = stableUuid('release', `${params.workId}:${params.format}:${params.releaseDate}`);
		this.line(
			'INSERT INTO release (id, work_id, format, catalog_number, release_date, release_date_precision, recorded_from, recorded_to, description, notes, distributor_id, edition_type, reissue_of_release_id)',
		);
		this.line(
			`VALUES (${sqlText(releaseId)}, ${sqlText(params.workId)}, ${sqlText(params.format)}, ${sqlText(params.catalogNumber)}, ${sqlText(params.releaseDate)}, NULL, NULL, NULL, ${sqlText(params.description)}, ${sqlText(params.notes)}, ${sqlText(params.distributorId)}, 'original', NULL)`,
		);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET work_id = EXCLUDED.work_id,');
		this.line('    format = EXCLUDED.format,');
		this.line('    catalog_number = EXCLUDED.catalog_number,');
		this.line('    release_date = EXCLUDED.release_date,');
		this.line('    description = COALESCE(release.description, EXCLUDED.description),');
		this.line('    notes = COALESCE(release.notes, EXCLUDED.notes),');
		this.line('    distributor_id = EXCLUDED.distributor_id;');
		this.line();
		return releaseId;
	}

	compositionUpsert(title: string): string {
		const compositionId = stableUuid('composition', title);
		this.line('INSERT INTO composition (id, title, description)');
		this.line(`VALUES (${sqlText(compositionId)}, ${sqlText(title)}, NULL)`);
		this.line('ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;');
		this.line();
		return compositionId;
	}

	recordingUpsert(params: { releaseId: string; compositionId: string; trackId: string; trackTitle: string; releaseDate: string; notes: string | null }): string {
		const recordingId = stableUuid('recording', `band-release:${params.releaseId}:1:${params.trackTitle}`);
		this.line('INSERT INTO recording (id, composition_id, recording_year, type, recorded_date, recorded_from, recorded_to, release_date, notes)');
		this.line(`SELECT ${sqlText(recordingId)}, ${sqlText(params.compositionId)}, NULL, 'studio', NULL, NULL, NULL, ${sqlText(params.releaseDate)}, ${sqlText(params.notes)}`);
		this.line('WHERE NOT EXISTS (');
		this.line(`    SELECT 1 FROM track WHERE id = ${sqlText(params.trackId)}`);
		this.line(')');
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET composition_id = EXCLUDED.composition_id,');
		this.line('    release_date = COALESCE(recording.release_date, EXCLUDED.release_date),');
		this.line('    notes = EXCLUDED.notes;');
		this.line();
		return recordingId;
	}

	trackUpsert(params: { trackId: string; releaseId: string; recordingId: string; notes: string | null }): void {
		this.line('INSERT INTO track (id, release_id, recording_id, track_number, recorded_date, notes)');
		this.line(`VALUES (${sqlText(params.trackId)}, ${sqlText(params.releaseId)}, ${sqlText(params.recordingId)}, 1, NULL, ${sqlText(params.notes)})`);
		this.line('ON CONFLICT (id) DO UPDATE');
		this.line('SET release_id = EXCLUDED.release_id,');
		this.line('    track_number = EXCLUDED.track_number,');
		this.line('    notes = EXCLUDED.notes;');
		this.line();
	}
}

export function renderSql(): string {
	const builder = new SqlBuilder();

	builder.line('-- Generated by scripts/generate_band_release_seed_sql.ts');
	builder.line('BEGIN;');
	builder.line();

	const projectIds = new Map<string, string>();
	for (const seed of SEEDS) {
		let projectId = projectIds.get(seed.projectName);
		if (!projectId) {
			projectId = builder.projectUpsert({ name: seed.projectName, kind: seed.projectType });
			projectIds.set(seed.projectName, projectId);
		}

		const workId = builder.workUpsert({
			projectId,
			title: seed.workTitle,
			description: seed.description,
			releasedDate: seed.releaseDate,
			type: seed.workType,
		});
		builder.workProjectUpsert(workId, projectId, seed.workType === 'compilation' ? 'participant' : 'primary');
		const distributorId = builder.distributorUpsert(seed.distributorName);
		const releaseId = builder.releaseUpsert({
			workId,
			format: seed.format,
			catalogNumber: seed.catalogNumber,
			releaseDate: seed.releaseDate,
			description: seed.description,
			notes: seed.notes,
			distributorId,
		});
		if (seed.trackTitle) {
			const compositionId = builder.compositionUpsert(seed.trackTitle);
			const trackId = stableUuid('track', `${releaseId}:1`);
			const recordingId = builder.recordingUpsert({
				releaseId,
				compositionId,
				trackId,
				trackTitle: seed.trackTitle,
				releaseDate: seed.releaseDate,
				notes: seed.notes,
			});
			builder.trackUpsert({ trackId, releaseId, recordingId, notes: seed.notes });
		}
	}

	builder.line('COMMIT;');
	builder.line();
	return builder.lines.join('\n');
}

async function main(): Promise<void> {
	const output = process.argv.includes('--output') ? resolve(process.argv[process.argv.indexOf('--output') + 1] ?? DEFAULT_OUTPUT) : DEFAULT_OUTPUT;
	await mkdir(resolve(output, '..'), { recursive: true });
	await writeFile(output, renderSql(), 'utf8');
}

if (import.meta.main) await main();
