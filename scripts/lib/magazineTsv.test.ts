import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseMagazineDate, parseMagazineTsv, type MagazineReviewRecord } from './magazineTsv';

const ROOT = join(import.meta.dir, '..', '..');

function findRecord(records: MagazineReviewRecord[], predicate: (record: MagazineReviewRecord) => boolean): MagazineReviewRecord {
	const record = records.find(predicate);
	if (!record) throw new Error('Expected magazine record was not found');
	return record;
}

describe('parseMagazineDate', () => {
	test('distinguishes day, month, uncertain, and missing dates without inventing a day', () => {
		expect(parseMagazineDate('2002/07/10')).toEqual({
			publishedDate: '2002-07-10',
			precision: 'day',
		});
		expect(parseMagazineDate('2002/7')).toEqual({
			publishedDate: null,
			precision: 'month',
		});
		expect(parseMagazineDate('2002/7?')).toEqual({
			publishedDate: null,
			precision: 'uncertain',
		});
		expect(parseMagazineDate('')).toEqual({
			publishedDate: null,
			precision: 'none',
		});
	});
});

describe('parseMagazineTsv', () => {
	test('parses all 241 CRLF source rows and preserves all six raw fields', async () => {
		const source = await readFile(join(ROOT, 'rawData', 'monden-magazine.tsv'), 'utf8');
		const result = parseMagazineTsv(source);

		expect(result.records).toHaveLength(241);
		expect(result.diagnostics).toEqual([]);
		for (const record of result.records) {
			expect(Object.keys(record.rawFields)).toEqual(['band', 'publication', 'issue', 'publishedDate', 'classification', 'content']);
		}
	});

	test('expands an unambiguous four-part classification into four article candidates', () => {
		const source = [
			'バンド\t雑誌名\t号数\t発売日\t分類(Interview/Column/Livereport/Review)\t掲載箇所/内容',
			'BN\tQuip\tvol.99\t2003/01/01\tI/L/C/R\tインタビュー(2p)、ライブレポート(1p)、コラム(1/2p)、ディスクレビュー(1/4p)',
		].join('\r\n');

		const [record] = parseMagazineTsv(source).records;

		expect(record?.articles.map((article) => article.type)).toEqual(['interview', 'live_report', 'column', 'review']);
		expect(record?.reviewStatus).toBe('confirmed');
	});

	test('shares an issue key across projects while retaining separate articles', async () => {
		const source = await readFile(join(ROOT, 'rawData', 'monden-magazine.tsv'), 'utf8');
		const records = parseMagazineTsv(source).records;
		const burgerNuds = findRecord(records, (record) => record.rawFields.band === 'BN' && record.rawFields.publication === 'Quip' && record.rawFields.issue === 'vol.38');
		const goodDog = findRecord(records, (record) => record.rawFields.band === 'GDHM' && record.rawFields.publication === 'Quip' && record.rawFields.issue === 'vol.38');

		expect(burgerNuds.issue.issueKey).toBe(goodDog.issue.issueKey);
		expect(burgerNuds.articles[0]?.articleKey).not.toBe(goodDog.articles[0]?.articleKey);
	});

	test('does not deduplicate distinct rows from the same publication and date', async () => {
		const source = await readFile(join(ROOT, 'rawData', 'monden-magazine.tsv'), 'utf8');
		const records = parseMagazineTsv(source).records.filter(
			(record) => record.rawFields.band === 'PtM' && record.rawFields.publication === 'Skream!' && record.rawFields.publishedDate === '2015/07/01',
		);

		expect(records).toHaveLength(2);
		expect(new Set(records.map((record) => record.sourceKey)).size).toBe(2);
		expect(records[0]?.issue.issueKey).toBe(records[1]?.issue.issueKey);
	});

	test('keeps uncertain and negative evidence out of confirmed records', () => {
		const source = ['バンド\t雑誌名\t号数\t発売日\t分類(Interview/Column/Livereport/Review)\t掲載箇所/内容', 'BN\tOlive\t2002/9?\t\tL\tライブレポート? みつからず'].join('\n');

		const [record] = parseMagazineTsv(source).records;

		expect(record?.reviewStatus).toBe('not_published');
		expect(record?.articles[0]?.reviewStatus).toBe('not_published');
	});

	test('is deterministic and classifies every row without silently dropping one', async () => {
		const source = await readFile(join(ROOT, 'rawData', 'monden-magazine.tsv'), 'utf8');
		const first = parseMagazineTsv(source);
		const second = parseMagazineTsv(source);

		expect(second).toEqual(first);
		expect(first.records.every((record) => ['confirmed', 'inferred', 'unresolved', 'not_published'].includes(record.reviewStatus))).toBe(true);
		expect(first.records.every((record) => record.articles.length > 0)).toBe(true);
	});

	test('maps known project labels and leaves the その他 row for person review', async () => {
		const source = await readFile(join(ROOT, 'rawData', 'monden-magazine.tsv'), 'utf8');
		const records = parseMagazineTsv(source).records;

		expect(findRecord(records, (record) => record.rawFields.band === 'BN').subject).toEqual({
			kind: 'project',
			name: 'BURGER NUDS',
		});
		expect(findRecord(records, (record) => record.rawFields.band === 'その他').subject).toEqual({
			kind: 'person_candidate',
			name: '門田匡陽',
		});
	});
});
