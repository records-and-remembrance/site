import { describe, expect, test } from 'bun:test';
import type { MagazineReviewListRecord } from '../../../../magazine-review/types';
import { filterMagazineReviewRecords, nextPendingMagazineRecord } from './state';

function record(
	sourceKey: string,
	publication: string,
	parseStatus: MagazineReviewListRecord['reviewStatus'],
	humanStatus: MagazineReviewListRecord['humanReview']['status'],
): MagazineReviewListRecord {
	return {
		sourceKey,
		rawFields: {
			band: 'BN',
			publication,
			issue: 'vol.38',
			publishedDate: '',
			classification: 'I',
			content: `${publication} 掲載内容`,
		},
		subject: { kind: 'project', name: 'BURGER NUDS' },
		publication: { name: publication, rawName: publication, type: 'print' },
		issue: {
			issueKey: 'issue-1',
			issueNumber: 'vol.38',
			volume: '38',
			publishedDate: null,
			datePrecision: 'none',
			synthetic: false,
		},
		articles: [],
		classificationSource: 'explicit',
		reviewStatus: parseStatus,
		extracted: { pageReferences: [], urls: [], workCandidates: [], eventDateCandidates: [] },
		diagnostics: [],
		humanReview: { status: humanStatus, notes: '', updatedAt: null },
	};
}

const records = [record('one', 'Quip', 'unresolved', 'pending'), record('two', 'MUSICA', 'confirmed', 'approved'), record('three', '音楽と人', 'inferred', 'needs_changes')];

describe('magazine review state', () => {
	test('filters by search text, parser status, and human status', () => {
		expect(
			filterMagazineReviewRecords(records, {
				search: 'quip burger',
				parseStatus: 'unresolved',
				humanStatus: 'pending',
			}).map(({ sourceKey }) => sourceKey),
		).toEqual(['one']);
	});

	test('returns the next pending record and wraps around', () => {
		expect(nextPendingMagazineRecord(records, 'three')).toBe('one');
		expect(nextPendingMagazineRecord(records, 'one')).toBeUndefined();
	});
});
